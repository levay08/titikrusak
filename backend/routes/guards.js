'use strict';

// backend/routes/guards.js
// Router KEAMANAN yang dipasang DI DEPAN routes/reports.js untuk
// permintaan berbahaya (perbaikan pentest K-1/S-1 + fitur baru):
//
//   POST  /api/reports            -> middleware: captcha (pelapor anonim)
//                                    ATAU sesi warga e.id approved; body
//                                    di-sanitasi (identitas dari server).
//   PATCH /api/reports/:id/status -> HANYA otoritas e.id approved
//                                    (sebelumnya anonim bisa, K-1).
//   POST  /api/reports/:id/vote   -> HANYA warga e.id approved; voter_did
//                                    dari server, anti spam (S-1).
//   PATCH /api/reports/:id        -> edit laporan OLEH PELAPORNYA sendiri
//                                    (warga e.id approved yang
//                                    reporter_verified_did-nya cocok &
//                                    status masih 'dilaporkan').
//   PATCH /api/reports/:id/unverifiable -> otoritas menandai laporan
//                                    "tidak dapat diverifikasi keasliannya"
//                                    (titik palsu/meyakinkan) -> frontend
//                                    menampilkan tanda X.
//
// Kolom/daftar di bawah sengaja diduplikasi dari reports.js (status,
// urutan, kolom publik) — jaga tetap sinkron bila mengubah di sana.

const express = require('express');
const { requireSession, verifyCaptcha } = require('../lib/security.js');
const { guardPhotos } = require('../lib/uploadGuard.js');

const router = express.Router();

const STATUSES = ['dilaporkan', 'terverifikasi', 'dalam_perbaikan', 'selesai_diperbaiki'];
const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s, i]));

// Kolom publik — harus sama dengan PUBLIC_COLUMNS di reports.js + unverifiable.
const PUBLIC_COLUMNS = [
  'id', 'created_at', 'updated_at', 'infra_type', 'severity', 'bridge_authority',
  'vital_status', 'vital_status_note', 'description', 'location_name', 'lat', 'lng',
  'photo_urls', 'reporter_display_name', 'reporter_verified_did',
  'reporter_is_verified', 'validated_by_display_name', 'validated_by_did',
  'validated_at', 'status', 'source_type', 'source_media_name', 'source_media_url',
  'source_media_date', 'related_earthquake', 'related_weather', 'vote_count',
 'unverifiable', 'unverifiable_reason',
 ];
 const PS = PUBLIC_COLUMNS.join(', ');

const db = require('../db/db.js');

function parseVital(row) {
  if (row && typeof row.vital_status === 'string') {
    try {
      row.vital_status = JSON.parse(row.vital_status);
    } catch {
      row.vital_status = [];
    }
  }
  return row;
}

function getRow(id) {
  const row = db.prepare(`SELECT ${PS} FROM reports WHERE id = ?`).get(id);
  return row ? parseVital(row) : null;
}

// ---- POST / (captcha/sesi) : middleware saja, handler asli di reports.js ----
router.post('/', (req, res, next) => {
  const body = req.body || {};
  if (body.reporter_is_verified === true) {
    // Klaim "sudah verifikasi e.id" harus dibuktikan sesi server.
    const sessionId = req.get('x-eid-session') || '';
    const row = sessionId
      ? db
          .prepare(
            "SELECT session_id, holder_did, holder_name FROM verification_sessions WHERE session_id = ? AND schema_type = 'warga' AND status = 'approved'"
          )
          .get(sessionId)
      : null;
    if (!row) {
      return res.status(403).json({ error: 'Verifikasi e.id tidak sah — ulangi verifikasi' });
    }
    // Sanitasi: identitas SELALU dari server, bukan body klien.
    body.reporter_is_verified = true;
    body.reporter_verified_did = row.holder_did;
    if (!body.reporter_display_name) body.reporter_display_name = row.holder_name;
    return next();
  }
  // Pelapor anonim -> wajib captcha.
  const chk = verifyCaptcha(body.captcha_id, body.captcha_answer);
  if (!chk.ok) {
    return res.status(422).json({ error: chk.reason });
  }
  body.reporter_is_verified = false;
  body.reporter_verified_did = null;
  next();
});

