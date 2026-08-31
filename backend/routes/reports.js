'use strict';

// backend/routes/reports.js
// Endpoint dasar laporan sesuai File 2 Bagian 6.3 langkah kedua:
// GET /api/reports dan POST /api/reports, tanpa fitur verifikasi e.id.
// Field POST sesuai File 1 Bagian 5.2 langkah kelima.

const express = require('express');
const db = require('../db/db.js');
const { reportLimiter } = require('../middleware/rateLimiter.js');

const router = express.Router();

// Katalog enum dari File 1 Bagian 6.8 (rujukan tunggal nilai tetap).
const INFRA_TYPES = ['jembatan', 'jalan', 'sekolah', 'prasarana_publik', 'utilitas', 'lainnya'];
const SEVERITIES = ['ringan', 'sedang', 'berat', 'ambruk'];
const BRIDGE_AUTHORITIES = ['nasional', 'provinsi', 'kabupaten_kota', 'desa_swadaya', 'tidak_diketahui'];
const VITAL_STATUSES = ['akses_sekolah', 'akses_kesehatan', 'akses_antar_kampung', 'akses_sungai', 'akses_ekonomi', 'aset_utilitas', 'lainnya'];

// Kolom yang boleh muncul di API publik.
// reporter_verified_did dan validated_by_did TIDAK pernah dikembalikan
// (File 1 Bagian 7.4 dan aturan "field DID tidak boleh muncul di response").
const PUBLIC_COLUMNS = [
  'id',
  'created_at',
  'updated_at',
  'infra_type',
  'severity',
  'bridge_authority',
  'vital_status',
  'vital_status_note',
  'description',
  'location_name',
  'lat',
  'lng',
  'photo_urls',
  'reporter_display_name',
  'reporter_is_verified',
  'validated_by_display_name',
  'validated_at',
  'status',
  'source_type',
  'source_media_name',
  'source_media_url',
  'source_media_date',
  'related_earthquake',
  'related_weather',
  'vote_count',
];

const PUBLIC_SELECT = PUBLIC_COLUMNS.join(', ');

// vital_status disimpan sebagai string JSON array (File 1 Bagian 6.8.4),
// dikembalikan API sebagai array agar frontend mudah merender badge/tag.
function parseVitalStatus(row) {
  if (!row) return row;
  if (row.vital_status !== null && row.vital_status !== undefined) {
    try {
      row.vital_status = JSON.parse(row.vital_status);
    } catch (_e) {
      // Nilai lama yang bukan JSON valid: biarkan apa adanya.
    }
  }
  return row;
}

// GET /api/reports
// Mengambil seluruh laporan, default urut terbaru dulu (created_at desc).
// Belum ada parameter filter (severity, infra_type, dst.) pada langkah
// kedua ini; filter menyusul di File 2 Bagian 6.3 langkah keenam.
router.get('/', (req, res) => {
  const rows = db
    .prepare(`SELECT ${PUBLIC_SELECT} FROM reports ORDER BY created_at DESC, id DESC`)
    .all();

  res.json(rows.map(parseVitalStatus));
});

// POST /api/reports
// Menyimpan laporan baru. Rate limiting (File 1 Bagian 11.3): pada tahap
// ini seluruh POST dianggap tanpa verifikasi e.id, sehingga limiter
// diterapkan tanpa kondisi (File 2 Bagian 6.3). Belum ada verifikasi e.id.
router.post('/', reportLimiter, (req, res) => {
  const body = req.body || {};

  // ---- Validasi field wajib (File 1 Bagian 5.2 langkah kelima/keenam) ----
  const errors = [];

  const infra_type = typeof body.infra_type === 'string' ? body.infra_type : null;
  if (!infra_type) errors.push('infra_type wajib diisi');
  else if (!INFRA_TYPES.includes(infra_type)) errors.push(`infra_type harus salah satu dari: ${INFRA_TYPES.join(', ')}`);

  const severity = typeof body.severity === 'string' ? body.severity : null;
  if (!severity) errors.push('severity wajib diisi');
  else if (!SEVERITIES.includes(severity)) errors.push(`severity harus salah satu dari: ${SEVERITIES.join(', ')}`);

  // bridge_authority opsional; default 'tidak_diketahui' (File 1 Bagian 6.8.3)
  let bridge_authority = null;
  if (body.bridge_authority !== undefined && body.bridge_authority !== null && body.bridge_authority !== '') {
    bridge_authority = String(body.bridge_authority);
    if (!BRIDGE_AUTHORITIES.includes(bridge_authority)) {
      errors.push(`bridge_authority harus salah satu dari: ${BRIDGE_AUTHORITIES.join(', ')}`);
    }
  }

  // vital_status: checkbox berganda, wajib minimal satu, divalidasi di level
  // aplikasi karena kolomnya string JSON array (File 1 Bagian 6.4 catatan).
  const vital_status = Array.isArray(body.vital_status) ? body.vital_status : null;
  if (!vital_status || vital_status.length === 0) {
    errors.push('vital_status wajib diisi minimal satu pilihan');
  } else {
    const invalid = vital_status.filter((v) => !VITAL_STATUSES.includes(v));
    if (invalid.length > 0) {
      errors.push(`vital_status mengandung nilai tidak dikenal: ${invalid.join(', ')}`);
    }
  }

  const location_name = typeof body.location_name === 'string' && body.location_name.trim() !== '' ? body.location_name.trim() : null;
  if (!location_name) errors.push('location_name wajib diisi');

  const lat = Number(body.lat);
  if (body.lat === undefined || body.lat === null || body.lat === '' || !Number.isFinite(lat)) {
    errors.push('lat wajib diisi berupa angka');
  }

  const lng = Number(body.lng);
  if (body.lng === undefined || body.lng === null || body.lng === '' || !Number.isFinite(lng)) {
    errors.push('lng wajib diisi berupa angka');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  // description opsional (File 1 Bagian 5.2 langkah kelima)
  const description = body.description !== undefined && body.description !== null
    ? String(body.description)
    : null;

  const stmt = db.prepare(`
    INSERT INTO reports (
      infra_type, severity, bridge_authority, vital_status,
      location_name, lat, lng, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    infra_type,
    severity,
    bridge_authority || 'tidak_diketahui',
    JSON.stringify(vital_status),
    location_name,
    lat,
    lng,
    description
  );

  const created = db
    .prepare(`SELECT ${PUBLIC_SELECT} FROM reports WHERE id = ?`)
    .get(info.lastInsertRowid);

  res.status(201).json(parseVitalStatus(created));
});

module.exports = router;
