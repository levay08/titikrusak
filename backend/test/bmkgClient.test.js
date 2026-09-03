'use strict';

// backend/test/bmkgClient.test.js
// Unit test enrichment BMKG (File 2 Bagian 7.2 / File 1 Bagian 5.8):
//   - haversine (jarak km)
//   - parsing & dedupe gempa (autogempa + gempaterkini)
//   - enrichEarthquake: radius 100 km + jendela 30 hari -> JSON | null
//   - enrichWeather: adm4 terdekat -> {condition, temp_range, valid_date} | null
//   - SEMUA fungsi mengembalikan null (bukan error) saat fetch gagal.
// Memakai fetch TIRUAN - tidak memanggil API asli.

const test = require('node:test');
const assert = require('node:assert/strict');
const { haversineKm } = require('../services/haversine.js');
const { createBmkgClient } = require('../services/bmkgClient.js');

const AUTO_GEMPA = {
  Infogempa: {
    gempa: {
      Tanggal: '31 Agu 2026',
      Jam: '18:47:08 WIB',
      DateTime: '2026-08-31T11:47:08+00:00',
      Coordinates: '-2.34,120.58',
      Magnitude: '3.7',
      Kedalaman: '5 km',
      Wilayah: 'Pusat gempa berada di darat 35 km Timur Laut Luwu Utara',
    },
  },
};

const GEMPATERKINI = {
  Infogempa: {
    gempa: [
      {
        Tanggal: '31 Agu 2026',
        Jam: '15:03:29 WIB',
        DateTime: '2026-08-31T07:03:29+00:00',
        Coordinates: '-8.17,120.58',
        Magnitude: '5.5',
        Kedalaman: '10 km',
        Wilayah: '50 km TimurLaut RUTENG-MANGGARAI-NTT',
      },
      {
        Tanggal: '29 Agu 2026',
        Jam: '15:08:45 WIB',
        DateTime: '2026-08-29T08:08:45+00:00',
        Coordinates: '-0.67,126.75',
        Magnitude: '5.1',
        Kedalaman: '33 km',
        Wilayah: '83 km BaratDaya LABUHA-MALUT',
      },
      // Gempa SAMA dengan autogempa (uji dedupe) + gempa LUAR jendela 30 hari.
      {
        Tanggal: '31 Agu 2026',
        Jam: '18:47:08 WIB',
        DateTime: '2026-08-31T11:47:08+00:00',
        Coordinates: '-2.34,120.58',
        Magnitude: '3.7',
        Kedalaman: '5 km',
        Wilayah: '35 km Timur Laut Luwu Utara',
      },
      {
        Tanggal: '1 Jun 2026',
        Jam: '02:00:00 WIB',
        DateTime: '2026-05-31T19:00:00+00:00',
        Coordinates: '-8.2,120.6',
        Magnitude: '4.5',
        Kedalaman: '10 km',
        Wilayah: 'Dekat Ruteng (lama, luar jendela)',
      },
    ],
  },
};

