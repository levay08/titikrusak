'use strict';

// backend/test/imageUrl.test.js
// Kunci perilaku pembersih URL gambar dari og:image.
// Latar: situs bisa menuliskan nilai og:image yang RUSAK - dua URL tergabung
// ("http://situshttps://cdn/foto.jpg", kasus nyata titik #119) atau URL
// relatif. Nilai seperti itu tidak boleh masuk DB (fotonya pasti rusak).

const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanImageUrl } = require('../services/newsMonitor.js');

test('URL tunggal yang sah dilewatkan apa adanya', () => {
  const u = 'https://cdn.antaranews.com/cache/1200x800/2026/05/18/1000553803_1.jpg';
  assert.equal(cleanImageUrl(u), u);
});

test('dua URL tergabung -> diambil URL gambar yang sah (kasus #119)', () => {
  const rusak =
    'http://fraksidpr.pks.idhttps://fraksi.pks.id/app/uploads/2026/06/20260606-img-20260606-wa0119-150x150.jpg';
  assert.equal(
    cleanImageUrl(rusak),
    'https://fraksi.pks.id/app/uploads/2026/06/20260606-img-20260606-wa0119-150x150.jpg'
  );
});

test('relatif / kosong / bukan URL -> null (jangan simpan sampah)', () => {
  assert.equal(cleanImageUrl('/images/foto.jpg'), null);
  assert.equal(cleanImageUrl(''), null);
  assert.equal(cleanImageUrl(null), null);
  assert.equal(cleanImageUrl(undefined), null);
  assert.equal(cleanImageUrl('   '), null);
});

test('nilai dengan atribut sisa dibersihkan', () => {
  assert.equal(
    cleanImageUrl('https://contoh.id/foto.jpg" />'),
    'https://contoh.id/foto.jpg'
  );
});

test('URL CDN berparameter query tetap utuh', () => {
  const u = 'https://akcdn.detik.net.id/visual/2026/08/15/foto.jpeg?w=650&q=90';
  assert.equal(cleanImageUrl(u), u);
});
