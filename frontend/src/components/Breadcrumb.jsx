// frontend/src/components/Breadcrumb.jsx
// Breadcrumb BERSAMA untuk seluruh halaman non-utama (File 1 Bagian 4.2):
//   - ListView  : Beranda > Daftar Laporan
//   - ReportForm : Beranda > Lapor Kerusakan
//   - Detail     : Beranda > (Peta | Daftar Laporan) > Nama Lokasi
//   - Admin      : Admin > Dashboard (tanpa breadcrumb di gerbang login)
//
// Menerima daftar `items` = [{ label, onClick? }]. Item dengan onClick
// dirender sebagai link navigasi; item terakhir (tanpa onClick) = halaman
// saat ini (teks tebal). "Beranda" selalu kembali ke peta utama lewat event
// window 'tk:go-home' yang didengarkan App (goHomeView).

// Item pembuka "Beranda" - kembali ke peta utama (dipanggil App via event).
export function homeCrumb() {
  return {
    label: 'Beranda',
    onClick: () => window.dispatchEvent(new CustomEvent('tk:go-home')),
  };
}

export default function Breadcrumb({ items = [] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
      {items.map((item, i) => {
        const clickable = typeof item.onClick === 'function';
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`}>
            {i > 0 && <span style={{ margin: '0 6px', color: '#cbd5e1' }}>/</span>}
            {clickable ? (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  item.onClick();
                }}
                style={{ color: '#64748b', textDecoration: 'none' }}
              >
                {item.label}
              </a>
            ) : (
              <span
                style={{
                  color: isLast ? '#1c1917' : '#475569',
                  fontWeight: isLast ? 600 : 400,
                }}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
