'use strict';

// backend/routes/comments.js — Diskusi per laporan (3 Sep 2026).
// - Tulis/edit/hapus/upvote: WAJIB sesi e.id approved (warga ATAU otoritas).
// - Baca: publik.
// - Anti-spam: rate limit per IP + panjang 1..500 + sensor kata kasar (***).
// - Identitas: nama mengikuti PILIHAN user saat verifikasi (nama/anonim) yang
//   dikirim frontend sbg display_name; server tetap menyimpan holder_did
//   (authoritative) + role dari sesi. Timestamp sampai detik.
// - Upvote seperti Reddit: arrow up saja, 1x per user per komentar.

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/db.js');

const router = express.Router();

// --- Migrasi tabel (otomatis) ---
function ensureTables() {
  const t = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('comments', 'comment_votes')")
    .all()
    .map((r) => r.name);
  if (!t.includes('comments')) {
    db.exec(`CREATE TABLE comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      holder_did TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT,
      body TEXT NOT NULL,
      is_edited INTEGER NOT NULL DEFAULT 0,
      upvotes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.exec('CREATE INDEX idx_comments_report ON comments(report_id, id)');
  }
  if (!t.includes('comment_votes')) {
    db.exec(`CREATE TABLE comment_votes (
      comment_id INTEGER NOT NULL,
      voter_did TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (comment_id, voter_did)
    )`);
  }
}
ensureTables();

// --- Kata kasar -> asterisk (sensor server; panjang tetap) ---
const BAD_WORDS = [
  'anjing', 'anjir', 'bangsat', 'kontol', 'memek', 'pantek', 'babi',
  'goblok', 'tolol', 'bego', 'kampang', 'jancok', 'asu', 'ngentot',
  'setan', 'brengsek', 'bajingan', 'kampret', 'sialan', 'tai', 'kampungan',
  'idiot', 'bodoh', 'dungu', 'sinting', 'gila', 'sarap', 'kurang ajar',
];
function maskBad(input) {
  let s = String(input || '');
  const low = s.toLowerCase();
  for (const w of BAD_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, 'gi');
    if (re.test(low)) {
      s = s.replace(re, '*'.repeat(w.length));
    }
  }
  return s.trim();
}

// --- Rate limit anti-spam (per IP, memory store default) ---
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 8, standardHeaders: false, legacyHeaders: false });

// --- Sesi e.id approved (warga ATAU otoritas) ---
function requireUser(req, res, next) {
  const sessionId = req.get('x-eid-session') || '';
  if (!sessionId) return res.status(403).json({ error: 'Butuh sesi e.id yang terverifikasi' });
  const row = db
    .prepare(
      `SELECT session_id, schema_type, status, holder_did, holder_name, expires_at
       FROM verification_sessions WHERE session_id = ?`
    )
    .get(sessionId);
  if (!row || !['warga', 'otoritas'].includes(row.schema_type) || row.status !== 'approved') {
    return res.status(403).json({ error: 'Sesi e.id tidak sah untuk berdiskusi' });
  }
  if (row.expires_at) {
    const exp = new Date(row.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return res.status(403).json({ error: 'Sesi e.id sudah kedaluwarsa' });
    }
  }
  req.user = { holder_did: row.holder_did, role: row.schema_type };
  try {
    db.prepare('UPDATE verification_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);
  } catch (_e) { /* best-effort */ }
  next();
}

const PUBLIC = 'id, report_id, role, display_name, body, is_edited, upvotes, created_at, updated_at';

// GET /api/comments/report/:reportId (publik, terurut lama->baru)
router.get('/report/:reportId', (req, res) => {
  const id = Number(req.params.reportId);
  if (!Number.isInteger(id) || id <= 0) return res.json({ comments: [] });
  try {
    const rows = db.prepare(`SELECT ${PUBLIC} FROM comments WHERE report_id = ? ORDER BY id ASC`).all(id);
    res.json({ comments: rows });
  } catch (_e) {
    res.status(500).json({ error: 'Gagal memuat diskusi' });
  }
});

// POST /api/comments/report/:reportId
router.post('/report/:reportId', writeLimiter, requireUser, (req, res) => {
  const id = Number(req.params.reportId);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const exists = db.prepare('SELECT id FROM reports WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const raw = typeof (req.body || {}).text === 'string' ? req.body.text.trim() : '';
  const body = maskBad(raw);
  if (body.length < 1 || body.length > 500) {
    return res.status(400).json({ error: 'Komentar harus 1-500 karakter' });
  }
  const rawName = typeof (req.body || {}).display_name === 'string' ? req.body.display_name.trim().slice(0, 60) : '';
  const displayName = rawName || (req.user.role === 'otoritas' ? 'Otoritas' : 'Warga');
  const info = db
    .prepare(
      `INSERT INTO comments (report_id, holder_did, role, display_name, body)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, req.user.holder_did, req.user.role, displayName, body);
  const row = db.prepare(`SELECT ${PUBLIC} FROM comments WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ comment: row });
});

// PATCH /api/comments/:commentId (edit milik sendiri)
router.patch('/:commentId', writeLimiter, requireUser, (req, res) => {
  const cid = Number(req.params.commentId);
  const row = db.prepare(`SELECT * FROM comments WHERE id = ?`).get(cid);
  if (!row) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
  if (row.holder_did !== req.user.holder_did) {
    return res.status(403).json({ error: 'Hanya penulis komentar ini yang bisa mengedit' });
  }
  const raw = typeof (req.body || {}).text === 'string' ? req.body.text.trim() : '';
  const body = maskBad(raw);
  if (body.length < 1 || body.length > 500) {
    return res.status(400).json({ error: 'Komentar harus 1-500 karakter' });
  }
  db.prepare(
    `UPDATE comments SET body = ?, is_edited = 1, updated_at = datetime('now') WHERE id = ?`
  ).run(body, cid);
  res.json({ comment: db.prepare(`SELECT ${PUBLIC} FROM comments WHERE id = ?`).get(cid) });
});

// DELETE /api/comments/:commentId (hapus milik sendiri)
router.delete('/:commentId', writeLimiter, requireUser, (req, res) => {
  const cid = Number(req.params.commentId);
  const row = db.prepare(`SELECT holder_did FROM comments WHERE id = ?`).get(cid);
  if (!row) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
  if (row.holder_did !== req.user.holder_did) {
    return res.status(403).json({ error: 'Hanya penulis komentar ini yang bisa menghapus' });
  }
  db.transaction(() => {
    db.prepare('DELETE FROM comment_votes WHERE comment_id = ?').run(cid);
    db.prepare('DELETE FROM comments WHERE id = ?').run(cid);
  })();
  res.json({ ok: true });
});

// POST /api/comments/:commentId/upvote (arrow up, sekali per user)
router.post('/:commentId/upvote', writeLimiter, requireUser, (req, res) => {
  const cid = Number(req.params.commentId);
  const row = db.prepare('SELECT id FROM comments WHERE id = ?').get(cid);
  if (!row) return res.status(404).json({ error: 'Komentar tidak ditemukan' });
  const dup = db.prepare('SELECT 1 FROM comment_votes WHERE comment_id = ? AND voter_did = ?').get(cid, req.user.holder_did);
  if (dup) return res.status(409).json({ error: 'Anda sudah memberi upvote komentar ini' });
  db.transaction(() => {
    db.prepare('INSERT INTO comment_votes (comment_id, voter_did) VALUES (?, ?)').run(cid, req.user.holder_did);
    db.prepare('UPDATE comments SET upvotes = upvotes + 1 WHERE id = ?').run(cid);
  })();
  const updated = db.prepare(`SELECT ${PUBLIC} FROM comments WHERE id = ?`).get(cid);
  res.status(201).json({ comment: updated });
});

module.exports = router;
