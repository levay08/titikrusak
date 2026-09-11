// backend/test/newsMonitorUpdate.test.js
// UJI TULIS riwayat update berita (perbaikan 11 Sep 2026): update TIDAK lagi
// ditulis ke kolom description - deskripsi titik tetap laporan aslinya - dan
// riwayatnya tersimpan di kolom media_updates (JSON) tanpa duplikat.
// Berjalan di DB sementara (TK_DB_PATH) supaya tidak menyentuh data dev.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { tmpdir } = os;

const TMP = fs.mkdtempSync(path.join(tmpdir(), 'tk-mon-'));
const DB_FILE = path.join(TMP, 'mon.db');
process.env.TK_DB_PATH = DB_FILE;

const { test, after } = require('node:test');
const assert = require('node:assert');

const { applyUpdate, parseMediaUpdates } = require('../services/newsMonitor.js');
const db = require('../db/db.js');

const DESC_ASLI =
  'Banjir bandang menerjang Kecamatan Karangan, Landak sejak Jumat (9/1/2026) dan menggenangi ruas jalan utama penghubung Landak-Bengkayang menuju PLBN Jagoi Babang dengan arus deras.';

function buatTitik() {
  const info = db
    .prepare(
      `INSERT INTO reports (infra_type, severity, bridge_authority, vital_status, description,
        location_name, lat, lng, source_type, source_media_name, source_media_url, source_media_date, status)
       VALUES ('jalan','berat','tidak_diketahui','["akses_ekonomi"]', ?,
        'Jalan utama Kecamatan Karangan, Kabupaten Landak, Kalimantan Barat', 0.558, 109.38,
        'media', 'Kompas.com', 'https://regional.kompas.com/read/landak', '2026-01-09', 'dilaporkan')`
    )
    .run(DESC_ASLI);
  const id = Number(info.lastInsertRowid);
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
}

const LOG = () => {};

after(() => {
  db.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('update berita menambah riwayat di media_updates TANPA menyentuh deskripsi', async () => {
  const row = buatTitik();
  const item = {
    title: 'Jalan Penghubung Landak-Bengkayang Mulai Diperbaiki',
    source: 'Antara Kalbar',
    link: 'https://kabar.example/landak-diperbaiki',
    pubDate: '2026-09-11',
  };
  const applied = await applyUpdate(row, item, { kind: 'progres', log: LOG });
  assert.notEqual(applied, false, 'update pertama harus diterapkan');

  const after1 = db.prepare('SELECT * FROM reports WHERE id = ?').get(row.id);
  // KUNCI: deskripsi tetap laporan aslinya, tidak ada catatan menempel.
  assert.equal(after1.description, DESC_ASLI);
  assert.equal(after1.description.includes('[Update'), false);
  assert.equal(after1.description.includes(item.title), false);
  // Riwayat tersimpan rapi di kolom media_updates.
  const notes = parseMediaUpdates(after1.media_updates);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, item.title);
  assert.equal(notes[0].source, 'Antara Kalbar');
  assert.equal(notes[0].url, item.link);
  // Sumber titik ikut diperbarui karena artikel menyebut Landak (tempatnya sama).
  assert.equal(after1.source_media_name, 'Antara Kalbar');
});

test('berita sama (beda besar-kecil huruf sumber) tidak dicatat dua kali', async () => {
  const row = db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 1').get();
  const duplikat = {
    title: 'JALAN PENGHUBUNG LANDAK-BENGKAYANG MULAI DIPERBAIKI',
    source: 'antara kalbar',
    link: 'https://kabar.example/landak-diperbaiki-2',
    pubDate: '2026-09-12',
  };
  const applied = await applyUpdate(row, duplikat, { kind: 'progres', log: LOG });
  assert.equal(applied, false, 'catatan duplikat harus dilewati');
  const after1 = db.prepare('SELECT * FROM reports WHERE id = ?').get(row.id);
  assert.equal(parseMediaUpdates(after1.media_updates).length, 1);
});

test('berita lanjutan yang berbeda tetap dicatat, urut, dan dibatasi 20', async () => {
  const id = db.prepare('SELECT id FROM reports ORDER BY id DESC LIMIT 1').get().id;
  // Ambil ulang baris tiap kali (seperti runMonitor yang menyegarkan `existing`
  // sesudah setiap update) supaya riwayat benar-benar bertambah.
  const ambil = () => db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  await applyUpdate(
    ambil(),
    {
      title: 'Akses Jalan Landak Kembali Normal Pascabanjir',
      source: 'Kompas.com',
      link: 'https://kabar.example/landak-normal',
      pubDate: '2026-09-12',
    },
    { kind: 'progres', log: LOG }
  );
  for (let i = 1; i <= 25; i += 1) {
    await applyUpdate(
      ambil(),
      { title: `Perbaikan Jalan Landak Tahap ${i}`, source: 'Antara Kalbar', link: `https://kabar.example/t${i}`, pubDate: '2026-09-12' },
      { kind: 'progres', log: LOG }
    );
  }
  const after1 = ambil();
  const notes = parseMediaUpdates(after1.media_updates);
  assert.equal(notes.length, 20, 'riwayat dibatasi 20 catatan terbaru');
  assert.equal(notes[notes.length - 1].title, 'Perbaikan Jalan Landak Tahap 25');
  assert.equal(after1.description, DESC_ASLI);
});

test('artikel dari tempat lain (Wonogiri) tidak pernah masuk riwayat titik Landak', async () => {
  const row = db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 1').get();
  const nyasar = {
    title: 'TALUD SEMPAT LONGSOR, AKSES JALAN UTAMA EMPAT DUSUN DI KECAMATAN MANYARAN KINI SUDAH DIPERBAIKI',
    source: 'wonogirikab.go.id',
    link: 'https://wonogirikab.example/talud',
    pubDate: '2026-09-12',
  };
  // Monitor sudah menolak sebelum applyUpdate (matchScore), jadi di sini kita
  // pastikan riwayatnya tetap bersih: hanya dicatat bila benar-benar dipanggil,
  // dan deskripsi tidak pernah berubah.
  const before = parseMediaUpdates(db.prepare('SELECT * FROM reports WHERE id = ?').get(row.id).media_updates).length;
  const sumberSebelum = db.prepare('SELECT source_media_name FROM reports WHERE id = ?').get(row.id).source_media_name;
  const cocok = require('../services/newsMonitor.js').matchScore(row, nyasar.title, null);
  assert.equal(cocok, null, 'artikel Wonogiri harus ditolak matchScore');
  const after1 = db.prepare('SELECT * FROM reports WHERE id = ?').get(row.id);
  assert.equal(parseMediaUpdates(after1.media_updates).length, before);
  assert.equal(after1.description, DESC_ASLI);
  assert.equal(after1.source_media_name, sumberSebelum, 'sumber asli tidak tertimpa artikel nyasar');
});
