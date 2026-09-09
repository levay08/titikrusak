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
  'infrastruktur rusak Indonesia',
  'perbaikan infrastruktur Indonesia',
  'bencana alam Indonesia',
  'jembatan ambruk Indonesia',
];

const NEWS_TTL_MS = 15 * 60 * 1000; // 15 menit - ticker selalu condong ke berita baru
const MAX_ITEMS = 30; // pool cukup untuk rotasi beberapa batch x5
const FETCH_TIMEOUT_MS = 8000;
// Jendela umur berita: hanya berita 30 HARI terakhir (s.d. hari ini).
// Lebih tua dari itu tidak relevan lagi untuk "Berita Terkini".
const NEWS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Toleransi selisih jam server vs jam media (RSS kadang lebih cepat/nyasar).
const NEWS_FUTURE_TOLERANCE_MS = 6 * 60 * 60 * 1000;

// Kata kunci negara/region luar - judul yang memuat ini dibuang agar feed
// tetap berita Indonesia saja (bukan internasional/Asia). Case-insensitive.
const FOREIGN_KEYWORDS = [
  'amerika', 'united states', 'iran', 'irak', 'israel', 'palestina', 'rusia',
  'ukraina', 'tiongkok', 'china', 'jepang', 'korea', 'india', 'pakistan',
  'thailand', 'malaysia', 'singapura', 'vietnam', 'filipina', 'myanmar',
  'asean', 'eropa', 'afrika', 'australia', 'timor leste', 'bangladesh',
  'sri lanka', 'turki', 'mesir', 'arab saudi',
];

let cache = { items: [], fetchedAt: 0 };

// Judul memuat nama negara/region luar -> buang (bukan berita Indonesia).
function isForeign(title) {
  const t = String(title || '').toLowerCase();
  return FOREIGN_KEYWORDS.some((k) => t.includes(k));
}

// Judul Google News berbentuk "Judul - Sumber"; ambil judulnya saja.
function cleanTitle(raw) {
  const s = String(raw || '').trim();
  const idx = s.lastIndexOf(' - ');
  return idx > 0 ? s.slice(0, idx).trim() : s;
}

// Parser RSS minimal (regex) - tanpa dependensi XML berat.
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
    // pubDate RFC 822 ("Fri, 04 Sep 2026 09:12:00 GMT") -> ISO; null bila
    // tidak terbaca. Umur berita ditentukan di sini (filter 30 hari).
    const dateM = block.match(/<pubDate>\s*([\s\S]*?)\s*<\/pubDate>/);
    let pubDate = null;
    if (dateM) {
      const t = Date.parse(dateM[1].trim());
      if (!Number.isNaN(t)) pubDate = new Date(t).toISOString();
    }
    out.push({ title, url, pubDate });
  }
  return out;
}

// Berita layak tampil bila usianya <= 30 hari dari nowMs (toleransi kecil
// untuk selisih jam server/media). Tanpa tanggal terbaca -> TIDAK lolos
// (tidak bisa dijamin fresh).
function isRecent(item, nowMs = Date.now()) {
  const t = item.pubDate ? Date.parse(item.pubDate) : NaN;
  if (Number.isNaN(t)) return false;
  return t >= nowMs - NEWS_MAX_AGE_MS && t <= nowMs + NEWS_FUTURE_TOLERANCE_MS;
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
    if (isForeign(n.title)) continue; // hanya berita Indonesia
    const key = n.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(n);
  }
  // Hanya berita 30 hari terakhir, urut TERBARU dulu (pool batch ticker
  // dimulai dari yang paling fresh; yang basi tidak pernah tampil).
  const recent = deduped
    .filter((n) => isRecent(n))
    .sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));
  if (recent.length > 0) {
    cache = { items: recent.slice(0, MAX_ITEMS), fetchedAt: Date.now() };
  }
  return cache.items;
}

module.exports = { getNews, parseGoogleNewsRss, isRecent };
