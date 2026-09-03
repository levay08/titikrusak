'use strict';

// backend/routes/activity.js
// Feed aktivitas gabungan (transparansi): SEMUA kejadian di sistem -
// laporan baru (warga), perubahan status (otoritas), dan dukungan/vote
// (warga) - digabung menjadi satu timeline terurut terbaru. Dipakai menu
// Notifikasi (HeaderModals). TIDAK membocorkan field DID: hanya nama
// tampilan (actor) + lokasi + waktu.

const express = require('express');
const db = require('../db/db.js');

const router = express.Router();

// GET /api/activity?limit=50
router.get('/', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  try {
    // 1) Laporan baru (warga): severity + infra_type disertakan agar UI
    //    bisa menampilkan chip kontekstual seperti sebelumnya.
    const created = db
      .prepare(
        `SELECT 'report_created' AS type, id AS report_id, location_name,
                reporter_display_name AS actor, source_type,
                source_media_name, source_media_date, severity, infra_type,
                created_at AS at
         FROM reports`
      )
      .all();

    // 2) Perubahan status (otoritas): new_status + siapa yang mengubah.
    const statuses = db
      .prepare(
        `SELECT 'status_changed' AS type, h.report_id, r.location_name,
                h.changed_by_display_name AS actor, h.new_status, h.changed_at AS at
         FROM status_history h JOIN reports r ON r.id = h.report_id`
      )
      .all();

    // 3) Dukungan/vote: identitas penuh (DID) & IP TIDAK pernah tampil di
    //    feed publik - voter ditampilkan anonim.
    const votes = db
      .prepare(
        `SELECT 'voted' AS type, v.report_id, r.location_name,
                CASE WHEN v.voter_did LIKE 'ip:%' OR v.voter_did = 'anonim'
                      OR v.voter_did LIKE 'did:%' THEN NULL
                     ELSE v.voter_did END AS actor,
                v.created_at AS at
         FROM votes v JOIN reports r ON r.id = v.report_id`
      )
      .all();

    // 4) Diskusi: ringkasan per titik (nama + kerusakan + jumlah komentar +
    //    komentar terbaru: dari siapa & kapan). Tanpa nama pribadi otoritas.
    const commentRows = db
      .prepare(
        `SELECT c.id AS cid, c.report_id, r.location_name, r.infra_type,
                r.severity, c.display_name, c.created_at
         FROM comments c JOIN reports r ON r.id = c.report_id
         ORDER BY c.id DESC LIMIT 500`
      )
      .all();
    const groupMap = new Map();
    for (const c of commentRows) {
      const g = groupMap.get(c.report_id);
      if (!g) {
        groupMap.set(c.report_id, {
          report_id: c.report_id,
          location_name: c.location_name,
          infra_type: c.infra_type,
          severity: c.severity,
          count: 1,
          last_id: c.cid,
          last_name: c.display_name || 'Anonim',
          last_at: c.created_at,
        });
      } else {
        g.count++;
      }
    }
    const commentGroups = [...groupMap.values()].slice(0, 40);

    const activities = [...created, ...statuses, ...votes]
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, limit);

    res.json({ activities, commentGroups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat aktivitas' });
  }
});

// ---- Riwayat status SATU laporan (transparansi publik): siapa/apa/kapan
//      tanpa nama pribadi otoritas - cukup label "Otoritas". ----
router.get('/report/:reportId', (req, res) => {
  const id = Number(req.params.reportId);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  }
  try {
    const rows = db
      .prepare(
        `SELECT new_status, changed_at
         FROM status_history WHERE report_id = ?
         ORDER BY changed_at DESC`
      )
      .all(id);
    res.json({
      history: rows.map((r) => ({ new_status: r.new_status, changed_at: r.changed_at })),
    });
  } catch (_e) {
    res.status(500).json({ error: 'Gagal memuat riwayat status' });
  }
});

module.exports = router;