// ---- PATCH /:id/status : otoritas saja (fix K-1) ----
router.patch('/:id/status', requireSession('otoritas'), (req, res) => {
  const id = Number(req.params.id);
  const eid = req.eidSession;
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

  const status = typeof (req.body || {}).status === 'string' ? req.body.status : null;
  if (!status || !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status harus salah satu dari: ${STATUSES.join(', ')}` });
  }
  if (status === existing.status) {
    return res.status(400).json({ error: 'Laporan sudah berstatus itu' });
  }
  if (STATUS_ORDER[status] < STATUS_ORDER[existing.status]) {
    return res.status(400).json({
      error: `Transisi status tidak valid: ${existing.status} -> ${status} (status tidak bisa mundur)`,
    });
  }

  db.transaction(() => {
    if (status === 'terverifikasi') {
      db.prepare(
        `UPDATE reports SET status = ?, validated_by_display_name = ?,
         validated_by_did = ?, validated_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(status, eid.holder_name, eid.holder_did, id);
    } else {
      db.prepare('UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    }
    db.prepare(
      'INSERT INTO status_history (report_id, new_status, changed_by_display_name) VALUES (?, ?, ?)'
    ).run(id, status, eid.holder_name);
  })();

  res.json(getRow(id));
});

// ---- POST /:id/vote : warga verified saja, did dari server (fix S-1) ----
router.post('/:id/vote', requireSession('warga'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const existing = db.prepare('SELECT id, vote_count FROM reports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

  const voterDid = req.eidSession.holder_did || 'anonim';
  const dup = db
    .prepare('SELECT id FROM votes WHERE report_id = ? AND voter_did = ?')
    .get(id, voterDid);
  if (dup) return res.status(409).json({ error: 'Anda sudah mendukung laporan ini' });

  db.transaction(() => {
    db.prepare('INSERT INTO votes (report_id, voter_did) VALUES (?, ?)').run(id, voterDid);
    db.prepare('UPDATE reports SET vote_count = vote_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  })();

  res.status(201).json(getRow(id));
});

// ---- PATCH /:id : edit laporan milik sendiri (pelapor verified) ----
const EDITABLE = ['description', 'location_name', 'severity'];
router.patch('/:id', requireSession('warga'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  if (existing.status !== 'dilaporkan') {
    return res.status(400).json({ error: 'Laporan hanya bisa diedit selama masih berstatus dilaporkan' });
  }
  if (existing.reporter_verified_did !== req.eidSession.holder_did) {
    return res.status(403).json({ error: 'Anda bukan pelapor laporan ini — tidak bisa mengedit' });
  }

  const body = req.body || {};
  const upd = {};
  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.trim().length < 10) {
      return res.status(400).json({ error: 'Deskripsi minimal 10 karakter' });
    }
    if (body.description.trim().length > 5000) {
      return res.status(400).json({ error: 'Deskripsi maksimal 5000 karakter' });
    }
    upd.description = body.description.trim();
  }
  if (body.location_name !== undefined) {
    if (typeof body.location_name !== 'string' || body.location_name.trim() === '') {
      return res.status(400).json({ error: 'Nama lokasi tidak boleh kosong' });
    }
    if (body.location_name.trim().length > 300) {
      return res.status(400).json({ error: 'Nama lokasi maksimal 300 karakter' });
    }
    upd.location_name = body.location_name.trim();
  }
  if (body.severity !== undefined) {
    if (!['ringan', 'sedang', 'berat', 'ambruk'].includes(body.severity)) {
      return res.status(400).json({ error: 'severity tidak valid' });
    }
    upd.severity = body.severity;
  }
  if (Object.keys(upd).length === 0) {
    return res.status(400).json({ error: 'Tidak ada field yang bisa diedit dikirim' });
  }

  const sets = Object.keys(upd).map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE reports SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
    ...Object.values(upd),
    id
  );
  res.json(getRow(id));
});

// ---- PATCH /:id/unverifiable : otoritas menandai "tidak dapat
//      diverifikasi keasliannya" (titik X). { unverifiable: true|false } ----
router.patch('/:id/unverifiable', requireSession('otoritas'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const existing = db.prepare('SELECT id FROM reports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Laporan tidak ditemukan' });

  const flag = (req.body || {}).unverifiable === true ? 1 : 0;
  const rawReason =
    req.body && typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (flag === 1 && rawReason.length < 10) {
    return res
      .status(400)
      .json({ error: 'Alasan penolakan wajib diisi minimal 10 karakter (terlihat oleh publik di detail titik)' });
  }
  if (rawReason.length > 1000) {
    return res.status(400).json({ error: 'Alasan penolakan maksimal 1000 karakter' });
  }
  // Catatan: tidak memakai status_history (kolom new_status punya CHECK
  // 4 status resmi). Tanda X + alasan tercatat di kolom unverifiable &
  // unverifiable_reason; otoritas yang menandai ada di sesi (req.eidSession).
  db.prepare(
    'UPDATE reports SET unverifiable = ?, unverifiable_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(flag, flag === 1 ? rawReason : null, id);

  res.json(getRow(id));
});

// ---- DELETE /:id : HANYA pelapor (pemilik) bisa menghapus, dan hanya
//      selama status masih 'dilaporkan'. Otoritas TIDAK punya akses
//      hapus — otoritas hanya menandai (unverifiable) agar laporan tak
//      bisa dihilangkan diam-diam. Laporan media/sumber lain tanpa
//      reporter_verified_did tidak bisa dihapus siapa pun. ----
router.delete('/:id', requireSession('warga'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  if (existing.reporter_verified_did !== req.eidSession.holder_did) {
    return res.status(403).json({ error: 'Hanya pelapor laporan ini yang bisa menghapus' });
  }
  if (existing.status !== 'dilaporkan') {
    return res.status(400).json({
      error: 'Laporan sudah diproses (status bukan dilaporkan) — tidak bisa dihapus, hubungi otoritas',
    });
  }
  db.prepare('DELETE FROM reports WHERE id = ?').run(id); // votes/status_history/fix_claims ikut CASCADE
  res.json({ ok: true, deleted: true, id });
});

// ---- POST /:id/fix-claim : warga e.id terverifikasi menandai titik
//      SUDAH DIPERBAIKI — wajib lampirkan minimal 1 foto bukti.
//      Klaim masuk antrean otoritas (status 'menunggu'). ----
router.post('/:id/fix-claim', requireSession('warga'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  const report = db.prepare('SELECT id, status, unverifiable FROM reports WHERE id = ?').get(id);
  if (!report) return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  if (report.status === 'selesai_diperbaiki') {
    return res.status(400).json({ error: 'Titik ini sudah ditandai selesai diperbaiki' });
  }

  const body = req.body || {};
  // Foto bukti klaim WAJIB: divalidasi magic bytes + scan ClamAV bila
  // tersedia (lib/uploadGuard.js — proteksi upload 2 Sep 2026).
  const guarded = await guardPhotos(body.photo_urls || []);
  if (guarded.photos.length === 0) {
    return res.status(400).json({ error: guarded.errors[0] || 'Klaim sudah diperbaiki wajib menyertakan minimal 1 foto bukti' });
  }
  const cleanPhotos = guarded.photos;
  const note =
    body.note !== undefined && typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : null;

  const dup = db
    .prepare("SELECT id FROM fix_claims WHERE report_id = ? AND status = 'menunggu'")
    .get(id);
  if (dup) return res.status(409).json({ error: 'Sudah ada klaim menunggu diverifikasi untuk titik ini' });

  const info = db
    .prepare(
      `INSERT INTO fix_claims (report_id, claimed_by_did, claimed_by_display_name,
        photo_urls, note, status) VALUES (?, ?, ?, ?, ?, 'menunggu')`
    )
    .run(id, req.eidSession.holder_did, req.eidSession.holder_name, JSON.stringify(cleanPhotos), note);

  const claim = db.prepare('SELECT * FROM fix_claims WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(claim);
});

// ---- GET /fix-claims : antrean klaim perbaikan untuk OTORITAS.
//      ?status=menunggu (default) | diterima | ditolak | semua ----
router.get('/fix-claims', requireSession('otoritas'), (req, res) => {
  const st = (req.query.status || 'menunggu').toString();
  const allowed = ['menunggu', 'diterima', 'ditolak', 'semua'];
  const where = allowed.includes(st) && st !== 'semua' ? 'WHERE fc.status = ?' : '';
  const args = allowed.includes(st) && st !== 'semua' ? [st] : [];
  const rows = db
    .prepare(
      `SELECT fc.*, r.location_name AS report_location, r.status AS report_status,
              r.lat, r.lng, r.infra_type, r.severity, r.unverifiable
       FROM fix_claims fc JOIN reports r ON r.id = fc.report_id ${where}
       ORDER BY fc.created_at DESC LIMIT 200`
    )
    .all(...args);
  rows.forEach((r) => {
    try { r.photo_urls = JSON.parse(r.photo_urls); } catch { r.photo_urls = []; }
  });
  res.json(rows);
});

// ---- PATCH /:id/fix-claim/:claimId : keputusan OTORITAS.
//      { decision: 'terima' } -> titik di-close (status
//      selesai_diperbaiki = HIJAU di peta) & klaim diterima.
//      { decision: 'tolak' }  -> klaim ditolak, titik tetap. ----
router.patch('/:id/fix-claim/:claimId', requireSession('otoritas'), (req, res) => {
  const id = Number(req.params.id);
  const claimId = Number(req.params.claimId);
  if (!Number.isInteger(id) || !Number.isInteger(claimId) || id <= 0 || claimId <= 0) {
    return res.status(404).json({ error: 'Klaim tidak ditemukan' });
  }
  const claim = db
    .prepare('SELECT * FROM fix_claims WHERE id = ? AND report_id = ?')
    .get(claimId, id);
  if (!claim) return res.status(404).json({ error: 'Klaim tidak ditemukan' });
  if (claim.status !== 'menunggu') {
    return res.status(400).json({ error: 'Klaim ini sudah diputuskan sebelumnya' });
  }
  const decision = (req.body || {}).decision;
  if (decision !== 'terima' && decision !== 'tolak') {
    return res.status(400).json({ error: 'decision harus "terima" atau "tolak"' });
  }

  db.transaction(() => {
    const newStatus = decision === 'terima' ? 'diterima' : 'ditolak';
    db.prepare(
      `UPDATE fix_claims SET status = ?, decided_at = CURRENT_TIMESTAMP,
       decided_by_did = ?, decided_by_display_name = ? WHERE id = ?`
    ).run(newStatus, req.eidSession.holder_did, req.eidSession.holder_name, claimId);
    if (decision === 'terima') {
      const r = db.prepare('SELECT status FROM reports WHERE id = ?').get(id);
      if (r.status !== 'selesai_diperbaiki') {
        db.prepare(
          `UPDATE reports SET status = 'selesai_diperbaiki', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).run(id);
        db.prepare(
          `INSERT INTO status_history (report_id, new_status, changed_by_display_name, changed_by_did)
           VALUES (?, 'selesai_diperbaiki', ?, ?)`
        ).run(id, req.eidSession.holder_name, req.eidSession.holder_did);
      }
    }
  })();

  const updated = db.prepare('SELECT * FROM fix_claims WHERE id = ?').get(claimId);
  try { updated.photo_urls = JSON.parse(updated.photo_urls); } catch { updated.photo_urls = []; }
  res.json({ claim: updated, report: getRow(id) });
});

module.exports = router;
