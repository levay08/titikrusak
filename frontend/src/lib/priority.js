// frontend/src/lib/priority.js
// Skor & pengelompokan prioritas laporan untuk sisi Otoritas (File 1
// Bagian 6.2/6.3): prioritas dihitung dari TIGA parameter —
//   1. severity (ringan=1, sedang=2, berat=3, ambruk=4; bobot x3 agar
//      keselamatan tetap dominan — ambruk selalu prioritas tertinggi),
//   2. validasi e.id pelapor (reporter_is_verified: +2),
//   3. kelengkapan laporan (maks +4: description, photo_urls,
//      vital_status_note, bridge_authority diketahui).
// Bonus kecil: dukungan warga (vote_count >= 5) menambah +1 — dukungan
// interaktif ikut menaikkan prioritas (File 1 Bagian 6.3).
// Skor maksimum = 4*3 + 2 + 4 + 1 = 19, dipetakan ke 4 tier prioritas.

// Bobot severity (dikalikan 3).
const SEVERITY_POINTS = { ringan: 1, sedang: 2, berat: 3, ambruk: 4 };
const SEVERITY_WEIGHT = 3;

// Poin validasi e.id pelapor.
const EID_POINTS = 2;

// Jumlah dukungan warga yang memicu bonus prioritas.
const VOTE_BONUS_THRESHOLD = 5;
const VOTE_BONUS_POINTS = 1;

// Empat tier prioritas (tertinggi dulu). minScore = ambang bawah tier.
export const PRIORITY_TIERS = [
  { value: 'sangat_tinggi', label: 'Sangat Tinggi', color: '#dc2626', minScore: 12 },
  { value: 'tinggi', label: 'Tinggi', color: '#f97316', minScore: 9 },
  { value: 'sedang', label: 'Sedang', color: '#eab308', minScore: 5 },
  { value: 'rendah', label: 'Rendah', color: '#64748b', minScore: 0 },
];

// Poin kelengkapan laporan (0-4): seberapa banyak detail pendukung yang
// diisi pelapor, selain field wajib.
export function completenessPoints(report) {
  let pts = 0;
  if (report.description && String(report.description).trim() !== '') pts += 1;
  if (Array.isArray(report.photo_urls) && report.photo_urls.length > 0) pts += 1;
  if (report.vital_status_note && String(report.vital_status_note).trim() !== '') pts += 1;
  if (report.bridge_authority && report.bridge_authority !== 'tidak_diketahui') pts += 1;
  return pts;
}

// Label tingkat kelengkapan untuk chip di baris laporan (mode otoritas).
export function completenessLevel(report) {
  const pts = completenessPoints(report);
  if (pts >= 4) return { label: 'Lengkap', color: '#15803d' };
  if (pts >= 2) return { label: 'Cukup', color: '#b45309' };
  return { label: 'Minim', color: '#64748b' };
}

// Rincian skor prioritas satu laporan (dipakai untuk sorting & debug).
export function priorityScore(report) {
  const severity = (SEVERITY_POINTS[report.severity] ?? 0) * SEVERITY_WEIGHT;
  const eid = report.reporter_is_verified ? EID_POINTS : 0;
  const completeness = completenessPoints(report);
  const votes = Number(report.vote_count) >= VOTE_BONUS_THRESHOLD ? VOTE_BONUS_POINTS : 0;
  return {
    score: severity + eid + completeness + votes,
    severity,
    eid,
    completeness,
    votes,
  };
}

// Tier prioritas sebuah laporan.
export function priorityTier(report) {
  const { score } = priorityScore(report);
  return PRIORITY_TIERS.find((t) => score >= t.minScore) || PRIORITY_TIERS[PRIORITY_TIERS.length - 1];
}
