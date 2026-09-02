// backend/db/db.js
// Wrapper koneksi better-sqlite3
// Membuat seluruh tabel secara otomatis jika belum ada (CREATE TABLE IF NOT EXISTS)
// Sesuai File 1 Bagian 6.2-6.6 dan File 2 Bagian 5.12

'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'reports.db');

const db = new Database(DB_PATH);

// Aktifkan WAL mode untuk performa baca/tulis bersamaan yang lebih baik
db.pragma('journal_mode = WAL');

// Aktifkan foreign key enforcement (SQLite menonaktifkannya secara default)
db.pragma('foreign_keys = ON');

// ============================================================
// Inisialisasi skema: buat tabel jika belum ada
// Urutan sesuai File 1 Bagian 6.2-6.6
// ============================================================

db.exec(`
  -- ============================================================
  -- Tabel reports (File 1 Bagian 6.2)
  -- ============================================================
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    infra_type TEXT NOT NULL CHECK(infra_type IN
      ('jembatan','jalan','sekolah','prasarana_publik','utilitas','lainnya')),
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
  );

  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
  CREATE INDEX IF NOT EXISTS idx_reports_infra_type ON reports(infra_type);
  CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(lat, lng);

  -- ============================================================
  -- Tabel votes (File 1 Bagian 6.3)
  -- ============================================================
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    voter_did TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_id, voter_did)
  );

  -- ============================================================
  -- Tabel status_history (File 1 Bagian 6.4)
  -- ============================================================
  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    new_status TEXT NOT NULL CHECK(new_status IN
      ('dilaporkan','terverifikasi','dalam_perbaikan','selesai_diperbaiki')),
    changed_by_display_name TEXT,
    changed_by_did TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- ============================================================
  -- Tabel fix_claims: klaim warga "titik sudah diperbaiki" (fitur
  -- 2 Sep 2026) — WAJIB lampirkan foto bukti; masuk antrean otoritas
  -- untuk diverifikasi; otoritas 'terima' -> status selesai_diperbaiki
  -- (hijau) / 'tolak' -> klaim ditolak, titik tetap.
  -- ============================================================
  CREATE TABLE IF NOT EXISTS fix_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    claimed_by_did TEXT,
    claimed_by_display_name TEXT,
    photo_urls TEXT NOT NULL DEFAULT '[]',
    note TEXT,
    status TEXT NOT NULL DEFAULT 'menunggu' CHECK(
      status IN ('menunggu','diterima','ditolak')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME,
    decided_by_did TEXT,
    decided_by_display_name TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_fix_claims_report ON fix_claims(report_id);
  CREATE INDEX IF NOT EXISTS idx_fix_claims_status ON fix_claims(status);

  CREATE INDEX IF NOT EXISTS idx_status_history_report ON status_history(report_id);

  -- ============================================================
  -- Tabel verification_sessions (File 1 Bagian 6.5)
  -- ============================================================
  CREATE TABLE IF NOT EXISTS verification_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    schema_type TEXT NOT NULL CHECK(schema_type IN ('warga','otoritas')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN
      ('pending','approved','expired','rejected')),
    holder_did TEXT,
    holder_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
  );

  -- ============================================================
  -- Tabel admins (File 1 Bagian 6.6)
  -- ============================================================
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
