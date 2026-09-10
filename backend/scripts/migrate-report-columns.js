#!/usr/bin/env node
// backend/scripts/migrate-report-columns.js
// Migrasi idempotent (9 Sep 2026):
//   - reports.is_new_seed        : 1 = titik baru/diperbarui pada CYCLE MONITOR
//                                  terakhir (tanda "BARU" di notifikasi; direset
//                                  di awal setiap cycle berikutnya).
//   - reports.claim_fixed_count  : jumlah warga yang melaporkan titik SUDAH
//                                  DIPERBAIKI (terpisah dari vote dukungan).
//   - reports.claim_gone_count   : jumlah warga yang melaporkan titik SUDAH
//                                  TIDAK ADA / hilang.
//   - tabel status_claims        : dedupe 1 klaim per identitas per jenis.
// Aman diulang: kolom dicek dulu sebelum ALTER.
'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB = path.join(__dirname, '..', 'reports.db');
const db = new Database(DB);

const cols = db.prepare('PRAGMA table_info(reports)').all().map((c) => c.name);

const ADD = [
  ['is_new_seed', 'INTEGER NOT NULL DEFAULT 0'],
  ['claim_fixed_count', 'INTEGER NOT NULL DEFAULT 0'],
  ['claim_gone_count', 'INTEGER NOT NULL DEFAULT 0'],
];

let changed = 0;
for (const [name, def] of ADD) {
  if (cols.includes(name)) {
    console.log(`- kolom ${name}: sudah ada`);
    continue;
  }
  db.prepare(`ALTER TABLE reports ADD COLUMN ${name} ${def}`).run();
  console.log(`+ kolom ${name} ditambahkan`);
  changed += 1;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS status_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('diperbaiki','hilang')),
    claimer_did TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_id, kind, claimer_did)
  )
`);
console.log('- tabel status_claims: siap');

// Verifikasi cepat
const c = db.prepare('PRAGMA table_info(reports)').all().map((x) => x.name);
console.log(`OK: ${ADD.every(([n]) => c.includes(n)) ? 'kolom lengkap' : 'KOLOM BELUM LENGKAP'} | perubahan: ${changed}`);
db.close();
