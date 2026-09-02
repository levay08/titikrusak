// frontend/src/components/WelcomeModal.jsx
// Modal selamat datang (hanya saat KUNJUNGAN PERTAMA per tab — flag
// sessionStorage "titikrusak_welcome_seen"). Berisi latar belakang
// singkat, solusi, fitur, dan ajakan melihat Dokumentasi serta melapor
// dengan e.id. Logo transparan besar di latar belakang panel.
//
// WelcomeBody diekspor agar konten yang SAMA dipakai ulang oleh
// AboutModal (menu "Tentang") — konten dua tempat ini selalu sama
// (koreksi user: menu Tentang menyamakan konten modal welcome).

import Logo from './Logo.jsx';
import useIsMobile from '../lib/useIsMobile.js';

const SECTION_TITLE = { fontSize: 13.5, fontWeight: 700, color: '#1c1917', margin: '0 0 4px' };
const SECTION_BODY = { fontSize: 12.5, lineHeight: 1.65, color: '#475569', margin: '0 0 12px' };

// Konten bersama modal welcome & menu Tentang (header + latar belakang +
// solusi + fitur utama + ajakan). `children` (opsional) dirender di akhir.
export function WelcomeBody({
  heading = 'Selamat Datang di titikrusak.id',
  subtitle = 'Laporkan & pantau infrastruktur publik yang rusak',
  children,
}) {
  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Logo size={40} />
        <div>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#1c1917', lineHeight: 1.2 }}>
            {heading}
          </div>
          <div style={{ fontSize: 12.5, color: '#a16207', fontWeight: 600, marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
      </div>

      {/* Latar belakang masalah */}
      <div style={SECTION_TITLE}>Latar Belakang</div>
      <p style={SECTION_BODY}>
        Jembatan putus, jalan ambles, sekolah bocor, hingga jaringan listrik padam —
        kerusakan infrastruktur publik di Indonesia sering terjadi dan informasi
        tentangnya tersebar di mana-mana. Warga kesulitan melapor, sementara otoritas
        kesulitan memprioritaskan perbaikan karena tidak ada satu peta yang merangkumnya.
      </p>

      {/* Solusi */}
      <div style={SECTION_TITLE}>Solusi</div>
      <p style={SECTION_BODY}>
        titikrusak.id menghadirkan peta terpadu kerusakan infrastruktur: laporan dari
        warga dan media dikumpulkan di satu tempat, lengkap dengan foto, tingkat
        kerusakan, dan status perbaikan. Otoritas bisa memverifikasi, memprioritaskan,
        dan memantau progres — transparan untuk semua.
      </p>

      {/* Fitur */}
      <div style={SECTION_TITLE}>Fitur Utama</div>
      <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7, color: '#475569' }}>
        <li>Peta interaktif seluruh Indonesia dengan titik laporan nyata.</li>
        <li>Detail lengkap: foto, kategori, tingkat kerusakan, dan status perbaikan.</li>
        <li>Info pendukung BMKG: gempa terdekat dan prakiraan cuaca di lokasi laporan.</li>
        <li>Dukungan warga via e.id — menaikkan prioritas laporan yang penting.</li>
        <li>Verifikasi dan tracking perbaikan oleh otoritas lokal.</li>
        <li>Pencarian, filter, dan statistik untuk memantau kondisi daerah Anda.</li>
      </ul>

      {/* Ajakan */}
      <p style={SECTION_BODY}>
        Mulai dengan menjelajahi peta, atau buka menu <strong>Dokumentasi</strong> di
        bagian bawah halaman untuk panduan lengkap. Temukan kerusakan di sekitar Anda
        dan laporkan lewat tombol <strong>“+ Lapor Kerusakan”</strong> — verifikasi
        identitas dengan <strong>e.id</strong> (tanpa KTP untuk warga) agar laporan
        Anda lebih dipercaya.
      </p>

      {/* Disclaimer independensi (menu Tentang & modal welcome — koreksi
          user): titikrusak.id portal INDEPENDEN, bukan bagian dari
          lembaga/pemerintah/organisasi mana pun. */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '9px 12px',
          marginBottom: 12,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1.4 }}>
          🕊️
        </span>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: '#475569' }}>
          <strong>Disclaimer:</strong> titikrusak.id adalah portal independen dari
          warga untuk warga dan tidak berafiliasi dengan lembaga, pemerintah, maupun
          organisasi mana pun. Otoritas yang ingin memverifikasi laporan dapat masuk
          melalui verifikasi e.id.
        </p>
      </div>

      {children}
    </>
  );
}

export default function WelcomeModal({
  onClose,
  heading = 'Selamat Datang di titikrusak.id',
  subtitle = 'Laporkan & pantau infrastruktur publik yang rusak',
  ariaLabel = 'Selamat datang di titikrusak.id',
  ctaLabel = 'Mengerti',
}) {
  const isMobile = useIsMobile();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1500,
        background: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          background: '#ffffff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 540,
          maxHeight: isMobile ? '92dvh' : '88vh',
          overflowY: 'auto',
          padding: isMobile ? '22px 20px 26px' : '28px 32px 30px',
          boxShadow: '0 16px 60px rgba(0, 0, 0, 0.45)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo transparan besar di latar belakang — dekorasi, tidak
            menghalangi klik (pointerEvents none) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: isMobile ? -18 : -30,
            right: isMobile ? -20 : -26,
            opacity: 0.09,
            pointerEvents: 'none',
          }}
        >
          <Logo size={isMobile ? 190 : 240} />
        </div>

        <WelcomeBody heading={heading} subtitle={subtitle} />

        {/* Tombol utama (Mengerti / Tutup untuk menu Tentang) */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '11px 0',
            borderRadius: 10,
            border: 'none',
            background: '#facc15',
            color: '#1c1917',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(250, 204, 21, 0.4)',
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
