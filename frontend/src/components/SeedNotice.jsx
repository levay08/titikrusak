// frontend/src/components/SeedNotice.jsx
// Keterangan singkat (tooltip kecil yang bisa ditutup) bahwa seluruh titik
// di peta saat ini adalah DATA NYATA kerusakan infrastruktur yang dihimpun
// dari pemberitaan media (1 tahun terakhir) — BUKAN laporan warga.
// Muncul sebagai bubble di atas tombol floating "Lapor Kerusakan" (desktop
// & mobile), hilang permanen per sesi tab setelah tombol ✕ diklik
// (sessionStorage 'titikrusak_seed_note_closed' — pola sama seperti
// WelcomeModal: kunjungan baru di tab baru menampilkannya lagi).
//
// Diresponsif: posisi naik di atas kontrol zoom saat mobile agar tidak
// bertumpuk dengan slider zoom (lihat ZoomSlider MapView).

import { useState } from 'react';
import useIsMobile from '../lib/useIsMobile.js';

const CLOSED_FLAG = 'titikrusak_seed_note_closed';

export default function SeedNotice() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(() => {
    try {
      return !sessionStorage.getItem(CLOSED_FLAG);
    } catch (_e) {
      return true;
    }
  });

  if (!open) return null;

  const close = () => {
    try {
      sessionStorage.setItem(CLOSED_FLAG, '1');
    } catch (_e) {
      // abaikan bila sessionStorage tidak tersedia
    }
    setOpen(false);
  };

  return (
    <div
      role="note"
      style={{
        position: 'absolute',
        left: isMobile ? 16 : 20,
        bottom: isMobile ? 122 : 88,
        zIndex: 1100,
        maxWidth: isMobile ? 'calc(100vw - 32px)' : 360,
        background: '#fff',
        border: '1px solid #eab308',
        borderRadius: 10,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
        padding: '9px 10px 9px 12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      {/* Panah tooltip mengarah ke tombol Lapor di bawahnya */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -6,
          left: 22,
          width: 10,
          height: 10,
          background: '#fff',
          borderRight: '1px solid #eab308',
          borderBottom: '1px solid #eab308',
          transform: 'rotate(45deg)',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          fontSize: 13,
          lineHeight: 1.4,
          marginTop: 1,
        }}
      >
        📰
      </span>
      <p
        style={{
          margin: 0,
          flex: 1,
          fontSize: 12.5,
          lineHeight: 1.45,
          color: '#1c1917',
        }}
      >
        Titik di peta adalah <strong>data nyata</strong> kerusakan infrastruktur
        dari pemberitaan media (1 tahun terakhir), bukan laporan warga.
      </p>
      <button
        type="button"
        aria-label="Tutup keterangan data titik"
        title="Tutup keterangan data titik"
        onClick={close}
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#64748b',
          fontSize: 15,
          lineHeight: 1,
          padding: '2px 0 0 2px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
