// backend/test/updateNotes.test.js
// UJI catatan update titik (11 Sep 2026): titik akibat bencana alam yang belum
// punya kabar perbaikan mendapat kalimat jujur (banjir sudah surut, perbaikan
// gempa bisa berbulan-bulan), dan catatan OTOMATIS hilang begitu ada kabar
// lanjutan / otoritas bertindak. Berjalan di DB sementara (TK_DB_PATH).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tk-notes-'));
process.env.TK_DB_PATH = path.join(TMP, 'notes.db');

const { test, after } = require('node:test');
const assert = require('node:assert');

const db = require('../db/db.js');
const { detectDisaster, refreshUpdateNotes, LEWAT_HARI, DIAM_HARI } = require('../services/updateNotes.js');

function hariLalu(n) {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
}

function tambah({ description, date, status = 'dilaporkan', updates = null, repair = null }) {
  const info = db
    .prepare(
      `INSERT INTO reports (infra_type, severity, bridge_authority, vital_status, description,
        location_name, lat, lng, source_type, source_media_name, source_media_url, source_media_date,
        media_updates, media_repair_url, status)
       VALUES ('jalan','berat','tidak_diketahui','["akses_ekonomi"]', ?, 'Titik Uji', 0.5, 109.38,
        'media', 'Media Uji', ?, ?, ?, ?, ?)`
    )
    .run(description, `https://contoh.test/${Math.random().toString(16).slice(2)}`, date, updates, repair, status);
  return Number(info.lastInsertRowid);
}

const noteOf = (id) => db.prepare('SELECT update_note, disaster_type FROM reports WHERE id = ?').get(id);

after(() => {
  db.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('deteksi jenis bencana dari teks laporan', () => {
  assert.equal(detectDisaster('Banjir bandang menerjang Kecamatan Karangan'), 'banjir_bandang');
  assert.equal(detectDisaster('Jalan terendam banjir sejak Jumat'), 'banjir');
  assert.equal(detectDisaster('Longsor menutup akses jalan utama'), 'longsor');
  assert.equal(detectDisaster('Bangunan sekolah rusak akibat gempa M7,7'), 'gempa');
  assert.equal(detectDisaster('Kios hangus terbakar'), 'kebakaran');
  assert.equal(detectDisaster('Atap rusak diterjang angin kencang'), 'angin');
  assert.equal(detectDisaster('Jembatan ambruk diterjang arus sungai'), null);
  // data BMKG (related_earthquake) cukup jadi bukti gempa walau judulnya lain.
  assert.equal(detectDisaster('Bangunan roboh', { relatedEarthquake: '{"mag":7.7}' }), 'gempa');
});

test('titik banjir tua: catatan menyebut air sudah surut + belum ada kabar perbaikan', () => {
  const id = tambah({
    description: 'Banjir bandang menerjang Kecamatan Karangan, Landak dan menggenangi ruas jalan utama.',
    date: hariLalu(120),
  });
  refreshUpdateNotes({ log: () => {} });
  const r = noteOf(id);
  assert.equal(r.disaster_type, 'banjir_bandang');
  assert.match(r.update_note, /sudah surut/);
  assert.match(r.update_note, /Belum ada kabar perbaikan/);
  assert.equal(r.update_note.includes('[Update'), false);
});

test('titik gempa tua: catatan menyebut perbaikan biasanya berbulan-bulan', () => {
  const id = tambah({
    description: 'Sekolah rusak berat akibat gempa M7,7 di Laut Flores.',
    date: hariLalu(90),
  });
  refreshUpdateNotes({ log: () => {} });
  const r = noteOf(id);
  assert.equal(r.disaster_type, 'gempa');
  assert.match(r.update_note, /berbulan-bulan/);
});

test('bencana BARU (kurang dari 14 hari) tidak diklaim sudah surut', () => {
  const id = tambah({
    description: 'Banjir merendam jalan utama sejak kemarin.',
    date: hariLalu(LEWAT_HARI - 5),
  });
  refreshUpdateNotes({ log: () => {} });
  const r = noteOf(id);
  assert.equal(r.disaster_type, 'banjir');
  assert.equal(/sudah surut/.test(r.update_note), false, 'bencana baru belum boleh diklaim surut');
  assert.match(r.update_note, /Belum ada kabar perbaikan/);
});

test('kerusakan BUKAN bencana: catatan netral hanya setelah cukup lama diam', () => {
  const tua = tambah({ description: 'Jembatan limpas putus diterjang arus sungai deras.', date: hariLalu(DIAM_HARI + 20) });
  const baru = tambah({ description: 'Jembatan limpas putus diterjang arus sungai deras.', date: hariLalu(5) });
  refreshUpdateNotes({ log: () => {} });
  assert.match(noteOf(tua).update_note, /Belum ada kabar lanjutan sejak pemberitaan pertama/);
  assert.equal(noteOf(tua).disaster_type, null);
  assert.equal(noteOf(baru).update_note, null, 'berita baru belum perlu catatan');
});

test('catatan HILANG begitu ada kabar lanjutan, klaim media, atau otoritas bertindak', () => {
  const ada = tambah({
    description: 'Banjir bandang merendam jalan.',
    date: hariLalu(100),
    updates: JSON.stringify([{ at: hariLalu(3), title: 'Jalan Diperbaiki', source: 'Antara', url: 'https://x/1' }]),
  });
  const klaim = tambah({
    description: 'Banjir bandang merendam jalan.',
    date: hariLalu(100),
    repair: 'https://contoh.test/diperbaiki',
  });
  const otoritas = tambah({
    description: 'Banjir bandang merendam jalan.',
    date: hariLalu(100),
    status: 'terverifikasi',
  });
  const selesai = tambah({
    description: 'Banjir bandang merendam jalan.',
    date: hariLalu(100),
    status: 'selesai_diperbaiki',
  });
  refreshUpdateNotes({ log: () => {} });
  assert.equal(noteOf(ada).update_note, null, 'sudah ada kabar lanjutan');
  assert.equal(noteOf(klaim).update_note, null, 'sudah ada klaim perbaikan media');
  assert.equal(noteOf(otoritas).update_note, null, 'otoritas sudah memverifikasi');
  assert.equal(noteOf(selesai).update_note, null, 'titik sudah selesai');
});

test('idempotent: jalan ulang tidak mengubah apa pun dan tidak menyentuh updated_at', () => {
  const id = tambah({ description: 'Banjir bandang merendam jalan utama.', date: hariLalu(80) });
  refreshUpdateNotes({ log: () => {} });
  const sebelum = db.prepare('SELECT update_note, updated_at FROM reports WHERE id = ?').get(id);
  const hasil = refreshUpdateNotes({ log: () => {} });
  const sesudah = db.prepare('SELECT update_note, updated_at FROM reports WHERE id = ?').get(id);
  assert.equal(hasil.filled, 0);
  assert.equal(hasil.cleared, 0);
  assert.equal(sesudah.update_note, sebelum.update_note);
  assert.equal(sesudah.updated_at, sebelum.updated_at, 'updated_at tidak boleh disentuh (feed Kabar Media)');
});
