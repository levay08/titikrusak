'use strict';

// backend/services/newsClient.js
// Agregasi RSS berita Indonesia (Google News) untuk News Flash / Berita
// Terkini: berita perbaikan infrastruktur, infrastruktur rusak, dan bencana.
// BEST-EFFORT & ringan:
//   - cache in-memory (TTL 30 menit), TIDAK menyimpan ke disk/DB.
//   - refresh MALAS (lazy): hanya saat cache kedaluwarsa DAN ada permintaan,
//     jadi tidak ada proses background/cron yang bisa bocor/memberatkan.
//   - gagal fetch -> pakai cache lama / array kosong, tidak pernah throw/hang.
//   - dedupe judul (berita sama dibiarkan / tidak diduplikasi).

const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const NEWS_QUERIES = [
  'infrastruktur rusak',
  'perbaikan infrastruktur',
  'bencana alam',
  'jembatan ambruk',
];

const NEWS_TTL_MS = 30 * 60 * 1000; // 30 menit
const MAX_ITEMS = 30; // pool cukup untuk rotasi beberapa batch x5
const FETCH_TIMEOUT_MS = 8000;

let cache = { items: [], fetchedAt: 0 };

// Judul Google News berbentuk "Judul - Sumber"; ambil judulnya saja.
function cleanTitle(raw) {
  const s = String(raw || '').trim();
  const idx = s.lastIndexOf(' - ');
  return idx > 0 ? s.slice(0, idx).trim() : s;
}

// Parser RSS minimal (regex) — tanpa dependensi XML berat.
function parseGoogleNewsRss(xml) {
  const out = [];
  const blocks = String(xml || '').split('<item>').slice(1);
  for (const block of blocks) {
    const titleM = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkM = block.match(/<link>\s*([\s\S]*?)\s*<\/link>/);
    if (!titleM || !linkM) continue;
    const title = cleanTitle(titleM[1]);
    const url = linkM[1].trim();
    if (!title || !/^https?:\/\//i.test(url)) continue;
    out.push({ title, url });
  }
  return out;
}

async function fetchQuery(query) {
  try {
    const url =
      'https://news.google.com/rss/search?q=' +
      encodeURIComponent(query) +
      '&hl=id&gl=ID&ceid=ID:id';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    return parseGoogleNewsRss(await res.text());
  } catch (_e) {
    return [];
  }
}

// Ambil berita; kembalikan cache bila belum kedaluwarsa (lazy refresh).
async function getNews({ force = false } = {}) {
  if (!force && Date.now() - cache.fetchedAt < NEWS_TTL_MS) {
    return cache.items;
  }
  const all = [];
  for (const q of NEWS_QUERIES) {
    const items = await fetchQuery(q);
    all.push(...items);
  }
  const seen = new Set();
  const deduped = [];
  for (const n of all) {
    const key = n.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(n);
  }
  if (deduped.length > 0) {
    cache = { items: deduped.slice(0, MAX_ITEMS), fetchedAt: Date.now() };
  }
  return cache.items;
}

module.exports = { getNews, parseGoogleNewsRss };
