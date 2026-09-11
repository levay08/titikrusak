#!/usr/bin/env node
// backend/scripts/annotate-update-notes.js
// Mengisi/menyegarkan kolom reports.update_note untuk semua titik media
// (lihat services/updateNotes.js): kalimat jujur "sudah ada kabar perbaikan
// atau belum". Idempotent - aman dijalankan berkali-kali, juga otomatis
// dipanggil deploy.sh dan di akhir setiap cycle news-monitor.
//
// Pakai --dry untuk melihat kalimat yang akan ditulis tanpa mengubah DB.
'use strict';

const db = require('../db/db.js');
const { buildNote } = require('../services/updateNotes.js');

const DRY = process.argv.includes('--dry');

if (DRY) {
  const rows = db
    .prepare(
      `SELECT id, location_name, description, media_updates, media_repair_url, media_repair_at,
              status, source_media_date, created_at, related_earthquake, update_note
       FROM reports WHERE source_type = 'media' ORDER BY id`
    )
    .all();
  let ada = 0;
  for (const row of rows) {
    const hasil = buildNote(row, Date.now());
    if (!hasil) continue;
    ada += 1;
    console.log(`#${row.id} [${hasil.type || 'non-bencana'}] ${row.location_name || ''}`);
    console.log(`   ${hasil.note}`);
  }
  console.log(`\n[DRY RUN] ${ada} dari ${rows.length} titik akan punya catatan update.`);
  db.close();
  process.exit(0);
}

const { refreshUpdateNotes } = require('../services/updateNotes.js');
const hasil = refreshUpdateNotes({ log: (s) => console.log(s) });
const contoh = db
  .prepare(
    `SELECT id, disaster_type, update_note FROM reports
      WHERE source_type = 'media' AND update_note IS NOT NULL ORDER BY id LIMIT 5`
  )
  .all();
console.log(`hasil: dipindai ${hasil.scanned} titik, ${hasil.filled} diberi catatan, ${hasil.cleared} dikosongkan, ${hasil.sama} tidak berubah`);
for (const c of contoh) console.log(`  #${c.id} [${c.disaster_type || 'non-bencana'}] ${c.update_note}`);
const total = db
  .prepare("SELECT COUNT(*) AS n FROM reports WHERE source_type = 'media' AND update_note IS NOT NULL")
  .get().n;
console.log(`verifikasi: ${total} titik punya catatan update`);
db.close();
