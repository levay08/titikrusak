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
  'retak', 'diterjang', 'terdampak', 'porak-poranda', 'terisolir', 'anjlok',
  'miring', 'ambrol',
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

// ---- Fase 2: UPDATE titik media yang sudah ada (3 Sep 2026) ----
// Satu artikel TIDAK boleh jadi titik baru bila isinya tentang titik yang
// sudah ada di peta -> cocokkan dulu (lokasi + kata spesifik + kemiripan),
// lalu UPDATE deskripsi/sumber/severity. Hanya artikel yang benar-benar
// belum punya titik induk yang di-insert sebagai titik BARU.

const SEV_ORD = { ringan: 1, sedang: 2, berat: 3, ambruk: 4 };
const COMPLETE_RE = /dibuka kembali|beroperasi kembali|kembali beroperasi|resmi dibuka|sudah difungsikan|berfungsi kembali|selesai diperbaiki|perbaikan selesai|difungsikan kembali|kembali difungsikan/;
// Kebijakan (3 Sep 2026): monitor TIDAK PERNAH mengubah status ke
// selesai_diperbaiki (hijau ✓ = domain otoritas). Bila berita menyatakan
// titik yang SUDAH ADA di peta sudah diperbaiki, monitor hanya mencatat
// klaim media (media_repair_url/at) — titik tampil hijau TANPA ✓ dan tetap
// menunggu keputusan otoritas (PATCH /:id/media-fix).

// kata umum yang TIDAK dihitung sbg penanda spesifik sebuah objek
const STOP_SPECIFIC = new Set(('jembatan gantung jalan rusak putus ambruk ambles jebol ' +
  'banjir perbaikan diperbaiki bupati warga masyarakat akses pemulihan percepatan ' +
  'pemerintah bangun baru tahun dibuka kembali beroperasi normal segera mulai ' +
  'dikerjakan saat peresmian tni ad dandim penjelasan beri buka suara kami tak ' +
  'kontrol beban viral untuk agar dan dari yang dengan korban jiwa satuan unit ' +
  'kecamatan kabupaten kota desa nagari kelurahan gampong kampung provinsi wilayah ' +
  'posko penanganan darurat tim rehab rekon dorong tinjau cek wali polres kapolres ' +
  'bpjn pemprov kebut solusi imbas hujan galodo melanda terdampak fasilitas ' +
  'sekolah madrasah pesantren rs puskesmas rumah sakit tanggul bendungan').split(' '));

function specificTokens(text) {
  return new Set(cleanTitle(text).split(' ').filter((w) => w.length >= 5 && !STOP_SPECIFIC.has(w)));
}

