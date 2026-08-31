// frontend/src/components/EmptyResults.jsx
// Kondisi hasil kosong (File 1 Bagian 9.1): dipakai bersama MapView dan
// ListView — pesan + tombol Reset Filter ketika filter tidak menemukan
// laporan apa pun. Harus dirender di dalam container position:relative.

export default function EmptyResults({ onResetFilters }) {
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
        padding: '18px 22px',
        textAlign: 'center',
        maxWidth: 340,
      }}
    >
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
    </div>
  );
}
