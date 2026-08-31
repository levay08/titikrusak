// frontend/src/components/EmptyResults.jsx
// Kondisi hasil kosong (File 1 Bagian 9.1 & 9.2), dipakai bersama MapView
// dan ListView. Dua kondisi dibedakan lewat prop `hasAnyData`:
//
//   A. hasAnyData = false  -> database benar-benar belum punya laporan:
//      pesan ramah + tombol "Lapor Kerusakan" menonjol dengan animasi
//      pulse lembut, TANPA tombol Reset Filter (tidak relevan).
//
//   B. hasAnyData = true   -> ada data, tapi kombinasi filter kosong:
//      pesan "Tidak ada laporan yang sesuai dengan filter ini" + tombol
//      Reset Filter, tanpa animasi khusus.
//
// Harus dirender di dalam container position:relative.

// Animasi pulse lembut untuk tombol ajakan Kondisi A (File 1 9.1).
const PULSE_KEYFRAMES = `
@keyframes trk-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.45); }
  70%  { box-shadow: 0 0 0 16px rgba(124, 58, 237, 0); }
  100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
}`;

export default function EmptyResults({ hasAnyData, onResetFilters, onLapor }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.97)',
        borderRadius: 10,
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.25)',
        padding: '20px 24px',
        textAlign: 'center',
        maxWidth: 360,
      }}
    >
      {hasAnyData ? (
        /* Kondisi B: data ada, filter tidak cocok — normal, tanpa animasi */
        <>
          <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            Tidak ada laporan yang sesuai dengan filter ini
          </p>
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Filter
            </button>
          )}
        </>
      ) : (
        /* Kondisi A: belum ada laporan sama sekali — ajakan + pulse */
        <>
          <style>{PULSE_KEYFRAMES}</style>
          <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.5, color: '#0f172a' }}>
            <strong>Belum ada laporan infrastruktur rusak di sini.</strong>
            <br />
            Jadilah yang pertama melaporkan!
          </p>
          {onLapor && (
            <button
              type="button"
              onClick={onLapor}
              style={{
                padding: '12px 24px',
                borderRadius: 999,
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                animation: 'trk-pulse 2s ease-in-out infinite',
              }}
            >
              Lapor Kerusakan
            </button>
          )}
        </>
      )}
    </div>
  );
}