function placeName(s) {
  return String(s || '').toLowerCase()
    .replace(/kabupaten|kab\.|kota|kecamatan|kec\.|nagari|desa|kelurahan|gampong|kampung/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function locContains(a, b) {
  // apakah nama tempat a memuat kata tempat b (atau sebaliknya)?
  const ta = placeName(a).split(' ').filter((w) => w.length >= 4);
  const tb = placeName(b).split(' ').filter((w) => w.length >= 4);
  if (ta.length === 0 || tb.length === 0) return false;
  const sa = new Set(ta);
  return tb.some((w) => sa.has(w));
}

// Kecocokan artikel dgn satu titik media: kembalikan skor atau null.
function matchScore(row, title, locs) {
  const hay = cleanTitle(`${row.description || ''} ${row.location_name || ''}`);
  const over = tokenOverlap(hay, title);
  if (over < 0.3) return null;
  const iInfra = classifyInfra(title);
  const infraOk = row.infra_type === iInfra || row.infra_type === 'prasarana_publik' || iInfra === 'prasarana_publik';
  if (!infraOk) return null;
  const nameMatch = locs ? locs.some((l) => locContains(row.location_name, l.name)) : false;
  const shared = (() => {
    const st = specificTokens(title);
    const sr = specificTokens(hay);
    for (const w of st) if (sr.has(w)) return true;
    return false;
  })();
  if ((over >= 0.5 && nameMatch) || (over >= 0.42 && nameMatch && shared)) {
    return { over, reason: nameMatch ? 'lokasi' : 'judul' };
  }
  return null;
}

// Jalur utama monitor. mode: 'dry' hanya melaporkan tanpa mengubah DB.
async function runMonitor({ dry = false, log = console.log } = {}) {
  const seen = new Set();
  const results = { scanned: 0, updated: 0, merged: 0, candidates: 0, inserted: 0, skipped: 0, errors: 0, items: [] };

  if (!dry) {
    const merged = mergeMediaDuplicates(log);
    results.merged = merged;
    if (merged > 0) log(`  ~ duplikat isi lama digabung: ${merged} baris dihapus`);
  }

  // kumpulkan titik media existing (termasuk yang di-update/insert run ini)
  let existing = db.prepare(
    `SELECT id, description, location_name, lat, lng, severity, status, infra_type,
            source_media_url, source_media_name, source_media_date
     FROM reports WHERE source_type = ?`
  ).all('media');
  const existingUrls = new Set(existing.map((r) => r.source_media_url).filter(Boolean));
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
      if (results.inserted >= MAX_PER_RUN && results.updated >= MAX_UPDATES) break;
      results.scanned += 1;
      const title = item.title || '';
      const low = title.toLowerCase();
      if (!title) continue;
      if (hasAny(title, FOREIGN)) continue;
      if (hasAny(title, SKIP_IF) && !hasAny(title, ['putus', 'ambruk', 'ambles', 'jebol', 'runtuh', 'roboh', 'longsor'])) continue;
      if (!hasAny(low, INFRA_KEYWORDS)) continue;
      if (seen.has(item.link)) continue;
      seen.add(item.link);

      // ---- 1) COCOK DGN TITIK YANG SUDAH ADA (update, bukan insert) ----
      const locs = detectLocations(title);
      let best = null;
      let bestScore = 0;
      for (const row of existing) {
        const s = matchScore(row, title, locs);
        if (s && s.over > bestScore) { bestScore = s.over; best = row; }
      }
      if (best) {
        // Artikel yang URL-nya sama dgn sumber terakhir titik ini = berita
        // yang sama muncul lagi di run berikutnya -> lewati (jangan menumpuk
        // catatan [Update] identik berulang).
        if (item.link && item.link === best.source_media_url) {
          results.skipped += 1;
          log(`  ~ sudah tercatat #${best.id} (sumber sama): ${title} — ${item.source}`);
          continue;
        }
        const isProgress = hasAny(low, DAMAGE_KEYWORDS) && COMPLETE_RE.test(low) === false
          ? hasAny(low, ['mulai diperbaiki', 'mulai dikerjakan', 'segera diperbaiki', 'diperbaiki', 'perbaikan', 'bangun', 'darurat', 'normalisasi', 'dikerjakan', 'terpasang', 'bakal', 'permanen'])
          : COMPLETE_RE.test(low);
        const kind = isProgress ? 'progres' : 'sama';
        if (dry) {
          log(`  [${kind === 'progres' ? 'update' : 'cover'} -> #${best.id}] ${title} — ${item.source}`);
        } else if (kind === 'progres') {
          const applied = applyUpdate(best, item, { kind, log });
          if (applied !== false) {
            results.updated += 1;
            existing = existing.map((r) => (r.id === best.id ? best : r));
          }
        } else {
          // peristiwa SAMA (outlet lain): titik sudah mewakili -> jangan
          // menumpuk deskripsi, jangan membuat titik baru.
          results.skipped += 1;
          log(`  ~ sudah terwakili #${best.id} (outlet lain): ${title} — ${item.source}`);
        }
        continue;
      }

      // ---- 2) tidak ada titik induk: berita PERBAIKAN saja = lewati ----
      if (!hasAny(low, DAMAGE_KEYWORDS)) {
        results.skipped += 1;
        if (dry) log(`  - lewati (update tanpa titik induk): ${title}`);
        continue;
      }

      // ---- 3) TITIK BARU ----
      if (hasUrl(item.link)) continue;
      if (!locs) { results.skipped += 1; continue; } // tanpa lokasi jelas -> jangan menebak
      results.candidates += 1;
      results.items.push({ item, locs });
      if (results.items.length >= MAX_PER_RUN) break;
    }
    if (results.items.length >= MAX_PER_RUN) break;
  }

  // geocode + insert titik baru (hanya mode non-dry)
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
      entry.infra, entry.severity,
      entry.title, entry.locName, latFinal, lngFinal,
      entry.source, entry.url, entry.pubDate || null
    );
    results.inserted += 1;
    const newRow = {
      id: Number(stmt.lastInsertRowid), description: entry.title, location_name: entry.locName,
      lat: latFinal, lng: lngFinal, severity: entry.severity, status: 'dilaporkan',
      infra_type: entry.infra, source_media_url: entry.url,
      source_media_name: entry.source, source_media_date: entry.pubDate,
    };
    existing.push(newRow);
    existingUrls.add(entry.url);
    log(`  + masuk peta: ${entry.severity}/${entry.infra} @ ${entry.locName} — ${entry.title} (${entry.source})`);
  }

  try {
    require('fs').mkdirSync(require('path').join(__dirname, '..', 'data'), { recursive: true });
    require('fs').writeFileSync(geoCacheFile, JSON.stringify(cache));
  } catch (_e) { /* cache best-effort */ }

  return results;
}

const MAX_UPDATES = 15;

