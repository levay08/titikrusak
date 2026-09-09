'use strict';

// backend/test/newsClient.test.js
// Tes parser RSS Google News (fungsi murni parseGoogleNewsRss).

const { test } = require('node:test');
const assert = require('node:assert');
const { parseGoogleNewsRss, isRecent } = require('../services/newsClient.js');

test('parseGoogleNewsRss: ekstrak judul (tanpa " - Sumber") + link, lewati item kosong', () => {
  const xml = [
    '<rss><channel>',
    '<item><title><![CDATA[Judul Satu - Sumber Berita]]></title><link>https://news.google.com/rss/articles/abc</link></item>',
    '<item><title>Judul Dua - Media</title><link>https://news.google.com/rss/articles/def</link></item>',
    '<item><title></title><link>https://news.google.com/rss/articles/ghi</link></item>',
    '<item><title>Tanpa Link</title></item>',
    '</channel></rss>',
  ].join('');

  const items = parseGoogleNewsRss(xml);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, 'Judul Satu');
  assert.strictEqual(items[0].url, 'https://news.google.com/rss/articles/abc');
  assert.strictEqual(items[1].title, 'Judul Dua');
  assert.strictEqual(items[1].url, 'https://news.google.com/rss/articles/def');
});

test('parseGoogleNewsRss: pubDate RFC 822 dibaca -> ISO; tanpa tanggal = null', () => {
  const xml = [
    '<rss><channel>',
    '<item><title>Berita Baru - Media A</title><link>https://news.google.com/rss/articles/a</link><pubDate>Fri, 04 Sep 2026 09:12:00 GMT</pubDate></item>',
    '<item><title>Berita Lama - Media B</title><link>https://news.google.com/rss/articles/b</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>',
    '<item><title>Tanpa Tanggal - Media C</title><link>https://news.google.com/rss/articles/c</link></item>',
    '</channel></rss>',
  ].join('');

  const items = parseGoogleNewsRss(xml);
  assert.strictEqual(items.length, 3);
  assert.strictEqual(items[0].pubDate, '2026-09-04T09:12:00.000Z');
  assert.strictEqual(items[1].pubDate, '2024-01-01T00:00:00.000Z');
  assert.strictEqual(items[2].pubDate, null);
});

test('isRecent: hanya berita 30 hari terakhir yang lolos (s.d. now)', () => {
  // now = 9 Sep 2026 00:00 UTC -> batas bawah 10 Agu 2026 00:00 UTC.
  const nowMs = Date.parse('2026-09-09T00:00:00Z');
  assert.strictEqual(isRecent({ pubDate: '2026-09-08T12:00:00Z' }, nowMs), true);
  assert.strictEqual(isRecent({ pubDate: '2026-08-10T00:00:00Z' }, nowMs), true); // tepat 30 hari
  assert.strictEqual(isRecent({ pubDate: '2026-08-09T23:59:59Z' }, nowMs), false); // 30 hari + 1 detik
  assert.strictEqual(isRecent({ pubDate: '2026-01-01T00:00:00Z' }, nowMs), false); // basi
  assert.strictEqual(isRecent({ pubDate: null }, nowMs), false); // tanggal tak terbaca
  assert.strictEqual(isRecent({}, nowMs), false);
  // toleransi masa depan kecil (selisih jam server vs media) tetap lolos
  assert.strictEqual(isRecent({ pubDate: '2026-09-09T03:00:00Z' }, nowMs), true);
});
