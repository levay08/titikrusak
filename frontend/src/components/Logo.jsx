// frontend/src/components/Logo.jsx
// Logo titikrusak.id (poin Alur Inti 12): berkaitan dengan PETA (pin
// lokasi), KOORDINAT (garis bidik/crosshair di dalam pin), dan sesuatu
// yang RUSAK/PUTUS (garis tengah pin terputus = "titik rusak").
// Warna KUNING (tema maintenance/perbaikan). SVG inline agar tidak
// bergantung asset file; dipakai di header, footer, dan favicon
// (public/favicon.svg memakai desain yang sama).

export default function Logo({ size = 30, title = 'Logo titikrusak.id' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className="tk-logo"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Badge putih dengan bingkai kuning */}
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#ffffff" stroke="#eab308" strokeWidth="4" />
      {/* Pin lokasi kuning */}
      <path
        d="M32 10 C 23 10 16.5 17.5 16.5 26.5 C 16.5 39 32 54 32 54 C 32 54 47.5 39 47.5 26.5 C 47.5 17.5 41 10 32 10 Z"
        fill="#facc15"
      />
      {/* Lingkaran dalam putih = koordinat titik */}
      <circle cx="32" cy="27" r="9" fill="#ffffff" />
      {/* Crosshair koordinat (garis bidik N/E/S/W) */}
      <line x1="32" y1="14" x2="32" y2="20" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="34" x2="32" y2="40" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
      <line x1="23" y1="27" x2="29" y2="27" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
      <line x1="35" y1="27" x2="41" y2="27" stroke="#eab308" strokeWidth="3" strokeLinecap="round" />
      {/* Garis tengah TERPUTUS = kerusakan/putus */}
      <line x1="27.5" y1="27" x2="30.5" y2="27" stroke="#eab308" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="33.5" y1="27" x2="36.5" y2="27" stroke="#eab308" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
