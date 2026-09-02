'use strict';

// backend/routes/reports.js
// Endpoint dasar laporan sesuai File 2 Bagian 6.3 langkah kedua:
// GET /api/reports dan POST /api/reports, tanpa fitur verifikasi e.id.
// Field POST sesuai File 1 Bagian 5.2 langkah kelima.

const express = require('express');
const db = require('../db/db.js');
const { guardPhotos } = require('../lib/uploadGuard.js');
const { reportLimiter } = require('../middleware/rateLimiter.js');
const { bmkg } = require('../services/bmkgClient.js');

const router = express.Router();

// Katalog enum dari File 1 Bagian 6.8 (rujukan tunggal nilai tetap).
const INFRA_TYPES = [
  'jembatan',
  'jalan',
  'sekolah',
  'gedung',
  'rumah_sakit',
  'kantor_pemerintah',
  'jaringan_listrik',
  'jaringan_air',
  'tanggul',
  'irigasi',
  'prasarana_publik',
  'utilitas',
  'lainnya',
];
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
  'unverifiable',
  'unverifiable_reason',
];

const PUBLIC_SELECT = PUBLIC_COLUMNS.join(', ');

// vital_status disimpan sebagai string JSON array (File 1 Bagian 6.8.4),
// dikembalikan API sebagai array agar frontend mudah merender badge/tag.
// photo_urls juga disimpan sebagai string JSON array (laporan dari media),
// dikembalikan sebagai array agar frontend bisa merender foto.
// related_earthquake / related_weather disimpan sebagai string JSON objek
// hasil enrichment BMKG (File 1 5.8 / File 2 7.2) — dikembalikan sebagai
// objek agar frontend bisa merender badge kontekstual.
function parseVitalStatus(row) {
  if (!row) return row;
  if (row.vital_status !== null && row.vital_status !== undefined) {
    try {
      row.vital_status = JSON.parse(row.vital_status);
    } catch (_e) {
      // Nilai lama yang bukan JSON valid: biarkan apa adanya.
    }
  }
  if (typeof row.photo_urls === 'string' && row.photo_urls !== '') {
    try {
      row.photo_urls = JSON.parse(row.photo_urls);
    } catch (_e) {
      // Nilai lama yang bukan JSON valid: biarkan apa adanya.
    }
  }
  for (const key of ['related_earthquake', 'related_weather']) {
    if (typeof row[key] === 'string' && row[key] !== '') {
      try {
        row[key] = JSON.parse(row[key]);
      } catch (_e) {
        // Bukan JSON valid: biarkan string mentah (frontend menangani).
      }
    }
  }
  return row;
}

// GET /api/reports
// Mengambil laporan dengan dukungan filter & sorting (File 1 Bagian 7.4):
//   severity, infra_type, bridge_authority, status, vital_status (semua
//   multi-value, boleh diulang atau comma-separated; OR antar nilai),
//   since (created_at >= since), q (pencarian nama lokasi, LIKE),
//   sort (created_at | updated_at | severity | location_name | status),
//   order (asc | desc).
// Parameter yang tidak dikirim = tanpa filter tersebut (semua data).
// Sorting default: created_at desc (perilaku asli sebelum filter ada).

// Nilai enum status laporan (File 1 Bagian 6.2).
const STATUSES = ['dilaporkan', 'terverifikasi', 'dalam_perbaikan', 'selesai_diperbaiki'];

// Urutan alur status (File 1 Bagian 6.2): hanya boleh maju satu arah —
// dilaporkan -> terverifikasi -> dalam_perbaikan -> selesai_diperbaiki.
const STATUS_ORDER = { dilaporkan: 1, terverifikasi: 2, dalam_perbaikan: 3, selesai_diperbaiki: 4 };

// Kolom yang boleh dipakai sebagai sort (whitelist; selain ini 400).
const SORT_COLUMNS = ['created_at', 'updated_at', 'severity', 'location_name', 'status'];

// Normalisasi query param multi-value: string tunggal, array, atau
// comma-separated semuanya menjadi array bersih.
function toArray(value) {
  if (value === undefined || value === null) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.flatMap((x) => String(x).split(',').map((s) => s.trim())).filter(Boolean);
}

// since berupa tanggal 'YYYY-MM-DD' disetarakan ke awal hari agar laporan
// di tanggal itu ikut termasuk (string compare dengan format UTC SQLite).
function normalizeSince(since) {
  const s = String(since).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;
  return s;
}

