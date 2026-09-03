'use strict';

// backend/routes/otoritas.js - transparansi publik (3 Sep 2026).
// GET /api/otoritas/active - instansi otoritas yang BENAR-BENAR BEKERJA
// dalam 24 jam terakhir (last_used_at diperbarui hanya saat sesi approved
// melakukan aksi terotorisasi - bukan sekadar login). Tanpa nama pribadi:
// hanya label instansi/asal yang dipilih pengguna (klaim mandiri) + waktu
// terakhir bertindak.

const express = require('express');
const db = require('../db/db.js');

const router = express.Router();

// GET /api/otoritas/active
router.get('/active', (req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT agency_label AS label, MAX(last_used_at) AS last_active_at
         FROM verification_sessions
         WHERE schema_type = 'otoritas'
           AND status = 'approved'
           AND agency_label IS NOT NULL
           AND TRIM(agency_label) <> ''
           AND last_used_at IS NOT NULL
           AND last_used_at >= datetime('now', '-1 day')
         GROUP BY agency_label
         ORDER BY last_active_at DESC
         LIMIT 12`
      )
      .all();
    res.json({ active: rows.map((r) => ({ label: r.label, last_active_at: r.last_active_at })) });
  } catch (_e) {
    res.json({ active: [] }); // best-effort: fitur sekunder, jangan 5xx
  }
});

module.exports = router;
