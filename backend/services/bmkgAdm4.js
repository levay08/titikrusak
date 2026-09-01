'use strict';

// backend/services/bmkgAdm4.js
// Daftar kode wilayah adm4 (kelurahan/desa, format PP.KK.KEC.XXXX sesuai
// Kepmendagri 100.1.1-6117/2022) untuk WILAYAH-WILAYAH UTAMA Indonesia,
// beserta koordinat perkiraan. Dipakai mencocokkan koordinat laporan ke
// adm4 TERDEKAT (dalam radius ~60 km) untuk mengambil prakiraan cuaca
// BMKG (api.bmkg.go.id/publik/prakiraan-cuaca?adm4=...).
//
// Sifat: kurasi (best-effort). Lokasi di luar daftar -> enrichment cuaca
// mengembalikan null (sesuai aturan File 2 Bagian 7.2: null, bukan error).

const ADM4_AREAS = [
  { adm4: '11.71.01.2001', name: 'Banda Aceh', lat: 5.552, lon: 95.317 },
  { adm4: '11.73.01.2002', name: 'Lhokseumawe', lat: 5.18, lon: 97.15 },
  { adm4: '12.71.01.1001', name: 'Medan', lat: 3.595, lon: 98.672 },
  { adm4: '12.74.01.1001', name: 'Tanjungbalai', lat: 2.97, lon: 99.8 },
  { adm4: '12.72.01.1001', name: 'Pematangsiantar', lat: 2.96, lon: 99.06 },
  { adm4: '13.71.01.1001', name: 'Padang', lat: -0.947, lon: 100.417 },
  { adm4: '13.75.01.1001', name: 'Bukittinggi', lat: -0.309, lon: 100.375 },
  { adm4: '14.71.01.1002', name: 'Pekanbaru', lat: 0.507, lon: 101.448 },
  { adm4: '14.72.01.1003', name: 'Dumai', lat: 1.667, lon: 101.45 },
  { adm4: '15.71.01.1001', name: 'Jambi', lat: -1.586, lon: 103.61 },
  { adm4: '16.71.01.1001', name: 'Palembang', lat: -2.976, lon: 104.775 },
  { adm4: '17.71.01.1001', name: 'Bengkulu', lat: -3.798, lon: 102.259 },
  { adm4: '18.71.01.1003', name: 'Bandar Lampung', lat: -5.429, lon: 105.262 },
  { adm4: '19.71.01.1004', name: 'Pangkal Pinang', lat: -2.129, lon: 106.114 },
  { adm4: '21.72.01.1001', name: 'Tanjung Pinang', lat: 0.917, lon: 104.458 },
  { adm4: '31.71.01.1001', name: 'Jakarta Pusat (Gambir)', lat: -6.175, lon: 106.827 },
  { adm4: '31.74.01.1001', name: 'Jakarta Selatan (Tebet)', lat: -6.226, lon: 106.858 },
  { adm4: '31.75.01.1001', name: 'Jakarta Timur (Matraman)', lat: -6.213, lon: 106.858 },
  { adm4: '31.72.05.1001', name: 'Jakarta Utara (Pademangan)', lat: -6.148, lon: 106.85 },
  { adm4: '36.72.01.1001', name: 'Cilegon', lat: -6.003, lon: 106.011 },
  { adm4: '36.73.01.1001', name: 'Serang', lat: -6.12, lon: 106.15 },
  { adm4: '36.71.01.1001', name: 'Tangerang', lat: -6.178, lon: 106.63 },
  { adm4: '36.74.01.1001', name: 'Tangerang Selatan', lat: -6.288, lon: 106.712 },
  { adm4: '32.75.01.1001', name: 'Bekasi', lat: -6.236, lon: 106.99 },
  { adm4: '32.76.01.1006', name: 'Depok', lat: -6.402, lon: 106.794 },
  { adm4: '32.71.01.1001', name: 'Bogor', lat: -6.595, lon: 106.816 },
  { adm4: '32.73.01.1001', name: 'Bandung', lat: -6.917, lon: 107.619 },
  { adm4: '32.77.01.1001', name: 'Cimahi', lat: -6.872, lon: 107.543 },
  { adm4: '32.72.01.1001', name: 'Sukabumi', lat: -6.921, lon: 106.93 },
  { adm4: '32.78.01.1001', name: 'Tasikmalaya', lat: -7.327, lon: 108.221 },
  { adm4: '32.74.01.1001', name: 'Cirebon', lat: -6.717, lon: 108.557 },
  { adm4: '32.79.01.1001', name: 'Banjar', lat: -7.37, lon: 108.53 },
  { adm4: '33.74.01.1001', name: 'Semarang', lat: -6.966, lon: 110.42 },
  { adm4: '33.72.01.1001', name: 'Surakarta (Solo)', lat: -7.575, lon: 110.824 },
  { adm4: '33.73.01.1001', name: 'Salatiga', lat: -7.33, lon: 110.503 },
  { adm4: '33.71.01.1003', name: 'Magelang', lat: -7.47, lon: 110.217 },
  { adm4: '33.76.01.1001', name: 'Tegal', lat: -6.879, lon: 109.125 },
  { adm4: '33.75.01.1002', name: 'Pekalongan', lat: -6.889, lon: 109.675 },
  { adm4: '34.71.01.1001', name: 'Yogyakarta', lat: -7.795, lon: 110.369 },
  { adm4: '35.78.01.1001', name: 'Surabaya', lat: -7.257, lon: 112.752 },
  { adm4: '35.71.01.1001', name: 'Kediri', lat: -7.817, lon: 112.012 },
  { adm4: '35.73.01.1001', name: 'Malang', lat: -7.966, lon: 112.633 },
  { adm4: '35.72.01.1001', name: 'Blitar', lat: -8.095, lon: 112.16 },
  { adm4: '35.77.01.1001', name: 'Madiun', lat: -7.63, lon: 111.523 },
  { adm4: '35.76.01.1001', name: 'Mojokerto', lat: -7.47, lon: 112.43 },
  { adm4: '35.75.01.1001', name: 'Pasuruan', lat: -7.646, lon: 112.908 },
  { adm4: '35.74.01.1001', name: 'Probolinggo', lat: -7.754, lon: 113.216 },
  { adm4: '35.79.01.1001', name: 'Batu', lat: -7.867, lon: 112.524 },
  { adm4: '35.09.01.2001', name: 'Jember', lat: -8.185, lon: 113.668 },
  { adm4: '35.10.01.2001', name: 'Banyuwangi', lat: -8.219, lon: 114.369 },
  { adm4: '35.02.01.2001', name: 'Ponorogo', lat: -7.871, lon: 111.462 },
  { adm4: '35.15.01.2001', name: 'Sidoarjo', lat: -7.453, lon: 112.718 },
  { adm4: '35.25.01.2001', name: 'Gresik', lat: -7.155, lon: 112.65 },
  { adm4: '51.71.01.1001', name: 'Denpasar', lat: -8.657, lon: 115.219 },
  { adm4: '51.08.06.1006', name: 'Singaraja', lat: -8.112, lon: 115.088 },
  { adm4: '52.71.01.1004', name: 'Mataram', lat: -8.583, lon: 116.117 },
  { adm4: '52.72.01.1001', name: 'Bima', lat: -8.46, lon: 118.727 },
  { adm4: '53.71.01.1001', name: 'Kupang', lat: -10.177, lon: 123.607 },
  { adm4: '53.07.05.1006', name: 'Maumere (Sikka)', lat: -8.617, lon: 122.212 },
  { adm4: '53.10.12.1001', name: 'Ruteng (Manggarai)', lat: -8.611, lon: 120.466 },
  { adm4: '53.15.05.1024', name: 'Labuan Bajo (Manggarai Barat)', lat: -8.496, lon: 119.888 },
  { adm4: '53.08.02.2001', name: 'Ende', lat: -8.843, lon: 121.662 },
  { adm4: '53.13.05.1001', name: 'Lewoleba (Lembata)', lat: -8.366, lon: 123.42 },
  { adm4: '53.04.12.1001', name: 'Atambua (Belu)', lat: -9.106, lon: 124.892 },
  { adm4: '53.11.01.1001', name: 'Waingapu (Sumba Timur)', lat: -9.657, lon: 120.264 },
  { adm4: '61.71.01.1002', name: 'Pontianak', lat: -0.026, lon: 109.342 },
  { adm4: '61.72.01.1001', name: 'Singkawang', lat: 0.917, lon: 108.985 },
  { adm4: '62.71.01.1001', name: 'Palangka Raya', lat: -2.21, lon: 113.915 },
  { adm4: '63.71.01.1001', name: 'Banjarmasin', lat: -3.319, lon: 114.589 },
  { adm4: '63.72.02.1003', name: 'Banjarbaru', lat: -3.44, lon: 114.84 },
  { adm4: '64.72.01.1001', name: 'Samarinda', lat: -0.502, lon: 117.15 },
  { adm4: '64.71.01.1001', name: 'Balikpapan', lat: -1.237, lon: 116.852 },
  { adm4: '64.74.01.1001', name: 'Bontang', lat: 0.132, lon: 117.47 },
  { adm4: '65.71.01.1001', name: 'Tarakan', lat: 3.327, lon: 117.578 },
  { adm4: '71.71.01.1001', name: 'Manado', lat: 1.474, lon: 124.842 },
  { adm4: '71.72.01.1001', name: 'Bitung', lat: 1.44, lon: 125.19 },
  { adm4: '72.71.01.1004', name: 'Palu', lat: -0.897, lon: 119.83 },
  { adm4: '73.71.01.1001', name: 'Makassar', lat: -5.148, lon: 119.423 },
  { adm4: '73.73.01.1001', name: 'Palopo', lat: -2.993, lon: 120.196 },
  { adm4: '74.71.01.1005', name: 'Kendari', lat: -3.972, lon: 122.515 },
  { adm4: '75.71.01.1001', name: 'Gorontalo', lat: 0.541, lon: 123.06 },
  { adm4: '76.02.01.1002', name: 'Mamuju', lat: -2.682, lon: 118.887 },
  { adm4: '81.71.01.1006', name: 'Ambon', lat: -3.695, lon: 128.169 },
  { adm4: '82.71.01.1001', name: 'Ternate', lat: 0.79, lon: 127.384 },
  { adm4: '91.71.01.1001', name: 'Jayapura', lat: -2.533, lon: 140.718 },
  { adm4: '92.71.01.1001', name: 'Sorong', lat: -0.863, lon: 131.251 },
  { adm4: '92.02.12.1001', name: 'Manokwari', lat: -0.862, lon: 134.064 },
  { adm4: '91.04.01.1001', name: 'Nabire', lat: -3.36, lon: 135.5 },
];

// adm4 terdekat dalam radius maks km; null bila tidak ada.
function findNearestAdm4(lat, lng, maxKm = 60) {
  const { haversineKm } = require('./haversine.js');
  let best = null;
  let bestDist = Infinity;
  for (const area of ADM4_AREAS) {
    const d = haversineKm(lat, lng, area.lat, area.lon);
    if (d !== null && d < bestDist) {
      bestDist = d;
      best = area;
    }
  }
  if (!best || bestDist > maxKm) return null;
  return { ...best, distance_km: Math.round(bestDist) };
}

module.exports = { ADM4_AREAS, findNearestAdm4 };
