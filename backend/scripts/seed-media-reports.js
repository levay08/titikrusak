'use strict';

// backend/scripts/seed-media-reports.js
// Mengisi laporan KERUSAKAN INFRASTRUKTUR dari berita (sumber media)
// 2 tahun terakhir ke dalam DB (File 1 Bagian 6.2: source_type='media').
// Data: scripts/media-reports.json. Idempotent - melewati laporan yang
// source_media_url-nya sudah ada.
//
// Untuk tiap entri:
//   1. geocode lokasi via Nominatim (1 permintaan/detik, hormati usage policy)
//      -> lat/lng; fallback ke koordinat perkiraan di data.
//   2. ambil foto utama artikel (og:image) dari HTML artikel -> photo_urls.
//      Gagal/gambar tidak ada -> photo_urls null (boleh di-skip).
//   3. INSERT ke tabel reports (source_type 'media', reporter anonim,
//      status 'dilaporkan').

const path = require('path');
const db = require('../db/db.js');

const ITEMS = require('./media-reports.json');

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'titikrusak-id-seed/1.0 (kontak: dev@titikrusak.id)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(query) {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`nominatim HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  }
  return null;
}

async function fetchOgImage(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const m =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      );
    if (!m) return null;
    const img = m[1].trim();
    return /^https?:\/\//i.test(img) ? img : null;
  } catch (_e) {
    return null;
  }
}

const VITAL = (arr) => JSON.stringify(arr || ['akses_antar_kampung']);
const EXISTS = db.prepare('SELECT id FROM reports WHERE source_media_url = ?');
// Cek tabrakan koordinat PERSIS dengan titik media lain (penyebab marker
// tak bisa diklik: dua laporan di koordinat sama, yang di atas menutupi).
const COORD_USED = db.prepare(
  "SELECT id FROM reports WHERE source_type='media' AND abs(lat - ?) < 0.00005 AND abs(lng - ?) < 0.00005"
);

// Geser koordinat sedikit (≈1-2 km) bila sudah dipakai titik media lain,
// agar tiap marker tetap bisa diklik & popup-nya terbuka.
function avoidCoordCollision(lat, lng) {
  let outLat = lat;
  let outLng = lng;
  let guard = 0;
  while (COORD_USED.get(outLat, outLng) && guard < 8) {
    outLat = outLat + (guard % 2 === 0 ? 0.02 : 0.01);
    outLng = outLng + (guard % 2 === 1 ? 0.02 : 0.01);
    guard += 1;
  }
  if (guard > 0) console.log(`  ~ koordinat digeser (anti-tumpuk): (${lat}, ${lng}) -> (${outLat.toFixed(4)}, ${outLng.toFixed(4)})`);
  return { lat: outLat, lng: outLng };
}

async function main() {
  let inserted = 0;
  let skipped = 0;
  let noGeo = 0;

  for (const item of ITEMS) {
    if (EXISTS.get(item.source_url)) {
      console.log(`- SKIP (sudah ada): ${item.location_name}`);
      skipped += 1;
      continue;
    }

    let lat = item.fallback_lat;
    let lng = item.fallback_lng;
    try {
      const g = await geocode(item.geocode_query);
      if (g) {
        lat = g.lat;
        lng = g.lng;
      } else {
        noGeo += 1;
        console.log(`  ~ geocode kosong, pakai fallback: ${item.geocode_query}`);
      }
    } catch (err) {
      noGeo += 1;
      console.log(`  ~ geocode error (${err.message}), pakai fallback: ${item.geocode_query}`);
    }
    await sleep(1100); // hormati usage policy Nominatim

    // Titik media TIDAK boleh menumpuk di koordinat yang sama persis.
    const final = avoidCoordCollision(lat, lng);
    lat = final.lat;
    lng = final.lng;

    // Foto: prioritas photo_url dari JSON (hasil kurasi/riset, sudah
    // terverifikasi), fallback ambil og:image dari halaman artikel.
    const photo = /^https?:\/\//i.test(item.photo_url || '')
      ? item.photo_url
      : await fetchOgImage(item.source_url);
    if (photo) console.log(`  ~ foto: ${photo.slice(0, 90)}…`);
    else console.log('  ~ tanpa foto (og:image tidak ditemukan)');

    db.prepare(
      `INSERT INTO reports (
         infra_type, severity, bridge_authority, vital_status, vital_status_note,
         description, location_name, lat, lng, photo_urls, status,
         source_type, source_media_name, source_media_url, source_media_date,
         related_earthquake
       ) VALUES (?, ?, 'tidak_diketahui', ?, NULL, ?, ?, ?, ?, ?, 'dilaporkan', 'media', ?, ?, ?, ?)`
    ).run(
      item.infra_type,
      item.severity,
      VITAL(item.vital_status),
      item.description,
      item.location_name,
      lat,
      lng,
      photo ? JSON.stringify([photo]) : null,
      item.source_name,
      item.source_url,
      item.source_date,
      item.related_earthquake || null
    );
    inserted += 1;
    console.log(`+ INSERT: ${item.location_name} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    await sleep(200);
  }

  const total = db.prepare("SELECT COUNT(*) c FROM reports WHERE source_type = 'media'").get().c;
  console.log('\n=== Ringkasan ===');
  console.log(`inserted: ${inserted} | skipped: ${skipped} | fallback-geocode: ${noGeo}`);
  console.log(`total laporan media di DB: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
