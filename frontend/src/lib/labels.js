// frontend/src/lib/labels.js
// Rujukan tunggal katalog nilai tetap + label + warna (File 1 Bagian 6.8).
// Dipakai bersama oleh MapView, ListView, FilterPanel, dan ReportForm
// agar label/warna tidak terduplikasi antar komponen.

// ---- Tingkat kerusakan (File 1 Bagian 6.8.2) ----
// Warna: RINGAN = BIRU MUDA (koreksi user: hijau TIDAK lagi dipakai
// severity — hijau khusus untuk laporan yang SUDAH DIPERBAIKI, lihat
// STATUSES.selesai_diperbaiki & reportMarkerColor).
export const SEVERITIES = [
  { value: 'ringan', label: 'Ringan', color: '#60a5fa' }, // biru muda
  { value: 'sedang', label: 'Sedang', color: '#eab308' }, // kuning
  { value: 'berat', label: 'Berat', color: '#f97316' },   // oranye
  { value: 'ambruk', label: 'Ambruk', color: '#ef4444' }, // merah
];
export const SEVERITY_COLORS = Object.fromEntries(SEVERITIES.map((s) => [s.value, s.color]));
export const SEVERITY_LABELS = Object.fromEntries(SEVERITIES.map((s) => [s.value, s.label]));
export const SEVERITY_ORDER = SEVERITIES.map((s) => s.value);

// Definisi singkat tiap tingkat kerusakan, diringkas dari tabel lengkap
// File 1 Bagian 6.8.2 (yang dirujuk oleh Bagian 9.3).
export const SEVERITY_DEFINITIONS = {
  ringan:
    'Kerusakan kosmetik atau kecil; infrastruktur masih aman dilalui atau dipakai tanpa risiko berarti terhadap keselamatan.',
  sedang:
    'Kerusakan struktural ringan yang mulai mengganggu fungsi; masih dapat dipakai dengan kehati-hatian, belum mengancam jiwa secara langsung.',
  berat:
    'Kerusakan struktural signifikan yang mengarah ke bahaya nyata bagi keselamatan; sangat berisiko, sebaiknya dihindari kecuali darurat.',
  ambruk:
    'Mengancam jiwa secara aktif; infrastruktur putus total, roboh, atau akses terputus — tidak boleh didekati atau dilalui sama sekali.',
};

// ---- Jenis infrastruktur (File 1 Bagian 6.8.1) ----
// Diperluas dengan jenis granular hasil riset laporan media (jembatan
// ambruk, sekolah rusak, jaringan listrik/air putus, tanggul, dll).
export const INFRA_TYPES = [
  { value: 'jembatan', label: 'Jembatan' },
  { value: 'jalan', label: 'Jalan' },
  { value: 'sekolah', label: 'Sekolah' },
  { value: 'gedung', label: 'Gedung' },
  { value: 'rumah_sakit', label: 'Rumah Sakit' },
  { value: 'kantor_pemerintah', label: 'Kantor Pemerintah' },
  { value: 'jaringan_listrik', label: 'Jaringan Listrik' },
  { value: 'jaringan_air', label: 'Jaringan Air' },
  { value: 'tanggul', label: 'Tanggul' },
  { value: 'irigasi', label: 'Irigasi' },
  { value: 'prasarana_publik', label: 'Prasarana Publik' },
  { value: 'utilitas', label: 'Utilitas' },
  { value: 'lainnya', label: 'Lainnya' },
];
export const INFRA_LABELS = Object.fromEntries(INFRA_TYPES.map((o) => [o.value, o.label]));

// ---- Kategori kewenangan (File 1 Bagian 6.8.3) ----
export const BRIDGE_AUTHORITIES = [
  { value: 'nasional', label: 'Nasional' },
  { value: 'provinsi', label: 'Provinsi' },
  { value: 'kabupaten_kota', label: 'Kabupaten/Kota' },
  { value: 'desa_swadaya', label: 'Desa/Swadaya' },
  { value: 'tidak_diketahui', label: 'Tidak Diketahui' },
];
export const AUTHORITY_LABELS = Object.fromEntries(
  BRIDGE_AUTHORITIES.map((o) => [o.value, o.label])
);

// ---- Status vital (File 1 Bagian 6.8.4) ----
export const VITAL_STATUSES = [
  { value: 'akses_sekolah', label: 'Akses Sekolah' },
  { value: 'akses_kesehatan', label: 'Akses Kesehatan' },
  { value: 'akses_antar_kampung', label: 'Akses Antar Kampung' },
  { value: 'akses_sungai', label: 'Akses Sungai' },
  { value: 'akses_ekonomi', label: 'Akses Ekonomi' },
  { value: 'aset_utilitas', label: 'Aset Utilitas' },
  { value: 'lainnya', label: 'Lainnya' },
];
export const VITAL_LABELS = Object.fromEntries(VITAL_STATUSES.map((o) => [o.value, o.label]));

// ---- Status laporan (File 1 Bagian 6.2) ----
export const STATUSES = [
  { value: 'dilaporkan', label: 'Dilaporkan', color: '#64748b' },
  { value: 'terverifikasi', label: 'Terverifikasi', color: '#3b82f6' },
  { value: 'dalam_perbaikan', label: 'Dalam Perbaikan', color: '#f59e0b' },
  { value: 'selesai_diperbaiki', label: 'Selesai Diperbaiki', color: '#22c55e' },
];
export const STATUS_LABELS = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));
export const STATUS_COLORS = Object.fromEntries(STATUSES.map((s) => [s.value, s.color]));

// ---- Warna titik di peta (koreksi user) ----
// HIJAU hanya untuk laporan yang SUDAH DIPERBAIKI (selesai_diperbaiki).
// Laporan lain memakai warna tingkat kerusakan (ringan = biru muda).
// Dipakai MapView (circleMarker & divIcon approved) agar peta, legend,
// dan dokumentasi selalu satu sumber warna.
export function reportMarkerColor(report) {
  if (report && report.status === 'selesai_diperbaiki') {
    return STATUS_COLORS.selesai_diperbaiki; // #22c55e — satu-satunya hijau
  }
  return SEVERITY_COLORS[(report && report.severity) || ''] || '#64748b';
}
