#!/usr/bin/env node
// backend/scripts/repair-media-notes.js
// Membersihkan deskripsi titik media dari catatan riwayat "[Update ...]" dan
// memindahkannya ke kolom reports.media_updates (JSON). Idempotent.
//
// Sejak 11 Sep 2026 riwayat update TIDAK lagi ditulis ke deskripsi (lihat
// services/newsMonitor.js) - skrip ini membereskan baris yang terlanjur:
//   1. pecah deskripsi -> teks asli + daftar catatan;
//   2. catatan yang JUDULNYA TIDAK LAGI COCOK dengan titik itu (diuji ulang
//      memakai matchScore yang sudah diperbaiki) dibuang sebagai "nyasar" -
//      inilah yang membersihkan #101 dari berita Wonogiri/Nisel;
//   3. catatan sah & tidak duplikat dipindah ke media_updates;
//   4. deskripsi dikembalikan ke teks aslinya (rapi, tanpa catatan).
//
// Pakai --dry untuk melihat rencana tanpa mengubah DB.
'use strict';

const db = require('../db/db.js');
const fs = require('fs');
const path = require('path');
const {
  LEGACY_NOTE_RE,
  detectLocations,
  matchScore,
  noteKey,
  parseMediaUpdates,
  rowTextOf,
} = require('../services/newsMonitor.js');

const DRY = process.argv.includes('--dry');
// Catatan yang dibuang TIDAK hilang begitu saja: disimpan sebagai berkas
// arsip agar masih bisa ditelusuri (tidak ditampilkan di situs).
const REJECT_FILE = path.join(__dirname, '..', 'data', 'rejected-media-notes.json');

// Sumber berita titik juga bisa ikut tertimpa artikel nyasar (monitor menimpa
// source_media_* saat update). Sumber ASLI dipulihkan dari berkas seed resmi
// repo (location_name + deskripsi cocok = objek yang sama); bila tidak ada di
// seed, sumber yang salah DIKOSONGKAN supaya tidak menyesatkan.
function loadSeedOriginals() {
  const map = new Map();
  for (const f of ['media-reports.json', 'media-reports-pra-2026.json']) {
    let arr = [];
    try {
      const j = JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
      arr = Array.isArray(j) ? j : [j];
    } catch (_e) {
      continue;
    }
    for (const e of arr) {
      if (!e || !e.location_name) continue;
      map.set(`${e.location_name}||${String(e.description || '').trim()}`, e);
    }
  }
  return map;
}
const SEED_ORIGINALS = loadSeedOriginals();

function splitNotes(desc) {
  const s = String(desc || '');
  const segs = [];
  LEGACY_NOTE_RE.lastIndex = 0;
  let m;
  let baseEnd = -1;
  while ((m = LEGACY_NOTE_RE.exec(s)) !== null) {
    if (baseEnd < 0) baseEnd = m.index;
    segs.push(m[0]);
  }
  if (segs.length === 0) return { base: s.trim(), notes: [] };
  return { base: s.slice(0, baseEnd).trim(), notes: segs };
}

// "[Update 2026-09-11: judul - sumber]" -> { at, title, source }
function parseNote(seg) {
  const m = String(seg).match(/\[Update (\d{4}-\d{2}-\d{2}): ([\s\S]*?)\]$/);
  if (!m) return null;
  const inner = m[2].trim();
  const dash = inner.lastIndexOf(' - ');
  const title = dash > 0 ? inner.slice(0, dash).trim() : inner;
  const source = dash > 0 ? inner.slice(dash + 3).trim() : '';
  return { at: m[1], title, source, url: '' };
}

const rows = db
  .prepare("SELECT id, description, media_updates, location_name, infra_type, severity, status, source_media_name, source_media_url, source_media_date FROM reports WHERE source_type = 'media' ORDER BY id")
  .all();

let touched = 0;
let moved = 0;
let dropped = 0;
const rejected = [];