const WEATHER_RUTENG = {
  lokasi: { adm4: '53.10.01.1001', desa: 'Ruteng', lon: 120.46, lat: -8.61 },
  data: [
    {
      cuaca: [
        [
          { local_datetime: '2026-09-01 06:00:00', t: 22, weather_desc: 'Berawan' },
          { local_datetime: '2026-09-01 12:00:00', t: 30, weather_desc: 'Cerah Berawan' },
          { local_datetime: '2026-09-01 15:00:00', t: 29, weather_desc: 'Cerah' },
        ],
      ],
    },
  ],
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

// Mock fetch berdasarkan URL; throw untuk URL tak dikenal (simulasi gagal).
function makeFetchMock(routes) {
  return async (url) => {
    for (const route of routes) {
      if (url.startsWith(route.prefix)) return jsonResponse(200, route.body);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

test('haversineKm: jarak antar koordinat (km)', () => {
  assert.equal(haversineKm(-6.2, 106.816, -6.2, 106.816), 0);
  // Jakarta (-6.2, 106.816) -> Bandung (-6.917, 107.6) ~ 118 km.
  const d = haversineKm(-6.2, 106.816, -6.917, 107.6);
  assert.ok(d > 115 && d < 122, `jarak Jakarta-Bandung ~118 km, dapat ${d}`);
  // Koordinat tidak valid -> null.
  assert.equal(haversineKm(NaN, 106, -6, 107), null);
});

test('fetchEarthquakes: gabung autogempa + gempaterkini, dedupe berdasarkan waktu+koordinat', async () => {
  const client = createBmkgClient({
    fetchImpl: makeFetchMock([
      { prefix: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', body: AUTO_GEMPA },
      { prefix: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', body: GEMPATERKINI },
    ]),
  });
  const quakes = await client.fetchEarthquakes();
  // 1 (auto) + 4 (list) - 1 duplikat = 4 unik.
  assert.equal(quakes.length, 4);
  assert.ok(quakes.some((q) => q.magnitude === 5.5 && q.location.includes('RUTENG')));
});

test('enrichEarthquake: gempa dalam radius 100 km & 30 hari -> {magnitude, location, date, distance_km}', async () => {
  const client = createBmkgClient({
    fetchImpl: makeFetchMock([
      { prefix: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', body: AUTO_GEMPA },
      { prefix: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', body: GEMPATERKINI },
    ]),
  });
  // Laporan di Kota Ruteng (-8.611, 120.466), dibuat 1 Sep 2026.
  const eq = await client.enrichEarthquake({
    lat: -8.611,
    lng: 120.466,
    date: '2026-09-01T00:00:00Z',
  });
  assert.ok(eq, 'harus menemukan gempa Ruteng M5.5');
  assert.equal(eq.magnitude, 5.5);
  assert.ok(eq.location.includes('RUTENG'));
  assert.equal(eq.date, '2026-08-31');
  assert.ok(eq.distance_km > 40 && eq.distance_km < 55, `jarak ~50 km, dapat ${eq.distance_km}`);
});

test('enrichEarthquake: lokasi jauh -> null', async () => {
  const client = createBmkgClient({
    fetchImpl: makeFetchMock([
      { prefix: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', body: AUTO_GEMPA },
      { prefix: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', body: GEMPATERKINI },
    ]),
  });
  const eq = await client.enrichEarthquake({ lat: -6.2, lng: 106.816, date: '2026-09-01T00:00:00Z' });
  assert.equal(eq, null);
});

test('enrichEarthquake: gempa di luar jendela 30 hari -> null (walau dekat)', async () => {
  const client = createBmkgClient({
    fetchImpl: makeFetchMock([
      { prefix: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json', body: AUTO_GEMPA },
      { prefix: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json', body: GEMPATERKINI },
    ]),
  });
  // Laporan dibuat 1 Juli 2026 - gempa Ruteng (31 Agu) belum terjadi saat itu.
  const eq = await client.enrichEarthquake({
    lat: -8.611,
    lng: 120.466,
    date: '2026-07-01T00:00:00Z',
  });
  assert.equal(eq, null);
});

test('enrichWeather: adm4 terdekat -> {condition, temp_range, valid_date}', async () => {
  const client = createBmkgClient({
    fetchImpl: makeFetchMock([{ prefix: 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=53.10.12.1001', body: WEATHER_RUTENG }]),
  });
  const wx = await client.enrichWeather({ lat: -8.611, lng: 120.466 });
  assert.deepEqual(wx, {
    condition: 'Cerah Berawan',
    temp_range: '22–30°C',
    valid_date: '2026-09-01',
  });
});

test('enrichWeather: lokasi jauh dari daftar adm4 -> null', async () => {
  const client = createBmkgClient({ fetchImpl: makeFetchMock([]) });
  // Tengah Laut Jawa - tidak ada adm4 kurasi dalam 60 km.
  const wx = await client.enrichWeather({ lat: -6.0, lng: 112.0 });
  assert.equal(wx, null);
});

test('fetch gagal -> SEMUA fungsi mengembalikan null (tidak melempar)', async () => {
  const failing = createBmkgClient({ fetchImpl: async () => { throw new Error('network down'); } });
  assert.equal(await failing.fetchEarthquakes().then((q) => q.length), 0);
  assert.equal(await failing.enrichEarthquake({ lat: -8.6, lng: 120.4, date: '2026-09-01T00:00:00Z' }), null);
  assert.equal(await failing.enrichWeather({ lat: -8.6, lng: 120.4 }), null);
});
