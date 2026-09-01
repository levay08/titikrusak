'use strict';

// backend/services/bmkgClient.js
// Klien data terbuka BMKG (File 2 Bagian 7.2; File 1 Bagian 5.8):
//   - gempa terkini : https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json
//                     (gempa terbaru) dan gempaterkini.json (daftar)
//   - cuaca 3-harian : https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=...
//                     (kode wilayah adm4 — lihat bmkgAdm4.js)
//
// SEMUA fungsi enrichment BEST-EFFORT: mengembalikan null (bukan error)
// bila gagal atau tidak ada data relevan — TIDAK boleh melempar error yang
// menghentikan proses lain (File 2 Bagian 7.2). Atribusi "Sumber: BMKG"
// wajib dicantumkan di UI (File 1 Bagian 10.4/11.4).

const { haversineKm } = require('./haversine.js');
const { findNearestAdm4 } = require('./bmkgAdm4.js');

const AUTO_GEMPA_URL = 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json';
const GEMPATERKINI_URL = 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json';
const WEATHER_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca';

// Radius maksimal gempa yang dianggap "dekat" dengan laporan (File 1 5.8:
// 50-100 km) — dipakai 100 km.
const QUAKE_RADIUS_KM = 100;
// Rentang waktu gempa relevan: 30 hari sebelum laporan dibuat.
const QUAKE_WINDOW_DAYS = 30;
// Radius adm4 terdekat untuk prakiraan cuaca (daftar kurasi).
const ADM4_RADIUS_KM = 60;

// BMKG menolak User-Agent default (Python-urllib / node) dengan HTTP 403 —
// wajib mengirim User-Agent browser-like agar data terbuka dapat diakses.
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function createBmkgClient({ fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  // Fetch dengan batas waktu; SELALU kembalikan null bila gagal.
  async function fetchJson(url) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetchImpl(url, {
        signal: ctrl.signal,
        headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      const text = await res.text();
      return JSON.parse(text);
    } catch (_e) {
      return null;
    }
  }

  // Normalisasi satu entri gempa BMKG -> {magnitude, location, date (ISO),
  // lat, lng, depth}.
  function parseQuake(item) {
    if (!item || typeof item !== 'object') return null;
    const coordStr = String(item.Coordinates || '').trim();
    const parts = coordStr.split(',').map((s) => Number(s.trim()));
    if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
    const magnitude = Number(item.Magnitude);
    if (!Number.isFinite(magnitude)) return null;
    // Tanggal: preferensi DateTime (ISO UTC); fallback Tanggal+Jam WIB.
    let date = null;
    if (item.DateTime) {
      const t = Date.parse(item.DateTime);
      if (Number.isFinite(t)) date = new Date(t).toISOString();
    }
    if (!date && item.Tanggal && item.Jam) {
      // "31 Agu 2026" + "18:47:08 WIB" (WIB = UTC+7)
      const m = String(item.Jam).match(/(\d{2}):(\d{2}):(\d{2})/);
      if (m) {
        const t = Date.parse(`${item.Tanggal} ${m[1]}:${m[2]}:${m[3]} +0700`);
        if (Number.isFinite(t)) date = new Date(t).toISOString();
      }
    }
    return {
      magnitude,
      location: String(item.Wilayah || '').trim(),
      date,
      lat: parts[0],
      lng: parts[1],
      depth: String(item.Kedalaman || '').trim(),
    };
  }

  // Gabung autogempa (1) + gempaterkini (daftar), dedupe.
  async function fetchEarthquakes() {
    const out = [];
    const seen = new Set();
    const [auto, list] = await Promise.all([
      fetchJson(AUTO_GEMPA_URL),
      fetchJson(GEMPATERKINI_URL),
    ]);
    const items = [];
    if (auto && auto.Infogempa && auto.Infogempa.gempa) {
      items.push(auto.Infogempa.gempa);
    }
    if (list && list.Infogempa && Array.isArray(list.Infogempa.gempa)) {
      items.push(...list.Infogempa.gempa);
    }
    for (const item of items) {
      const q = parseQuake(item);
      if (!q) continue;
      const key = `${q.date || ''}|${q.lat},${q.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(q);
    }
    return out;
  }

  // Enrichment gempa (File 1 5.8): gempa terdekat dalam radius 100 km DAN
  // dalam 30 hari sebelum tanggal laporan. Hasil:
  //   { magnitude, location, date, distance_km } | null
  async function enrichEarthquake({ lat, lng, date }) {
    try {
      if (![lat, lng].every(Number.isFinite)) return null;
      const reportTime = date ? Date.parse(date) : Date.now();
      if (!Number.isFinite(reportTime)) return null;
      const windowStart = reportTime - QUAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const quakes = await fetchEarthquakes();
      let best = null;
      for (const q of quakes) {
        if (!q.date) continue;
        const qTime = Date.parse(q.date);
        if (!Number.isFinite(qTime)) continue;
        // Hanya gempa dalam jendela 30 hari (sedikit toleransi ke depan).
        if (qTime < windowStart || qTime > reportTime + 24 * 60 * 60 * 1000) continue;
        const dist = haversineKm(lat, lng, q.lat, q.lng);
        if (dist === null || dist > QUAKE_RADIUS_KM) continue;
        if (!best || dist < best.distance_km) {
          best = {
            magnitude: q.magnitude,
            location: q.location,
            date: q.date.slice(0, 10),
            distance_km: Math.round(dist),
          };
        }
      }
      return best;
    } catch (_e) {
      return null;
    }
  }

  // Enrichment cuaca (File 1 5.8): prakiraan 3-harian BMKG untuk adm4
  // terdekat. Hasil: { condition, temp_range, valid_date } | null.
  async function enrichWeather({ lat, lng }) {
    try {
      if (![lat, lng].every(Number.isFinite)) return null;
      const area = findNearestAdm4(lat, lng, ADM4_RADIUS_KM);
      if (!area) return null;
      const data = await fetchJson(`${WEATHER_URL}?adm4=${encodeURIComponent(area.adm4)}`);
      if (!data || !Array.isArray(data.data) || !data.data[0]) return null;
      const cuaca = data.data[0].cuaca;
      if (!Array.isArray(cuaca) || !Array.isArray(cuaca[0]) || cuaca[0].length === 0) {
        return null;
      }
      const day1 = cuaca[0];
      let minT = Infinity;
      let maxT = -Infinity;
      let midday = day1[0];
      let middayDiff = Infinity;
      for (const p of day1) {
        if (typeof p.t === 'number') {
          if (p.t < minT) minT = p.t;
          if (p.t > maxT) maxT = p.t;
        }
        const hm = String(p.local_datetime || '').match(/(\d{2}):(\d{2})/);
        if (hm) {
          const diff = Math.abs(Number(hm[1]) * 60 + Number(hm[2]) - 12 * 60);
          if (diff < middayDiff) {
            middayDiff = diff;
            midday = p;
          }
        }
      }
      if (minT === Infinity || maxT === -Infinity) return null;
      const validDate = String(midday.local_datetime || '').slice(0, 10);
      return {
        condition: String(midday.weather_desc || '').trim() || null,
        temp_range: `${Math.round(minT)}–${Math.round(maxT)}°C`,
        valid_date: validDate || null,
      };
    } catch (_e) {
      return null;
    }
  }

  return { fetchEarthquakes, enrichEarthquake, enrichWeather, parseQuake };
}

// Instance default untuk produksi.
const bmkg = createBmkgClient();

module.exports = { createBmkgClient, bmkg };
