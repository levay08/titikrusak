// frontend/src/components/EidDesktopInfo.jsx
// Pesan info bersama untuk alur e.id di tampilan mobile (File 1 Bagian 9.7):
// verifikasi e.id butuh pemindaian QR dengan aplikasi e.id di perangkat lain,
// jadi tidak praktis dari HP itu sendiri — hanya optimal dan lancar di desktop.
// Dipakai ReportForm (role warga) dan App (login otoritas) agar pesan yang
// ditampilkan SELALU sama di kedua alur.

export const EID_DESKTOP_MESSAGE =
  'Verifikasi e.id memerlukan pemindaian QR menggunakan aplikasi e.id di perangkat lain. ' +
  'Fitur ini hanya optimal dan lancar di tampilan desktop.';

export default function EidDesktopInfo({ title, actionLabel, onAction }) {
  return (
    <div>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#1c1917' }}>{title}</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.55, color: '#334155' }}>
        {EID_DESKTOP_MESSAGE}
      </p>
      <button
        type="button"
        onClick={onAction}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid #cbd5e1',
          background: '#fff',
          color: '#1c1917',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {actionLabel}
      </button>
    </div>
  );
}
