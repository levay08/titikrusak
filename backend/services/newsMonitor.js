'use strict';

// backend/services/newsMonitor.js
// Monitor BERITA otomatis (2 Sep 2026): pindai Google News RSS (berita
// Indonesia) untuk laporan terbaru soal titik rusak infrastruktur, lalu
// usulkan/masukkan ke peta sebagai titik sumber MEDIA.
//
// Alur:
//   1. query RSS -> judul/url/sumber/tanggal;
//   2. filter: harus mengandung kata KERUSAKAN + kata JENIS infrastruktur;
//      buang berita internasional & non-Indonesia;
//   3. deteksi lokasi: "Kabupaten/Kota X" (geocode Nominatim, cache)
//      atau fallback nama provinsi (titik pusat);
//   4. dedupe: URL belum ada di DB + judul tidak mirip dgn titik yang ada;
//   5. insert sbg laporan media (source_type='media').
//
// Dipakai oleh scripts/news-monitor.js (CLI/cron). Best-effort: satu
// artikel gagal tidak menggagalkan sisanya; tidak pernah throw ke cron.

const db = require('../db/db.js');

// ---- Kata kunci jenis infrastruktur (harus cocok minimal 1) ----
const INFRA_KEYWORDS = [
  'jembatan', 'jalan', 'sekolah', 'madrasah', 'pesantren', 'rumah sakit',
  'puskesmas', 'tanggul', 'bendungan', 'irigasi', 'saluran air', 'jaringan listrik',
  'gardu listrik', 'tower', 'menara', 'gedung sekolah', 'jembatan gantung',
  'flyover', 'underpass', 'jalan raya', 'jalan provinsi', 'jalan kabupaten',
  'jalan nasional', 'tambak', 'dermaga', 'pelabuhan', 'jaringan air',
];
// ---- Kata KERUSAKAN (harus cocok minimal 1) ----
const DAMAGE_KEYWORDS = [
  'putus', 'terputus', 'ambruk', 'ambles', 'longsor', 'jebol', 'rusak',
  'runtuh', 'roboh', 'tertimpa', 'tertimbun', 'hanyut', 'tersapu', 'terendam',
  'rusak berat', 'rusak ringan', 'terbelah', 'melorot', 'banjir', 'bergeser',
  'retak', 'diterjang', 'terdampak', 'porak-poranda', 'terisolir',
];
// Kata yang menandakan BUKAN kejadian baru (berita lama/rencana/opini).
const SKIP_IF = [
  'peringatan dini', 'antisipasi', 'waspada', 'prediksi', 'ramalan', 'potensi',
  'akan dibangun', 'rencana', 'kontrak', 'lelang', 'anggaran', 'aspal ulang',
  'opini', 'analisis', 'profil', 'turnamen', 'politik', 'pilpres', 'pilkada',
  'sejarah', 'lomba', 'wisata kuliner',
];

// Provinsi + alias umum (utk deteksi lokasi fallback).
const PROVINCES = {
  'aceh': 'Aceh', 'sumatera utara': 'Sumatera Utara', 'sumatera barat': 'Sumatera Barat',
  'sumut': 'Sumatera Utara', 'sumbar': 'Sumatera Barat', 'riau': 'Riau',
  'kepulauan riau': 'Kepulauan Riau', 'kepri': 'Kepulauan Riau', 'jambi': 'Jambi',
  'sumatera selatan': 'Sumatera Selatan', 'sumsel': 'Sumatera Selatan',
  'bangka belitung': 'Kepulauan Bangka Belitung', 'babel': 'Kepulauan Bangka Belitung',
  'bengkulu': 'Bengkulu', 'lampung': 'Lampung', 'banten': 'Banten',
  'jawa barat': 'Jawa Barat', 'jabar': 'Jawa Barat', 'jakarta': 'DKI Jakarta',
  'dki jakarta': 'DKI Jakarta', 'jawa tengah': 'Jawa Tengah', 'jateng': 'Jawa Tengah',
  'yogyakarta': 'DI Yogyakarta', 'jawa timur': 'Jawa Timur', 'jatim': 'Jawa Timur',
  'bali': 'Bali', 'nusa tenggara barat': 'Nusa Tenggara Barat', 'ntb': 'Nusa Tenggara Barat',
  'nusa tenggara timur': 'Nusa Tenggara Timur', 'ntt': 'Nusa Tenggara Timur',
  'kalimantan barat': 'Kalimantan Barat', 'kalbar': 'Kalimantan Barat',
  'kalimantan tengah': 'Kalimantan Tengah', 'kalteng': 'Kalimantan Tengah',
  'kalimantan selatan': 'Kalimantan Selatan', 'kalsel': 'Kalimantan Selatan',
  'kalimantan timur': 'Kalimantan Timur', 'kaltim': 'Kalimantan Timur',
  'kalimantan utara': 'Kalimantan Utara', 'kaltara': 'Kalimantan Utara',
  'sulawesi utara': 'Sulawesi Utara', 'sulut': 'Sulawesi Utara',
  'gorontalo': 'Gorontalo', 'sulawesi tengah': 'Sulawesi Tengah', 'sulteng': 'Sulawesi Tengah',
  'sulawesi barat': 'Sulawesi Barat', 'sulbar': 'Sulawesi Barat',
  'sulawesi selatan': 'Sulawesi Selatan', 'sulsel': 'Sulawesi Selatan',
  'sulawesi tenggara': 'Sulawesi Tenggara', 'sultra': 'Sulawesi Tenggara',
  'maluku': 'Maluku', 'maluku utara': 'Maluku Utara', 'malut': 'Maluku Utara',
  'papua barat': 'Papua Barat', 'papua': 'Papua', 'papua barat daya': 'Papua Barat Daya',
  'papua tengah': 'Papua Tengah', 'papua pegunungan': 'Papua Pegunungan', 'papua selatan': 'Papua Selatan',
};