for (const row of rows) {
  const { base, notes } = splitNotes(row.description);
  if (notes.length === 0) continue;

  // Baris bersih (tanpa catatan) dipakai untuk menguji ulang relevansi tiap
  // judul berita memakai aturan pencocokan yang sudah diperbaiki.
  const cleanRow = { ...row, description: base };
  const kept = parseMediaUpdates(row.media_updates);
  const seen = new Set(kept.map((n) => noteKey(n)));
  const droppedHere = [];
  const droppedNotes = [];

  for (const seg of notes) {
    const note = parseNote(seg);
    if (!note) continue;
    const cocok = matchScore(cleanRow, note.title, detectLocations(note.title));
    if (!cocok) {
      droppedHere.push(note.title);
      droppedNotes.push(note);
      rejected.push({ report_id: row.id, location_name: row.location_name, ...note });
      dropped += 1;
      continue;
    }
    const key = noteKey(note);
    if (!key || seen.has(key)) continue; // duplikat (beda besar-kecil huruf)
    seen.add(key);
    kept.push({ at: note.at, title: note.title, source: note.source, url: note.url });
    moved += 1;
  }

  const updatesJson = JSON.stringify(kept.slice(-20));
  // Sumber tertimpa? Nama sumber titik sama dengan sumber salah satu catatan
  // yang dibuang = sumber itu berasal dari artikel nyasar.
  const srcDariNyasar = Boolean(row.source_media_name)
    && droppedNotes.some((n) => (n.source || '').toLowerCase() === String(row.source_media_name).toLowerCase());
  let srcAksi = 'tetap';
  let srcPatch = null;
  if (srcDariNyasar) {
    const asli = SEED_ORIGINALS.get(`${row.location_name}||${base}`);
    if (asli && asli.source_name) {
      srcAksi = `dipulihkan ke ${asli.source_name}`;
      srcPatch = { name: asli.source_name, url: asli.source_url || null, date: asli.source_date || null };
    } else {
      // Nama/tanggal sumber salah -> dikosongkan (tidak tampil di situs),
      // TAPI URL-nya dipertahankan supaya artikel itu tidak pernah masuk lagi
      // sebagai titik baru (guard anti-duplikat memakai source_media_url).
      srcAksi = `dikosongkan (sumber salah: ${row.source_media_name})`;
      srcPatch = { name: null, url: row.source_media_url, date: null };
    }
  }
  touched += 1;
  console.log(`#${row.id} ${row.location_name.slice(0, 55)}`);
  console.log(`   deskripsi: ${String(row.description).length} -> ${base.length} karakter (catatan ${notes.length} dibuang dari teks)`);
  console.log(`   riwayat  : ${kept.length} catatan sah tersimpan, ${droppedHere.length} catatan nyasar dibuang`);
  if (srcAksi !== 'tetap') console.log(`   sumber   : ${srcAksi}`);
  for (const t of droppedHere) console.log(`     - NYASAR: ${t.slice(0, 90)}`);
  if (!DRY) {
    if (srcPatch) {
      db.prepare(
        'UPDATE reports SET description = ?, media_updates = ?, source_media_name = ?, source_media_url = ?, source_media_date = ? WHERE id = ?'
      ).run(base, updatesJson, srcPatch.name, srcPatch.url, srcPatch.date, row.id);
    } else {
      db.prepare('UPDATE reports SET description = ?, media_updates = ? WHERE id = ?').run(base, updatesJson, row.id);
    }
  }
}

// Titik yang deskripsinya sudah bersih tapi belum punya media_updates -> biarkan
// (tidak ada riwayat yang perlu dipindah).
console.log(`\n${DRY ? '[DRY RUN] ' : ''}${touched} titik dibersihkan | ${moved} catatan valid dipindah ke media_updates | ${dropped} catatan nyasar dibuang`);
if (DRY) {
  console.log('Jalankan tanpa --dry untuk menerapkan.');
} else {
  try {
    fs.mkdirSync(path.dirname(REJECT_FILE), { recursive: true });
    fs.writeFileSync(
      REJECT_FILE,
      JSON.stringify({ dibuat: new Date().toISOString(), jumlah: rejected.length, catatan: rejected }, null, 1)
    );
    console.log(`arsip   : ${rejected.length} catatan nyasar disimpan di ${REJECT_FILE}`);
  } catch (err) {
    console.warn(`arsip catatan nyasar gagal ditulis: ${err.message}`);
  }
  const sisa = db
    .prepare("SELECT COUNT(*) AS n FROM reports WHERE description LIKE '%[Update %'")
    .get().n;
  console.log(`verifikasi: ${sisa} deskripsi masih memuat catatan [Update] (harus 0)`);
}
db.close();
