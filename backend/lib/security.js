'use strict';

// backend/lib/security.js
// Lapisan keamanan bersama (perbaikan temuan pentest K-1 & S-1 + fitur
// baru captcha / edit-own / tandai-tidak-dapat-diverifikasi):
//   1) requireSession(role)  — otorisasi WAJIB sesi e.id 'approved'
//      (tabel verification_sessions). Identitas SELALU dari server,
//      bukan dari body/header yang bisa dipalsukan klien.
//   2) Captcha aritmetika stateless per-proses (1x pakai, kedaluwarsa
//      5 menit) untuk pelapor warga TANPA verifikasi e.id.
//   3) ensureUnverifiableColumn() — migrasi ringan kolom unverifiable
//      untuk DB produksi lama (tanpa wipe).

const crypto = require('crypto');
const db = require('../db/db.js');

// --- Migrasi kolom (otomatis saat modul dimuat, sebelum request) ---
function ensureUnverifiableColumn() {
  const cols = db.prepare('PRAGMA table_info(reports)').all().map((c) => c.name);
  if (!cols.includes('unverifiable')) {
    db.exec('ALTER TABLE reports ADD COLUMN unverifiable INTEGER NOT NULL DEFAULT 0');
  }
}
ensureUnverifiableColumn();

const SESSION_OK = 'approved';
const ROLES = ['warga', 'otoritas'];

// Middleware otorisasi: header 'x-eid-session' = session_id verifikasi
// e.id yang SUDAH approved di sisi server (bukan klaim klien).
function requireSession(role) {
  if (!ROLES.includes(role)) throw new Error('role tidak dikenal: ' + role);
  return (req, res, next) => {
    const sessionId = req.get('x-eid-session') || '';
    if (!sessionId) {
      return res.status(403).json({ error: 'Butuh sesi e.id yang terverifikasi' });
    }
    const row = db
      .prepare(
        'SELECT session_id, schema_type, status, holder_did, holder_name, expires_at ' +
          'FROM verification_sessions WHERE session_id = ?'
      )
      .get(sessionId);
    if (!row || row.schema_type !== role || row.status !== SESSION_OK) {
      return res.status(403).json({ error: 'Sesi e.id tidak sah untuk peran ini' });
    }
    if (row.expires_at) {
      const exp = new Date(row.expires_at);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return res.status(403).json({ error: 'Sesi e.id sudah kedaluwarsa' });
      }
    }
    req.eidSession = {
      session_id: row.session_id,
      holder_did: row.holder_did,
      holder_name: row.holder_name,
      role,
    };
    next();
  };
}

// --- Captcha aritmetika (per-proses, cukup untuk lapisan anti-bot
//     dasar; single-process backend). ---
const captchaStore = new Map(); // id -> { answer, exp }

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function createCaptcha() {
  const a = randomInt(2, 12);
  const b = randomInt(1, 12);
  const id = crypto.randomBytes(8).toString('hex');
  captchaStore.set(id, { answer: a + b, exp: Date.now() + 5 * 60 * 1000 });
  return { id, question: `Berapa hasil ${a} + ${b}?` };
}

// 1x pakai: jawaban benar -> challenge dibuang; jawaban salah -> 422.
function verifyCaptcha(id, answerText) {
  if (!id || !captchaStore.has(id)) return { ok: false, reason: 'Challenge captcha tidak dikenal/kedaluwarsa' };
  const entry = captchaStore.get(id);
  captchaStore.delete(id); // sekali pakai
  if (entry.exp < Date.now()) return { ok: false, reason: 'Captcha kedaluwarsa, muat ulang' };
  const ans = parseInt(String(answerText).trim(), 10);
  if (!Number.isFinite(ans) || ans !== entry.answer) return { ok: false, reason: 'Jawaban captcha salah' };
  return { ok: true };
}

module.exports = { ensureUnverifiableColumn, requireSession, createCaptcha, verifyCaptcha, SESSION_OK };
