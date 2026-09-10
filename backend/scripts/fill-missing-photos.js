// qa-photo-gap.js — lengkapi foto titik yang belum punya foto.
// Urutan usaha:
//   1. og:image dari artikel media LAIN yang meliput peristiwa sama
//      (halaman harus memuat kata khas lokasi titik = bukti peristiwa sama);
//   2. og:image dari artikel sumber sendiri;
//   3. gambar utama di BADAN artikel (situs pemerintah/situs tanpa og:image).
//
//   node qa-photo-gap.js            -> periksa saja
//   node qa-photo-gap.js --apply    -> tulis photo_urls
'use strict';
const path = require('path');
const Database = require('better-sqlite3');
const { fetchOgImage } = require('../services/newsMonitor.js');

const APPLY = process.argv.includes('--apply');
const db = new Database(path.join(__dirname, '..', 'reports.db'));
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

// Kandidat liputan media lain per titik (peristiwa sama) + kata khas wajib.
const CANDIDATES = {
  112: {
    tokens: ['tanjung ratu ilir', 'way pengubuan'],
    urls: [
      'https://lampung.tribunnews.com/lampung/1215998/kapolres-lampung-tengah-cek-jembatan-putus-di-tanjung-ratu-ilir',
      'https://regional.kompas.com/read/2026/08/13/191039478/jembatan-berusia-53-tahun-di-lampung-tengah-putus-akses-warga-hingga',
    ],
  },
  497: {
    tokens: ['umbar', 'putih doh', 'tanggamus'],
    urls: [
      'https://lampung.antaranews.com/berita/816486/pemprov-lampung-tangani-empat-titik-longsor-ruas-simpang-umbar-putih-doh',
      'https://lampungpro.co/news/pemprov-lampung-percepat-perbaikan-longsor-di-ruas-jalan-simpang-umbar---putih-doh-tanggamus',
      'https://lampungrayanews.com/jihan-tinjau-progres-perbaikan-ruas-jalan-provinsi-simpang-umbar-putih-doh-di-tanggamus/',
    ],
  },
  111: { tokens: ['pasar batu'], urls: [] },
};

async function getHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Gambar utama dari badan artikel: <img> pertama yang bukan logo/ikon kecil.
function firstContentImage(html, baseUrl) {
  const urls = [];
  const re = /<img[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) urls.push(m[1]);
  for (const raw of urls) {
    const u = raw.startsWith('//') ? `https:${raw}` : raw;
    if (!/^https?:\/\//i.test(u)) continue;
    if (/(logo|icon|favicon|sprite|placeholder|avatar|banner-?iklan|ads?\/)/i.test(u)) continue;
    if (/\.svg(\?|$)/i.test(u)) continue;
    try {
      return new URL(u, baseUrl).href;
    } catch (_e) {
      /* lanjut */
    }
  }
  return null;
}

(async () => {
  const rows = db
    .prepare(
      `SELECT id, location_name, source_media_url FROM reports
       WHERE photo_urls IS NULL OR photo_urls IN ('', '[]') ORDER BY id`
    )
    .all();
  console.log(`titik tanpa foto: ${rows.length}`);
  let fixed = 0;

  for (const r of rows) {
    const cand = CANDIDATES[r.id] || { tokens: [], urls: [] };
    console.log(`\n#${r.id} ${r.location_name}`);
    let photo = null;
    let from = '';

    // 1) liputan media lain
    for (const url of cand.urls) {
      try {
        const html = await getHtml(url);
        const low = html.toLowerCase();
        const hit = cand.tokens.filter((t) => low.includes(t));
        if (!hit.length) {
          console.log(`  - tolak ${url.slice(0, 62)} (kata khas tidak ada)`);
          continue;
        }
        const img = await fetchOgImage(url);
        if (!img) {
          console.log(`  - ${url.slice(0, 62)}: og:image kosong`);
          continue;
        }
        photo = img;
        from = `media lain (${hit.join(', ')})`;
        break;
      } catch (e) {
        console.log(`  - ${url.slice(0, 62)}: ${e.message}`);
      }
    }

    // 2/3) artikel sumber sendiri: og:image, lalu gambar badan artikel
    if (!photo && /^https?:/i.test(String(r.source_media_url || ''))) {
      try {
        const html = await getHtml(r.source_media_url);
        photo = (await fetchOgImage(r.source_media_url)) || firstContentImage(html, r.source_media_url);
        if (photo) from = 'artikel sumber (gambar badan artikel)';
      } catch (e) {
        console.log(`  - sumber sendiri gagal: ${e.message}`);
      }
    }

    if (photo) {
      console.log(`  + dari ${from}`);
      console.log(`  + foto: ${photo.slice(0, 110)}`);
      if (APPLY) {
        db.prepare('UPDATE reports SET photo_urls = ? WHERE id = ?').run(JSON.stringify([photo]), r.id);
        fixed += 1;
      }
    } else {
      console.log('  ! belum dapat foto yang terverifikasi');
    }
  }

  console.log(`\nfoto dilengkapi: ${fixed}${APPLY ? '' : ' (dry-run)'}`);
  const left = db
    .prepare("SELECT COUNT(*) c FROM reports WHERE photo_urls IS NULL OR photo_urls IN ('','[]')")
    .get().c;
  console.log(`sisa tanpa foto: ${left}`);
  db.close();
})();
