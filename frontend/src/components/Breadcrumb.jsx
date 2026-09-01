// frontend/src/components/Breadcrumb.jsx
// Breadcrumb sederhana: Beranda > [halaman saat ini]. Dipakai di ListView
// (Daftar Laporan) dan ReportForm (Lapor Kerusakan).

export default function Breadcrumb({ current }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('tk:go-home'));
        }}
        style={{ color: '#64748b', textDecoration: 'none' }}
      >
        Beranda
      </a>
      <span style={{ margin: '0 6px', color: '#cbd5e1' }}>/</span>
      <span style={{ color: '#1c1917', fontWeight: 600 }}>{current}</span>
    </nav>
  );
}
