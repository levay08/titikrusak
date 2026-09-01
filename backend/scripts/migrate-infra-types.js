'use strict';

// backend/scripts/migrate-infra-types.js
// Migrasi skema tabel `reports`: memperluas CHECK constraint infra_type
// dengan jenis granular hasil riset laporan media (gedung, rumah_sakit,
// kantor_pemerintah, jaringan_listrik, jaringan_air, tanggul, irigasi).
// SQLite tidak bisa mengubah CHECK constraint lewat ALTER TABLE, jadi
// tabel dibangun ulang: buat baru -> salin data -> drop lama -> rename.
//
// Aman dijalankan ulang (idempotent): jika CHECK sudah memuat jenis baru,
// skrip selesai tanpa perubahan.

const db = require('../db/db.js');

const NEW_INFRA = [
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

function checkHasNewInfra() {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'reports'")
    .get();
  return row && row.sql.includes('rumah_sakit');
}

if (checkHasNewInfra()) {
  console.log('Skema sudah memuat jenis infrastruktur baru — tidak perlu migrasi.');
  process.exit(0);
}

const CREATE_SQL = `CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    infra_type TEXT NOT NULL CHECK(infra_type IN
      ('jembatan','jalan','sekolah','gedung','rumah_sakit','kantor_pemerintah',
       'jaringan_listrik','jaringan_air','tanggul','irigasi',
       'prasarana_publik','utilitas','lainnya')),
    severity TEXT NOT NULL CHECK(severity IN
      ('ringan','sedang','berat','ambruk')),
    bridge_authority TEXT NOT NULL DEFAULT 'tidak_diketahui' CHECK(
      bridge_authority IN
      ('nasional','provinsi','kabupaten_kota','desa_swadaya','tidak_diketahui')),
    vital_status TEXT NOT NULL,
    vital_status_note TEXT,
    description TEXT,

    location_name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,

    photo_urls TEXT,

    reporter_display_name TEXT,
    reporter_verified_did TEXT,
    reporter_is_verified INTEGER NOT NULL DEFAULT 0,

    validated_by_display_name TEXT,
    validated_by_did TEXT,
    validated_at DATETIME,

    status TEXT NOT NULL DEFAULT 'dilaporkan' CHECK(status IN
      ('dilaporkan','terverifikasi','dalam_perbaikan','selesai_diperbaiki')),

    source_type TEXT NOT NULL DEFAULT 'warga' CHECK(source_type IN
      ('warga','media')),
    source_media_name TEXT,
    source_media_url TEXT,
    source_media_date DATE,

    related_earthquake TEXT,
    related_weather TEXT,

    vote_count INTEGER NOT NULL DEFAULT 0
  )`;

const run = db.transaction(() => {
  const count = db.prepare('SELECT COUNT(*) c FROM reports').get().c;

  db.exec('DROP TABLE IF EXISTS reports_new');
  db.exec(CREATE_SQL.replace('CREATE TABLE reports', 'CREATE TABLE reports_new'));

  // Salin seluruh data lama (urutan kolom sama persis).
  db.exec(
    `INSERT INTO reports_new
       (id, created_at, updated_at, infra_type, severity, bridge_authority,
        vital_status, vital_status_note, description, location_name, lat, lng,
        photo_urls, reporter_display_name, reporter_verified_did,
        reporter_is_verified, validated_by_display_name, validated_by_did,
        validated_at, status, source_type, source_media_name, source_media_url,
        source_media_date, related_earthquake, related_weather, vote_count)
     SELECT id, created_at, updated_at, infra_type, severity, bridge_authority,
        vital_status, vital_status_note, description, location_name, lat, lng,
        photo_urls, reporter_display_name, reporter_verified_did,
        reporter_is_verified, validated_by_display_name, validated_by_did,
        validated_at, status, source_type, source_media_name, source_media_url,
        source_media_date, related_earthquake, related_weather, vote_count
     FROM reports`
  );

  db.exec('DROP TABLE reports');
  db.exec('ALTER TABLE reports_new RENAME TO reports');

  // Bangun ulang indeks yang ikut terhapus.
  db.exec('CREATE INDEX idx_reports_status ON reports(status)');
  db.exec('CREATE INDEX idx_reports_severity ON reports(severity)');
  db.exec('CREATE INDEX idx_reports_infra_type ON reports(infra_type)');
  db.exec('CREATE INDEX idx_reports_location ON reports(lat, lng)');

  console.log(`Migrasi selesai: tabel reports dibangun ulang (${count} baris disalin).`);
});

try {
  run();
} catch (err) {
  console.error('Migrasi gagal:', err.message);
  process.exit(1);
}
