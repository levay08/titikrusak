// frontend/src/lib/regions.js
// Deteksi wilayah Indonesia dari koordinat (lat, lng) untuk statistik
// pelaporan (File 1): per PULAU dan per PROVINSI. Kotak pembatas (bbox)
// bersifat PERKIRAAN kasar agar tidak bergantung pada API eksternal —
// cukup akurat untuk laporan yang lokasinya di daratan utama. Titik di
// luar semua kotak dikategorikan "Lainnya" / "Tidak Terdeteksi".

// ---- Pulau / kelompok pulau (dicek berurutan; yang lebih kecil dulu) ----
export const ISLAND_REGIONS = [
  { key: 'bali_nt', label: 'Bali & Nusa Tenggara', bounds: [-11.2, 114.2, -7.5, 122.5] },
  { key: 'jawa', label: 'Jawa', bounds: [-9.0, 104.8, -5.5, 115.0] },
  { key: 'kalimantan', label: 'Kalimantan', bounds: [-4.5, 108.5, 4.0, 119.5] },
  { key: 'sulawesi', label: 'Sulawesi', bounds: [-6.2, 118.5, 2.0, 125.8] },
  { key: 'papua', label: 'Papua', bounds: [-11.5, 130.0, -0.5, 141.5] },
  { key: 'maluku', label: 'Maluku', bounds: [-9.5, 124.5, 3.0, 136.5] },
  { key: 'sumatera', label: 'Sumatera', bounds: [-6.5, 94.8, 6.5, 107.0] },
];

export const OTHER_ISLAND = { key: 'lainnya', label: 'Lainnya' };

// ---- Provinsi (bbox perkiraan; diurutkan otomatis dari luas terkecil) ----
const PROVINCE_BOXES = [
  { name: 'DKI Jakarta', bounds: [-6.4, 106.6, -6.0, 107.1] },
  { name: 'DI Yogyakarta', bounds: [-8.3, 110.0, -7.5, 110.9] },
  { name: 'Bali', bounds: [-8.9, 114.4, -8.0, 115.8] },
  { name: 'Kepulauan Riau', bounds: [0.5, 103.0, 4.5, 109.0] },
  { name: 'Banten', bounds: [-7.2, 105.2, -5.8, 106.6] },
  { name: 'Jawa Barat', bounds: [-7.8, 105.9, -5.9, 108.9] },
  { name: 'Jawa Tengah', bounds: [-8.0, 108.6, -6.3, 111.7] },
  { name: 'Jawa Timur', bounds: [-8.7, 110.9, -6.8, 114.7] },
  { name: 'Gorontalo', bounds: [0.0, 121.5, 1.5, 123.8] },
  { name: 'Kep. Bangka Belitung', bounds: [-4.0, 105.0, -0.5, 108.5] },
  { name: 'Bengkulu', bounds: [-5.6, 101.4, -2.0, 103.8] },
  { name: 'Kalimantan Utara', bounds: [0.5, 115.5, 4.5, 118.5] },
  { name: 'Sulawesi Barat', bounds: [-3.8, 118.7, -0.5, 120.0] },
  { name: 'Lampung', bounds: [-6.0, 103.5, -4.0, 106.0] },
  { name: 'Aceh', bounds: [2.0, 95.0, 6.0, 98.5] },
  { name: 'Jambi', bounds: [-2.8, 101.5, -0.8, 104.7] },
  { name: 'Sumatera Utara', bounds: [0.5, 97.5, 4.3, 100.4] },
  { name: 'Sumatera Barat', bounds: [-3.5, 98.3, 0.0, 101.9] },
  { name: 'Sulawesi Tenggara', bounds: [-5.5, 120.5, -2.5, 123.5] },
  { name: 'Nusa Tenggara Barat', bounds: [-9.2, 115.5, -7.8, 119.5] },
  { name: 'Nusa Tenggara Timur', bounds: [-11.2, 118.5, -8.0, 125.0] },
  { name: 'Kalimantan Selatan', bounds: [-4.3, 114.0, -1.5, 116.5] },
  { name: 'Kalimantan Barat', bounds: [-3.0, 108.5, 2.0, 114.0] },
  { name: 'Sulawesi Utara', bounds: [0.0, 123.0, 2.5, 127.0] },
  { name: 'Riau', bounds: [-1.5, 100.5, 2.5, 105.5] },
  { name: 'Kalimantan Tengah', bounds: [-3.8, 110.5, 0.5, 114.5] },
  { name: 'Maluku Utara', bounds: [-2.5, 127.0, 3.0, 130.5] },
  { name: 'Sulawesi Tengah', bounds: [-3.0, 119.5, 1.5, 123.0] },
  { name: 'Sulawesi Selatan', bounds: [-6.0, 118.5, -1.5, 121.5] },
  { name: 'Papua Barat Daya', bounds: [-5.5, 130.0, -0.5, 133.0] },
  { name: 'Sumatera Selatan', bounds: [-4.5, 102.5, -1.5, 106.0] },
  { name: 'Kalimantan Timur', bounds: [-2.5, 114.5, 2.5, 118.5] },
  { name: 'Maluku', bounds: [-9.5, 125.5, -2.0, 136.0] },
  { name: 'Papua Pegunungan', bounds: [-5.5, 136.5, -3.5, 140.5] },
  { name: 'Papua Tengah', bounds: [-5.0, 134.5, -2.5, 137.5] },
  { name: 'Papua Selatan', bounds: [-9.5, 137.5, -5.5, 141.0] },
  { name: 'Papua Barat', bounds: [-4.5, 130.5, 1.0, 134.5] },
  { name: 'Papua', bounds: [-4.0, 136.5, -0.5, 141.5] },
];

// Urutkan dari bbox TERKECIL agar provinsi kecil (DKI, Yogyakarta, Bali)
// menang atas provinsi besar yang mengelilinginya (Jawa Barat, dsb).
export const PROVINCES = [...PROVINCE_BOXES].sort((a, b) => {
  const area = (p) => {
    const [minLat, minLng, maxLat, maxLng] = p.bounds;
    return (maxLat - minLat) * (maxLng - minLng);
  };
  return area(a) - area(b);
});

function inBounds(lat, lng, [minLat, minLng, maxLat, maxLng]) {
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// Nama provinsi dari koordinat; null bila tidak terdeteksi.
export function detectProvince(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const found = PROVINCES.find((p) => inBounds(lat, lng, p.bounds));
  return found ? found.name : null;
}

// Kelompok pulau dari koordinat; fallback OTHER_ISLAND.
export function detectIsland(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return OTHER_ISLAND;
  return ISLAND_REGIONS.find((r) => inBounds(lat, lng, r.bounds)) || OTHER_ISLAND;
}
