// frontend/src/components/Logo.jsx
// Logo titikrusak.id (poin Alur Inti 12): berkaitan dengan PETA (pin
// lokasi), KOORDINAT (garis bidik/crosshair di dalam pin), dan sesuatu
// yang RUSAK/PUTUS (garis tengah pin terputus = "titik rusak").
// Warna KUNING (tema maintenance/perbaikan). SVG inline agar tidak
// bergantung asset file; dipakai di header, footer, dan favicon
// (public/favicon.svg memakai desain yang sama).
//
// Prop `crack` (header): PIN POINT (lingkaran titik di dalam pin) terbelah
// DUA memakai efek masking (clipPath dua belahan) - menampilkan esensi
// "rusak": belahan menjauh membentuk celah, lalu perlahan tersambung
// kembali, jeda, ulang. Crosshair koordinat tetap utuh.

export default function Logo({ size = 30, title = 'Logo titikrusak.id', animated = false, crack = false }) {
  const cls = `tk-logo${animated ? ' tk-logo-animated' : ''}${crack ? ' tk-logo-crack' : ''}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cls}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Badge putih dengan bingkai kuning */}
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#ffffff" stroke="#eab308" strokeWidth="4" />
      {/* Pin lokasi kuning */}
      <path
        d="M32 10 C 23 10 16.5 17.5 16.5 26.5 C 16.5 39 32 54 32 54 C 32 54 47.5 39 47.5 26.5 C 47.5 17.5 41 10 32 10 Z"
        fill="#facc15"
      />
      {/* Lingkaran dalam putih = koordinat titik (pin point) */}
      {crack ? (
        <>
          {/* PIN POINT terbelah dua memakai masking (clipPath diagonal
              melalui pusat 32,27; overlap tipis agar tanpa jahitan saat
              tersambung). Belahan lingkaran digeser diagonal menjauh =
              titik retak/terbelah, lalu perlahan menyambung lagi.
              Crosshair koordinat DI BAWAH ini tetap utuh (tidak ikut
              terbelah). */}
          <g clipPath="url(#tk-crack-a)">
            <g className="tk-crack-piece tk-crack-a">
              <circle cx="32" cy="27" r="9" fill="#ffffff" />
            </g>
          </g>
          <g clipPath="url(#tk-crack-b)">
            <g className="tk-crack-piece tk-crack-b">
              <circle cx="32" cy="27" r="9" fill="#ffffff" />
            </g>
          </g>
        </>
      ) : (
        <circle cx="32" cy="27" r="9" fill="#ffffff" />
      )}
      {/* Crosshair koordinat (garis bidik N/E/S/W) - KUNING GELAP agar
          kontras di atas pin kuning; frame tetap kuning #eab308. Di versi
          crack crosshair TETAP UTUH (yang terbelah hanya pin point). */}
      <line x1="32" y1="14" x2="32" y2="20" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="34" x2="32" y2="40" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
      <line x1="23" y1="27" x2="29" y2="27" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
      <line x1="35" y1="27" x2="41" y2="27" stroke="#a16207" strokeWidth="3" strokeLinecap="round" />
      {/* Garis tengah TERPUTUS = kerusakan/putus */}
      <line x1="27.5" y1="27" x2="30.5" y2="27" stroke="#a16207" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="33.5" y1="27" x2="36.5" y2="27" stroke="#a16207" strokeWidth="3.5" strokeLinecap="round" />

      {/* Efek kilau (pantulan cahaya) menyapu dari KANAN ke KIRI - logo
          TETAP (statis), hanya kilau yang bergerak. Clip ke tile badge
          agar cahaya tidak keluar dari area logo. */}
      {animated && (
        <g clipPath="url(#tk-logo-clip)">
          <g className="tk-logo-shine-band">
            <rect
              x="-16"
              y="-10"
              width="26"
              height="84"
              fill="url(#tk-logo-shine-grad)"
              transform="skewX(-18)"
            />
          </g>
        </g>
      )}
      <defs>
        <linearGradient id="tk-logo-shine-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="tk-logo-clip">
          <rect x="2" y="2" width="60" height="60" rx="15" />
        </clipPath>
        {crack && (
          <>
            {/* Masking belahan crosshair: garis diagonal y = -x + 59 lewat
                pusat (32,27). A = sisi kiri-atas, B = kanan-bawah; overlap
                tipis di sekitar garis agar tanpa jahitan saat menyambung. */}
            <clipPath id="tk-crack-a">
              <polygon points="0,0 61,0 0,61" />
            </clipPath>
            <clipPath id="tk-crack-b">
              <polygon points="59,0 64,0 64,64 0,64 0,59" />
            </clipPath>
          </>
        )}
      </defs>
    </svg>
  );
}
