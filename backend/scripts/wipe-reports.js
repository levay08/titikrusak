'use strict';

// backend/scripts/wipe-reports.js
// Hapus SEMUA baris laporan (source_type apa pun: media + warga) beserta
// relasinya (votes, status_history - ON DELETE CASCADE), lalu reset urutan
// id. Dipakai saat regenerasi penuh data media dari media-reports.json
// (kurasi: buang laporan dummy warga & entri media di luar 2025-2026).
//
// Jalankan SEBELUM seed-media-reports.js. Berbahaya - hanya untuk
// regenerasi data yang disengaja.

const db = require('../db/db.js');

const before = db.prepare('SELECT COUNT(*) c FROM reports').get().c;
const beforeMedia = db.prepare("SELECT COUNT(*) c FROM reports WHERE source_type = 'media'").get().c;

db.prepare('DELETE FROM reports').run();
// Reset autoincrement agar id laporan media baru mulai dari 1 (rapi).
try {
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'reports'").run();
} catch (_e) {
  // tabel sqlite_sequence mungkin tidak ada - abaikan
}

const after = db.prepare('SELECT COUNT(*) c FROM reports').get().c;
console.log(`wipe selesai: ${before} laporan dihapus (${beforeMedia} media, ${before - beforeMedia} non-media); sisa: ${after}`);
