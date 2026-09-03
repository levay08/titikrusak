'use strict';

// backend/services/osmEnrich.js
// Enrichment OpenStreetMap (Overpass API) - 4 Sep 2026.
// Untuk SETIAP titik di peta: cari objek infrastruktur (jembatan/jalan/
// sekolah/utilitas) terdekat di OSM sebagai konfirmasi & konteks tambahan.
// Gratis & tanpa approval (patuh usage policy: User-Agent jelas, jeda
// antar request, kolom diisi sekali; Overpass diakses jarang).

const HOSTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const UA = 'titikrusak-id-osm-enrich/1.0 (portal kerusakan infrastruktur Indonesia; kontak wa.me/62818101990)';
const RADIUS_M = 800;

function ensureColumns(db) {
  const cols = db.prepare('PRAGMA table_info(reports)').all().map((c) => c.name);
  if (!cols.includes('enriched_osm')) {
    db.prepare("ALTER TABLE reports ADD COLUMN enriched_osm TEXT").run();
  }
}

// Panggil Overpass (multi-host + retry saat 429/5xx) untuk satu koordinat.
async function queryNear(lat, lng) {
  const q =
    `[out:json][timeout:25];(` +
    `way["highway"](around:${RADIUS_M},${lat},${lng});` +
    `way["amenity"="school"](around:${RADIUS_M},${lat},${lng});` +
    `way["building"="school"](around:${RADIUS_M},${lat},${lng});` +
    `way["man_made"~"^(bridge|pier)$"](around:${RADIUS_M},${lat},${lng});` +
    `way["power"~"^(line|tower|pole)$"](around:${RADIUS_M},${lat},${lng});` +
    `);out center tags 60;`;
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const host = HOSTS[(attempt + Math.floor(Math.random() * HOSTS.length)) % HOSTS.length];
    try {
      const res = await fetch(host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Overpass HTTP ${res.status} (${host})`);
        await new Promise((ok) => setTimeout(ok, 3000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status} (${host})`);
      const data = await res.json();
      const els = Array.isArray(data.elements) ? data.elements : [];
      const cands = [];
      for (const el of els) {
        if (el.type !== 'way' || !el.tags || !el.center) continue;
        const clat = Number(el.center.lat);
        const clng = Number(el.center.lon !== undefined ? el.center.lon : el.center.lng);
        if (!Number.isFinite(clat) || !Number.isFinite(clng)) continue;
        const dx = (clat - lat) * 111320;
        const dy = (clng - lng) * 111320 * Math.cos((lat * Math.PI) / 180);
        cands.push({ tags: el.tags, center: { lat: clat, lng: clng }, d: Math.round(Math.hypot(dx, dy)) });
      }
      return cands;
    } catch (err) {
      lastErr = err;
      await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)));
    }
  }
  throw lastErr || new Error('Overpass gagal');
}

function labelOf(tags) {
  if (tags.bridge && tags.bridge !== 'no') return 'Jembatan';
  if (tags.highway) {
    if (tags.bridge && tags.bridge !== 'no') return 'Jembatan';
    const h = String(tags.highway).replace(/_/g, ' ');
    return `Jalan (${h})`;
  }
  if (tags.amenity === 'school' || tags.building === 'school') return 'Sekolah';
  if (tags.man_made) return 'Jembatan/penyeberangan';
  if (tags.power) return 'Utilitas (listrik)';
  return 'Prasarana publik';
}

// Cocokkan dengan jenis laporan agar hasilnya relevan: jenis yang sama
// diprioritaskan, lalu sisanya diambil yang terdekat.
function pickCandidate(cands, reportInfra) {
  if (!cands.length) return null;
  const want = {
    jembatan: 'Jembatan',
    jalan: 'Jalan',
    sekolah: 'Sekolah',
    utilitas: 'Utilitas',
  }[reportInfra];
  const sorted = [...cands].sort((a, b) => a.d - b.d);
  if (want) {
    const hit = sorted.find((c) => labelOf(c.tags).startsWith(want));
    if (hit) return hit;
  }
  return sorted[0];
}

function textOf(c, reportInfra) {
  const label = labelOf(c.tags);
  const name = c.tags.name || c.tags.ref || '';
  const base = `OSM: ${label}`;
  const withName = name ? `${base} - ${String(name).slice(0, 80)}` : base;
  return `${withName} (±${c.d} m dari titik)`;
}

// Enrich satu laporan: tulis kolom enriched_osm bila ada kandidat.
async function enrichOne(db, report) {
  try {
    const cands = await queryNear(report.lat, report.lng);
    const pick = pickCandidate(cands, report.infra_type);
    if (!pick) {
      db.prepare('UPDATE reports SET enriched_osm = ? WHERE id = ?').run(null, report.id);
      return 'kosong';
    }
    db.prepare('UPDATE reports SET enriched_osm = ? WHERE id = ?').run(
      textOf(pick, report.infra_type),
      report.id
    );
    return 'terisi';
  } catch (err) {
    return 'error:' + String(err.message).slice(0, 80);
  }
}

module.exports = { ensureColumns, enrichOne, RADIUS_M };