router.get('/', (req, res) => {
  const q = req.query;

  // ---- Validasi nilai yang tidak dikenal -> 400 (pesan jelas) ----
  const bad = (param, allowed) => {
    const unknown = toArray(q[param]).filter((v) => !allowed.includes(v));
    return unknown.length > 0 ? `${param} tidak dikenal: ${unknown.join(', ')}` : null;
  };
  const badSeverity = bad('severity', SEVERITIES);
  const badInfra = bad('infra_type', INFRA_TYPES);
  const badAuthority = bad('bridge_authority', BRIDGE_AUTHORITIES);
  const badStatus = bad('status', STATUSES);
  const badVital = bad('vital_status', VITAL_STATUSES);
  const badSort =
    q.sort !== undefined && q.sort !== null && q.sort !== '' && !SORT_COLUMNS.includes(q.sort)
      ? `sort tidak dikenal: ${q.sort} (pilihan: ${SORT_COLUMNS.join(', ')})`
      : null;
  const badOrder =
    q.order !== undefined && q.order !== null && q.order !== '' && !['asc', 'desc'].includes(q.order)
      ? `order tidak dikenal: ${q.order} (pilihan: asc, desc)`
      : null;
  const invalid = [badSeverity, badInfra, badAuthority, badStatus, badVital, badSort, badOrder].filter(Boolean);
  if (invalid.length > 0) {
    return res.status(400).json({ error: invalid.join('; ') });
  }

  // ---- Susun WHERE dinamis (prepared statement, aman dari injection) ----
  const severity = toArray(q.severity);
  const infraType = toArray(q.infra_type);
  const authority = toArray(q.bridge_authority);
  const status = toArray(q.status);
  const vital = toArray(q.vital_status);

  const clauses = [];
  const args = [];
  const placeholders = (n) => new Array(n).fill('?').join(', ');

  if (severity.length > 0) {
    clauses.push(`severity IN (${placeholders(severity.length)})`);
    args.push(...severity);
  }
  if (infraType.length > 0) {
    clauses.push(`infra_type IN (${placeholders(infraType.length)})`);
    args.push(...infraType);
  }
  if (authority.length > 0) {
    clauses.push(`bridge_authority IN (${placeholders(authority.length)})`);
    args.push(...authority);
  }
  if (status.length > 0) {
    clauses.push(`status IN (${placeholders(status.length)})`);
    args.push(...status);
  }
  if (vital.length > 0) {
    // vital_status tersimpan sebagai JSON array string (File 1 Bagian
    // 6.8.4). SQLite tidak punya operator array native, jadi gunakan
    // pencocokan string pada kolom JSON: nilai tunggal selalu dirender
    // sebagai "nilai" (dengan tanda kutip ganda) oleh JSON.stringify.
    // OR antar nilai: laporan yang mengandung setidaknya satu nilai.
    clauses.push(`(${vital.map(() => 'vital_status LIKE ?').join(' OR ')})`);
    vital.forEach((v) => args.push(`%"${v}"%`));
  }
  if (q.since !== undefined && q.since !== null && q.since !== '') {
    clauses.push('created_at >= ?');
    args.push(normalizeSince(q.since));
  }
  if (q.q !== undefined && q.q !== null && String(q.q).trim() !== '') {
    clauses.push('location_name LIKE ?');
    args.push(`%${String(q.q).trim()}%`);
  }

  // ---- Sorting (File 1 Bagian 6.8.10) ----
  const sort = SORT_COLUMNS.includes(q.sort) ? q.sort : 'created_at';
  const order = q.order === 'asc' ? 'ASC' : 'DESC';
  let orderBy;
  if (sort === 'severity') {
    // severity disimpan sebagai TEXT ('ringan'..'ambruk'), bukan angka —
    // ORDER BY alfabet biasa salah (ambruk < berat < ringan < sedang).
    // Petakan tiap nilai ke angka urutan sebelum mengurutkan.
    orderBy =
      `CASE severity WHEN 'ringan' THEN 1 WHEN 'sedang' THEN 2 ` +
      `WHEN 'berat' THEN 3 WHEN 'ambruk' THEN 4 ELSE 0 END ${order}`;
  } else {
    orderBy = `${sort} ${order}`;
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT ${PUBLIC_SELECT} FROM reports ${whereSql} ` +
        `ORDER BY ${orderBy}, created_at DESC, id DESC`
    )
    .all(...args);

  res.json(rows.map(parseVitalStatus));
});

// POST /api/reports
// Menyimpan laporan baru. Rate limiting (File 1 Bagian 11.3): pada tahap
// ini seluruh POST dianggap tanpa verifikasi e.id, sehingga limiter
// diterapkan tanpa kondisi (File 2 Bagian 6.3). Belum ada verifikasi e.id.
//
// Enrichment BMKG (File 2 Bagian 7.2 / File 1 Bagian 5.8): setelah
// tersimpan, dicari gempa terkait (radius 100 km, 30 hari terakhir) dan
// prakiraan cuaca lokasi (adm4 terdekat) secara BEST-EFFORT — hasilnya
// disimpan ke related_earthquake / related_weather bila ada; kegagalan
// enrichment TIDAK pernah menggagalkan penyimpanan laporan.
router.post('/', reportLimiter, async (req, res) => {
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

  // vital_status_note: wajib jika 'lainnya' dipilih (File 1 Bagian 6.8.4),
  // dikirim oleh ReportForm sebagai string bebas.
  const vital_status_note =
    body.vital_status_note !== undefined && body.vital_status_note !== null &&
    String(body.vital_status_note).trim() !== ''
      ? String(body.vital_status_note).trim()
      : null;
  if (vital_status && vital_status.includes('lainnya') && !vital_status_note) {
    errors.push('vital_status_note wajib diisi saat Lainnya dipilih');
  }
  if (vital_status_note && vital_status_note.length > 1000) {
    errors.push('vital_status_note maksimal 1000 karakter');
  }

  const location_name = typeof body.location_name === 'string' && body.location_name.trim() !== '' ? body.location_name.trim() : null;
  if (!location_name) errors.push('location_name wajib diisi');
  else if (location_name.length > 300) errors.push('location_name maksimal 300 karakter');

  const lat = Number(body.lat);
  if (body.lat === undefined || body.lat === null || body.lat === '' || !Number.isFinite(lat)) {
    errors.push('lat wajib diisi berupa angka');
  } else if (lat < -90 || lat > 90) {
    errors.push('lat di luar rentang valid (-90 s.d. 90)');
  }

  const lng = Number(body.lng);
  if (body.lng === undefined || body.lng === null || body.lng === '' || !Number.isFinite(lng)) {
    errors.push('lng wajib diisi berupa angka');
  } else if (lng < -180 || lng > 180) {
    errors.push('lng di luar rentang valid (-180 s.d. 180)');
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  // description opsional (File 1 Bagian 5.2 langkah kelima)
  const description = body.description !== undefined && body.description !== null
    ? String(body.description)
    : null;
  if (description && description.length > 5000) {
    return res.status(400).json({ error: 'description maksimal 5000 karakter' });
  }

  // Hasil verifikasi e.id dari frontend (File 1 Bagian 5.2 langkah 4a).
  // reporter_display_name opsional; reporter_is_verified true hanya jika
  // pengguna menyelesaikan alur verifikasi e.id. Catatan: verifikasi
  // penuh sisi server (mencocokkan holder_did dengan sesi) menyusul di
  // langkah berikutnya — untuk sekarang flag dikirim klien.
  const reporter_display_name =
    body.reporter_display_name !== undefined && body.reporter_display_name !== null &&
    String(body.reporter_display_name).trim() !== ''
      ? String(body.reporter_display_name).trim()
      : null;
  if (reporter_display_name && reporter_display_name.length > 120) {
    return res.status(400).json({ error: 'reporter_display_name maksimal 120 karakter' });
  }
  const reporter_is_verified = body.reporter_is_verified === true ? 1 : 0;

  // Foto laporan (opsional): array string — URL publik atau data URL
  // hasil kompresi di frontend. Maksimal 5; data URL divalidasi isi
  // byte-nya (magic bytes gambar asli, SVG/HTML ditolak) + scan ClamAV
  // bila tersedia (lib/uploadGuard.js — proteksi upload 2 Sep 2026).
  let photo_urls = null;
  if (Array.isArray(body.photo_urls) && body.photo_urls.length > 0) {
    const guarded = await guardPhotos(body.photo_urls);
    if (guarded.errors.length > 0) {
      return res.status(422).json({ error: `Foto ditolak: ${guarded.errors[0]}` });
    }
    if (guarded.photos.length > 0) photo_urls = JSON.stringify(guarded.photos);
  }

  const stmt = db.prepare(`
    INSERT INTO reports (
      infra_type, severity, bridge_authority, vital_status, vital_status_note,
      location_name, lat, lng, description, photo_urls,
      reporter_display_name, reporter_is_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    infra_type,
    severity,
    bridge_authority || 'tidak_diketahui',
    JSON.stringify(vital_status),
    vital_status_note,
    location_name,
    lat,
    lng,
    description,
    photo_urls,
    reporter_display_name,
    reporter_is_verified
  );

  // ---- Enrichment BMKG best-effort (File 2 7.2 / File 1 5.8) ----
  // Tidak boleh melempar: seluruh pemanggilan dibungkus try/catch, dan
  // bmkgClient sendiri mengembalikan null pada kegagalan apa pun.
  let related_earthquake = null;
  let related_weather = null;
  try {
    const reportDate = new Date().toISOString();
    const [eq, wx] = await Promise.all([
      bmkg.enrichEarthquake({ lat, lng, date: reportDate }),
      bmkg.enrichWeather({ lat, lng }),
    ]);
    related_earthquake = eq;
    related_weather = wx;
    if (eq || wx) {
      db.prepare(
        `UPDATE reports SET related_earthquake = ?, related_weather = ?,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(
        eq ? JSON.stringify(eq) : null,
        wx ? JSON.stringify(wx) : null,
        info.lastInsertRowid
      );
    }
  } catch (_e) {
    // enrichment gagal -> biarkan field null, laporan tetap tersimpan.
  }

  const created = db
    .prepare(`SELECT ${PUBLIC_SELECT} FROM reports WHERE id = ?`)
    .get(info.lastInsertRowid);

  res.status(201).json(parseVitalStatus(created));
});

// PATCH /api/reports/:id/status
// Tindakan otoritas: mengubah status laporan mengikuti alur maju
// (File 1 Bagian 6.2): dilaporkan -> terverifikasi -> dalam_perbaikan ->
// selesai_diperbaiki. Transisi mundur ditolak. Saat menjadi
// 'terverifikasi', identitas otoritas dicatat di validated_by_display_name
// dan waktu validasi di validated_at; setiap perubahan tercatat di tabel
// status_history (File 1 Bagian 6.4).
// Body: { status, changed_by_display_name? }
router.patch('/:id/status', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  }
  const existing = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  }

  const body = req.body || {};
  const status = typeof body.status === 'string' ? body.status : null;
  if (!status || !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status harus salah satu dari: ${STATUSES.join(', ')}` });
  }
  if (status === existing.status) {
    return res.status(400).json({ error: `Laporan sudah berstatus ${STATUSES.find((s) => s === status)}` });
  }
  if (STATUS_ORDER[status] < STATUS_ORDER[existing.status]) {
    return res.status(400).json({
      error: `Transisi status tidak valid: ${existing.status} -> ${status} (status tidak bisa mundur)`,
    });
  }

  const changedByName =
    body.changed_by_display_name !== undefined && body.changed_by_display_name !== null &&
    String(body.changed_by_display_name).trim() !== ''
      ? String(body.changed_by_display_name).trim()
      : null;

  const tx = db.transaction(() => {
    if (status === 'terverifikasi') {
      // Catat siapa yang memvalidasi dan kapan (File 1 Bagian 6.2).
      db.prepare(
        `UPDATE reports SET status = ?, validated_by_display_name = COALESCE(?, validated_by_display_name),
         validated_at = COALESCE(validated_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(status, changedByName, id);
    } else {
      db.prepare('UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        status,
        id
      );
    }
    db.prepare(
      'INSERT INTO status_history (report_id, new_status, changed_by_display_name) VALUES (?, ?, ?)'
    ).run(id, status, changedByName);
  });
  tx();

  const updated = db
    .prepare(`SELECT ${PUBLIC_SELECT} FROM reports WHERE id = ?`)
    .get(id);
  res.json(parseVitalStatus(updated));
});

// POST /api/reports/:id/vote
// Dukungan warga terhadap laporan (File 1 Bagian 6.3): menambah vote_count
// dan mencatat baris di tabel votes. Dukungan hanya dapat diberikan oleh
// warga terverifikasi e.id (voter_is_verified). voter_did diisi identitas
// tampilan (nama/alias) sebagai pengganti sementara — pencocokan penuh
// holder_did<->sesi menyusul di langkah berikutnya (sama seperti
// reporter_display_name pada POST /api/reports).
// Body: { voter_display_name?, voter_is_verified }
router.post('/:id/vote', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  }
  const existing = db.prepare('SELECT id FROM reports WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  }

  const body = req.body || {};
  if (body.voter_is_verified !== true) {
    return res.status(403).json({
      error: 'Dukungan hanya dapat diberikan oleh warga terverifikasi e.id',
    });
  }
  const voterDisplayName =
    body.voter_display_name !== undefined && body.voter_display_name !== null &&
    String(body.voter_display_name).trim() !== ''
      ? String(body.voter_display_name).trim()
      : null;
  const voterDid = voterDisplayName || 'anonim';

  try {
    const tx = db.transaction(() => {
      db.prepare('INSERT INTO votes (report_id, voter_did) VALUES (?, ?)').run(id, voterDid);
      db.prepare(
        'UPDATE reports SET vote_count = vote_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(id);
    });
    tx();
  } catch (err) {
    // UNIQUE(report_id, voter_did): satu identitas hanya boleh mendukung
    // sekali per laporan.
    if (err && typeof err.code === 'string' && err.code.includes('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'Laporan ini sudah didukung oleh identitas yang sama' });
    }
    throw err;
  }

  const updated = db
    .prepare(`SELECT ${PUBLIC_SELECT} FROM reports WHERE id = ?`)
    .get(id);
  res.status(201).json(parseVitalStatus(updated));
});

module.exports = router;
