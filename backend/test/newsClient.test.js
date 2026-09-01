'use strict';

// backend/test/newsClient.test.js
// Tes parser RSS Google News (fungsi murni parseGoogleNewsRss).

const { test } = require('node:test');
const assert = require('node:assert');
const { parseGoogleNewsRss } = require('../services/newsClient.js');

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