const FOREIGN = [
  'amerika', 'united states', 'iran', 'irak', 'israel', 'palestina', 'rusia',
  'ukraina', 'tiongkok', 'china', 'jepang', 'korea', 'india', 'pakistan',
  'thailand', 'malaysia', 'singapura', 'vietnam', 'filipina', 'myanmar',
  'asean', 'eropa', 'afrika', 'australia', 'timor leste', 'bangladesh',
];

const QUERIES = [
  'jembatan putus', 'jembatan ambruk', 'jembatan rusak',
  'jalan ambles', 'jalan longsor', 'jalan putus', 'jalan rusak',
  'sekolah rusak', 'sekolah ambruk', 'tanggul jebol',
  'rumah sakit rusak', 'infrastruktur rusak', 'jembatan gantung putus',
  'jalan provinsi rusak', 'banjir rusak sekolah',
];

const MAX_PER_RUN = 10;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const FETCH_TIMEOUT = 10000;

function parseRss(xml) {
  const out = [];
  const blocks = String(xml || '').split('<item>').slice(1);
  for (const block of blocks) {
    const titleM = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkM = block.match(/<link>\s*([\s\S]*?)\s*<\/link>/);
    const dateM = block.match(/<pubDate>\s*([\s\S]*?)\s*<\/pubDate>/);
    if (!titleM || !linkM) continue;
    let title = titleM[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    const srcIdx = title.lastIndexOf(' - ');
    const source = srcIdx > 0 ? title.slice(srcIdx + 3).trim() : '';
    if (srcIdx > 0) title = title.slice(0, srcIdx).trim();
    out.push({
      title,
      link: linkM[1].trim(),
      source,
      pubDate: dateM ? dateM[1].trim() : null,
    });
  }
  return out;
}

function cleanTitle(raw) {
  return String(raw || '').replace(/[^a-z0-9 ]/gi, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasAny(text, list) {
  const t = String(text || '').toLowerCase();
  return list.some((k) => t.includes(k));
}

function tokenOverlap(a, b) {
  const sa = new Set(cleanTitle(a).split(' ').filter((w) => w.length > 3));
  const sb = new Set(cleanTitle(b).split(' ').filter((w) => w.length > 3));
  if (sa.size === 0 || sb.size === 0) return 0;
  let same = 0;
  sa.forEach((w) => { if (sb.has(w)) same += 1; });
  return same / Math.min(sa.size, sb.size);
}

// Deteksi lokasi: kembalikan daftar calon { name, q } dari yang paling
// spesifik ke paling umum (daerah -> provinsi). Setiap calon dicoba geocode
// sampai ada yang berhasil, supaya titik tidak asal di pusat provinsi.
const GENERIC_PLACE = new Set([
  'akses', 'warga', 'masyarakat', 'jalan', 'jembatan', 'indonesia', 'provinsi',
  'bantuan', 'solusi', 'pemulihan', 'kawasan', 'wilayah', 'daerah', 'desa',
  'kecamatan', 'sekolah', 'pemerintah', 'bupati', 'kepala', 'banjir', 'sungai',
  'imbas', 'imbas banjir', 'hujan', 'galodo', 'lokasi', 'perbaikan', 'tinjau',
  'pemprov', 'polres', 'rumah', 'fasilitas', 'rumah sakit', 'puskesmas', 'dinas',
]);

function detectLocations(text) {
  const t = String(text || '');
  const out = [];
  // provinsi yang disebut (konteks utk mempertajam geocode)
  let province = null;
  for (const [alias, full] of Object.entries(PROVINCES)) {
    const re = new RegExp(`\\b${alias.replace(/ /g, '\\s+')}\\b`, 'i');
    if (re.test(t)) { province = full; break; }
  }
  const geo = (name, kind) => {
    const n = String(name || '').replace(/[,.;].*$/, '').replace(/\s+/g, ' ').trim();
    if (!n || n.length < 3) return;
    // potong bila ketemu kata jenis/damage di tengah nama
    const cut = n.split(/ (?:jembatan|jalan|sekolah|kecamatan|desa|kelurahan|banjir|longsor|putus|ambruk|rusak|ambles|jebol|galodo|hujan|imbs)\b/i)[0].trim();
    const finalName = cut || n;
    if (finalName.length < 3) return;
    const q = province ? `${finalName}, ${province}` : `${finalName}, Indonesia`;
    if (!out.some((c) => c.q.toLowerCase() === q.toLowerCase())) out.push({ name: finalName, kind, q });
  };
  // 1) Kabupaten/Kota/Kab./Kotamadya
  const m = t.match(/(Kabupaten|Kota|Kab\.|Kotamadya)\s+([A-Z][A-Za-z .'()-]{3,60})/i);
  if (m) geo(m[2], 'daerah');
  // 2) "di <Nama Tempat>" (kota/kecamatan/nagari dll)
  const reDi = /(?:di|dekat|sekitar|wilayah|kawasan|pemulihan|akses)\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2})/g;
  let mm;
  while ((mm = reDi.exec(t)) !== null) {
    const first = mm[1].split(' ')[0].toLowerCase();
    if (GENERIC_PLACE.has(first)) continue;
    geo(mm[1], 'lokasi');
  }
  // 3) kata depan wilayah adat: Nagari/Desa/Kelurahan/Gampong/Kampung
  const m2 = t.match(/(?:Nagari|Desa|Kelurahan|Gampong|Kampung)\s+([A-Z][A-Za-z .'-]{2,45})/i);
  if (m2) geo(m2[1], 'lokasi');
  // 4) fallback provinsi
  if (province) geo(province, 'provinsi');
  return out.length ? out : null;
}

async function geocode(q, cache) {
  const key = q.toLowerCase();
  if (cache[key]) return cache[key];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=id&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'titikrusak-news-monitor/1.0' }, signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const hit = Array.isArray(data) && data[0] ? data[0] : null;
    const out = hit ? { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), label: hit.display_name } : null;
    cache[key] = out;
    return out;
  } catch (_e) {
    cache[key] = null;
    return null;
  } finally {
    // hormati kebijakan Nominatim (1 request/detik)
    await new Promise((r) => setTimeout(r, 1100));
  }
}

async function geocodeBest(candidates, cache) {
  for (const cand of candidates) {
    const geo = await geocode(cand.q, cache);
    if (geo) return { geo, cand };
  }
  return null;
}

async function fetchQuery(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    const xml = await res.text();
    return parseRss(xml);
  } catch (_e) {
    return [];
  }
}

function classifyInfra(title) {
  const t = title.toLowerCase();
  if (/jembatan/.test(t)) return 'jembatan';
  if (/\bsekolah\b|madrasah|pesantren|sd |smp |sma |smk |ruang kelas|gedung sekolah/.test(t)) return 'sekolah';
  if (/rumah sakit|puskesmas|klinik|rsud/.test(t)) return 'prasarana_publik';
  if (/tanggul|bendungan|irigasi|saluran air|tambak/.test(t)) return 'prasarana_publik';
  if (/listrik|pln|gardu|tower|menara|trafo/.test(t)) return 'utilitas';
  if (/\bjalan\b|jembatan gantung|jalan raya|jalan provinsi|jalan kabupaten|jalan nasional|flyover|underpass/.test(t)) return 'jalan';
  return 'prasarana_publik';
}

function classifySeverity(title) {
  const t = title.toLowerCase();
  if (/ambruk|putus|terputus|runtuh|roboh|jebol|hanyut|tersapu/.test(t)) return 'ambruk';
  if (/ambles|longsor|rusak berat|tertimpa|tertimbun|terbelah|rusak parah|porak/.test(t)) return 'berat';
  if (/banjir|terendam|rusak|diterjang|terdampak|retak|bergeser/.test(t)) return 'sedang';
  return 'ringan';
}

// Jalur utama monitor. mode: 'dry' hanya melaporkan kandidat tanpa insert.
async function runMonitor({ dry = false, log = console.log } = {}) {
  const seen = new Set();
  const results = { scanned: 0, candidates: 0, inserted: 0, skipped: 0, errors: 0, items: [] };

  // kumpulkan judul & URL yang sudah ada utk dedupe
  const existing = db.prepare('SELECT source_media_url, description FROM reports WHERE source_type = ?').all('media');
  const existingUrls = new Set(existing.map((r) => r.source_media_url).filter(Boolean));
  const existingTitles = existing.map((r) => String(r.description || '')).filter((s) => s.length > 20);
  const hasUrl = (u) => existingUrls.has(u) || seen.has(u);

  for (const query of QUERIES) {
    let items = [];
    try {
      items = await fetchQuery(query);
    } catch (_e) {
      results.errors += 1;
      continue;
    }
    for (const item of items) {
      results.scanned += 1;
      const title = item.title || '';
      const low = title.toLowerCase();
      if (!title) continue;
      if (hasAny(title, FOREIGN)) continue;
      if (hasAny(title, SKIP_IF) && !hasAny(title, ['putus', 'ambruk', 'ambles', 'jebol', 'runtuh', 'roboh', 'longsor'])) continue;
      if (!hasAny(low, INFRA_KEYWORDS)) continue;
      if (!hasAny(low, DAMAGE_KEYWORDS)) continue;
      if (hasUrl(item.link)) continue;
      // kemiripan judul dgn titik yang sudah ada
      const dupTitle = existingTitles.some((t) => tokenOverlap(t, title) > 0.6);
      if (dupTitle) continue;
      if (seen.has(item.link)) continue; // duplikat dalam satu run (beda query)
      const locs = detectLocations(title);
      if (!locs) continue; // tanpa lokasi jelas -> jangan menebak
      results.candidates += 1;
      results.items.push({ item, locs });
      seen.add(item.link);
      if (results.items.length >= MAX_PER_RUN) break;
    }
    if (results.items.length >= MAX_PER_RUN) break;
  }

  // geocode + insert (hanya mode non-dry)
  const geoCacheFile = require('path').join(__dirname, '..', 'data', 'monitor-geo-cache.json');
  let cache = {};
  try { cache = JSON.parse(require('fs').readFileSync(geoCacheFile, 'utf8')); } catch (_e) { /* kosong */ }

  for (const { item, locs } of results.items) {
    const best = await geocodeBest(locs, cache);
    if (!best) {
      results.skipped += 1;
      log(`  - lewati (gagal geocode): ${locs.map((l) => l.name).join(' / ')} — ${item.title}`);
      continue;
    }
    const { geo, cand } = best;
    const entry = {
      title: item.title,
      url: item.link,
      source: item.source || 'Google News',
      pubDate: item.pubDate,
      locName: cand.name,
      lat: geo.lat,
      lng: geo.lng,
      infra: classifyInfra(item.title),
      severity: classifySeverity(item.title),
    };
    if (dry) {
      log(`  [kandidat] ${entry.severity}/${entry.infra} @ ${entry.locName} (${entry.lat.toFixed(3)}, ${entry.lng.toFixed(3)}): ${entry.title} — ${entry.source}`);
      continue;
    }
    // geser sedikit bila bertabrakan dgn titik yang ada di koordinat itu
    const clash = db.prepare('SELECT id FROM reports WHERE ABS(lat - ?) < 0.02 AND ABS(lng - ?) < 0.02 LIMIT 1').get(entry.lat, entry.lng);
    const latFinal = clash ? entry.lat + (Math.random() * 0.02 - 0.01) : entry.lat;
    const lngFinal = clash ? entry.lng + (Math.random() * 0.02 - 0.01) : entry.lng;

    const stmt = db.prepare(
      `INSERT INTO reports (infra_type, severity, bridge_authority, vital_status, description,
        location_name, lat, lng, source_type, source_media_name, source_media_url, source_media_date, status)
       VALUES (?, ?, 'tidak_diketahui', '["akses_ekonomi"]', ?, ?, ?, ?, 'media', ?, ?, ?, 'dilaporkan')`
    );
    stmt.run(
      classifyInfra(entry.title), classifySeverity(entry.title),
      entry.title, entry.locName, latFinal, lngFinal,
      entry.source, entry.url, entry.pubDate || null
    );
    results.inserted += 1;
    log(`  + masuk peta: ${entry.severity}/${entry.infra} @ ${entry.locName} — ${entry.title} (${entry.source})`);
  }

  try {
    require('fs').mkdirSync(require('path').join(__dirname, '..', 'data'), { recursive: true });
    require('fs').writeFileSync(geoCacheFile, JSON.stringify(cache));
  } catch (_e) { /* cache best-effort */ }

  return results;
}

module.exports = { runMonitor, QUERIES };