// Update satu titik media dari artikel baru. Berlaku HANYA untuk titik yang
// SUDAH ADA di peta (sudah pernah masuk sbg titik rusak) — titik yang baru
// di-seed/di-insert tetap murni laporan kerusakan. Status TIDAK diubah oleh
// monitor; bila artikel jelas menyatakan perbaikan selesai/dibuka kembali,
// monitor mencatat klaim media (media_repair_url/at) -> titik hijau tanpa ✓
// menunggu verifikasi otoritas.
function applyUpdate(row, item, { kind, log } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const note = `[Update ${today}: ${item.title} — ${item.source}]`;
  const base = String(row.description || '').trim();
  // catatan identik sudah pernah ditulis -> jangan append berulang
  if (base && base.includes(item.title) && base.includes(item.source)) {
    log(`  ~ catatan sudah ada #${row.id} (tidak diulang): ${item.title} — ${item.source}`);
    return false;
  }
  let desc = base ? `${base} ${note}` : `${item.title} ${note}`;
  if (desc.length > 4500) desc = base.length > 4500 ? base.slice(0, 4500) : desc;
  const sev = classifySeverity(item.title);
  const sevUp = SEV_ORD[sev] > (SEV_ORD[row.severity] || 0);
  const low = String(item.title || '').toLowerCase();
  const complete = COMPLETE_RE.test(low);
  const setMediaClaim = complete && row.status === 'dilaporkan';
  const nowIso = new Date().toISOString();
  if (setMediaClaim) {
    db.prepare(
      `UPDATE reports SET description = ?, severity = CASE WHEN ? > 0 THEN ? ELSE severity END,
       source_media_name = ?, source_media_url = ?, source_media_date = ?,
       media_repair_url = ?, media_repair_at = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(desc, sevUp ? 1 : 0, sev, item.source || row.source_media_name, item.link,
      item.pubDate || row.source_media_date, item.link, nowIso, row.id);
    row.media_repair_url = item.link;
    row.media_repair_at = nowIso;
  } else {
    db.prepare(
      `UPDATE reports SET description = ?, severity = CASE WHEN ? > 0 THEN ? ELSE severity END,
       source_media_name = ?, source_media_url = ?, source_media_date = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(desc, sevUp ? 1 : 0, sev, item.source || row.source_media_name, item.link,
      item.pubDate || row.source_media_date, row.id);
  }
  row.description = desc;
  row.severity = sevUp ? sev : row.severity;
  row.source_media_url = item.link;
  row.source_media_name = item.source || row.source_media_name;
  row.source_media_date = item.pubDate || row.source_media_date;
  const extra = sevUp ? ' + severity naik' : '';
  const claim = setMediaClaim ? ' => klaim media: sudah diperbaiki (menunggu otoritas, hijau tanpa ✓)' : '';
  log(`  ~ update #${row.id}: ${kind === 'progres' ? 'progres perbaikan' : 'peristiwa sama (sumber baru)'}${extra}${claim}: ${item.title} (${item.source})`);
}

// Gabung duplikat ISI yang terlanjur ada (aturan user: objek/peristiwa SAMA
// lintas media = SATU titik). Panggil sekali di awal tiap run (idempotent).
function mergeMediaDuplicates(log) {
  const rows = db.prepare(
    `SELECT id, description, location_name, lat, lng, severity, infra_type
     FROM reports WHERE source_type = 'media' ORDER BY id`
  ).all();
  let removed = 0;
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i];
    if (!a) continue;
    for (let j = i + 1; j < rows.length; j++) {
      const b = rows[j];
      if (!b) continue;
      if (a.infra_type !== b.infra_type) continue;
      const dLat = Math.abs((a.lat || 0) - (b.lat || 0));
      const dLng = Math.abs((a.lng || 0) - (b.lng || 0));
      if (dLat > 0.5 || dLng > 0.5) continue; // lokasi beda jauh
      const over = tokenOverlap(a.description || '', b.description || '');
      if (over < 0.35) continue;
      const shared = (() => {
        const st = specificTokens(a.description || '');
        const sr = specificTokens(b.description || '');
        for (const w of st) if (sr.has(w)) return true;
        return false;
      })();
      const nameMatch = locContains(a.location_name, b.location_name) || locContains(b.location_name, a.location_name);
      if (!(nameMatch && (over >= 0.38 || shared))) continue;
      // keep: deskripsi paling panjang/spesifik (paling informatif)
      const keep = String(b.description || '').length > String(a.description || '').length ? b : a;
      const drop = keep.id === a.id ? b : a;
      db.prepare('DELETE FROM reports WHERE id = ?').run(drop.id);
      rows[rows.indexOf(drop)] = null;
      removed += 1;
      log(`  ~ gabung duplikat: #${drop.id} -> #${keep.id} (${keep.location_name})`);
    }
  }
  return removed;
}

module.exports = { runMonitor, QUERIES };
