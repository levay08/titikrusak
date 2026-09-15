'use strict';

// backend/test/notifFeed.test.js
// Kunci perilaku URUTAN feed notifikasi (services/notifFeed.js):
// menu Notifikasi = daftar notifikasi masuk, jadi baris terbaru WAJIB di atas -
// termasuk saat kabar 'perbaikan' tanggalnya tua (dulu selalu dipaksa di atas).
// Yang dikunci di sini:
//  1. Urutan murni kronologis, bukan per jenis kejadian.
//  2. Kabar 'perbaikan' tidak pernah terpotong batas 60.
//  3. Campur format waktu (DB 'YYYY-MM-DD HH:MM:SS' vs ISO 'Z') dibanding
//     setelah dinormalisasi, bukan sebagai string mentah.
//  4. Ringkasan komentar per titik diurutkan dari komentar TERBARU, bukan
//     dari jumlah komentar.

const test = require('node:test');
const assert = require('node:assert/strict');
const { orderMediaEvents, orderCommentGroups, MEDIA_LIMIT } = require('../services/notifFeed.js');

test('perbaikan tua TIDAK dipaksa di atas: baris terbaru tetap paling atas', () => {
  const hasil = orderMediaEvents([
    { kind: 'perbaikan', at: '2026-01-12T00:00:00.000Z', report_id: 504 },
    { kind: 'update', at: '2026-09-15 04:25:15', report_id: 450 },
    { kind: 'tercatat', at: '2026-09-02 07:01:26', report_id: 101 },
  ]);
  assert.deepEqual(
    hasil.map((e) => e.report_id),
    [450, 101, 504]
  );
  assert.equal(hasil[0].kind, 'update');
  assert.equal(hasil[hasil.length - 1].kind, 'perbaikan');
});

test('perbaikan terbaru tetap boleh di atas bila waktunya memang terbaru', () => {
  const hasil = orderMediaEvents([
    { kind: 'update', at: '2026-09-01 08:00:00', report_id: 1 },
    { kind: 'perbaikan', at: '2026-09-08 14:03:13', report_id: 2 },
  ]);
  assert.deepEqual(hasil.map((e) => e.report_id), [2, 1]);
});

test('kabar perbaikan tidak terpotong batas 60 walau tanggalnya paling tua', () => {
  const lain = Array.from({ length: 80 }, (_v, i) => ({
    kind: 'update',
    at: `2026-09-${String((i % 28) + 1).padStart(2, '0')} 10:00:00`,
    report_id: 1000 + i,
  }));
  const tua = [
    { kind: 'perbaikan', at: '2025-12-31T00:00:00.000Z', report_id: 445 },
    { kind: 'perbaikan', at: '2026-01-12T00:00:00.000Z', report_id: 505 },
  ];
  const hasil = orderMediaEvents([...lain, ...tua]);
  assert.equal(hasil.length, MEDIA_LIMIT + 2); // 60 kabar lain + 2 perbaikan
  assert.equal(hasil.filter((e) => e.kind === 'perbaikan').length, 2);
  assert.ok(hasil.some((e) => e.report_id === 445));
  assert.ok(hasil.some((e) => e.report_id === 505));
  // Dua perbaikan tertua ada di ekor daftar, bukan lagi di kepala.
  assert.deepEqual(
    hasil.slice(-2).map((e) => e.report_id).sort((a, b) => a - b),
    [445, 505]
  );
});

test('campur format waktu dibanding setelah dinormalisasi (bukan string mentah)', () => {
  // Perbaikan ISO tengah malam 12 Jan UTC vs update DB-space 05:00 hari yang
  // sama: dibanding mentah, 'T' > ' ' membuat ISO selalu menang (salah).
  const hasil = orderMediaEvents([
    { kind: 'perbaikan', at: '2026-01-12T00:00:00.000Z', report_id: 7 },
    { kind: 'update', at: '2026-01-12 05:00:00', report_id: 9 },
  ]);
  assert.deepEqual(hasil.map((e) => e.report_id), [9, 7]);
});

test('waktu tidak terbaca jatuh ke bawah, bukan menutupi baris lain', () => {
  const hasil = orderMediaEvents([
    { kind: 'update', at: null, report_id: 1 },
    { kind: 'perbaikan', at: '2026-01-12T00:00:00.000Z', report_id: 2 },
    { kind: 'update', at: '2026-08-01 00:00:00', report_id: 3 },
  ]);
  assert.deepEqual(hasil.map((e) => e.report_id), [3, 2, 1]);
});

test('urutan komentar: komentar terbaru di atas walau jumlahnya lebih sedikit', () => {
  const hasil = orderCommentGroups([
    { report_id: 1, count: 12, last_at: '2026-09-02 10:00:00' },
    { report_id: 2, count: 2, last_at: '2026-09-15 09:00:00' },
    { report_id: 3, count: 30, last_at: '2026-09-01 10:00:00' },
  ]);
  assert.deepEqual(hasil.map((g) => g.report_id), [2, 1, 3]);
});

test('urutan komentar tidak mengubah data asli (tanpa efek samping)', () => {
  const asli = [
    { report_id: 1, count: 1, last_at: '2026-09-01 10:00:00' },
    { report_id: 2, count: 5, last_at: '2026-09-10 10:00:00' },
  ];
  const salinan = JSON.parse(JSON.stringify(asli));
  orderCommentGroups(asli);
  assert.deepEqual(asli, salinan);
});
