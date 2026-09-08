// frontend/src/lib/useKeyboardNav.js
// Navigasi cepat keyboard (tanpa indikator visual di peta/antarmuka):
//   ArrowLeft  = kembali (tutup sub-halaman/detail yang sedang terbuka)
//   ArrowRight = laporan berikutnya (mengikuti urutan daftar yang tampil)
//   Spasi      = memanggil tombol "Lapor Kerusakan" (hanya halaman utama)
// Ketiga tombol HANYA aktif saat fokus BERADA DI LUAR kolom teks
// (input/textarea/select/contenteditable) dan tanpa kombinasi tombol
// lain (Ctrl/Alt/Meta) - supaya tidak mengganggu pengetikan.
//
// Satu pemilik navigasi per lapisan detail: komponen yang membuka detail
// laporan (App untuk modal level App; ListView untuk panel detailnya
// sendiri) memanggil hook ini dengan `dataset` = urutan laporan yang
// sedang tampil, sehingga "berikutnya" selalu mengikuti apa yang dilihat
// pengguna (urut hasil filter/sort atau urutan visual baris daftar).
import { useEffect, useRef } from 'react';

// Apakah event berasal dari kolom teks? Ketikan (termasuk spasi dan
// panah kiri/kanan untuk memindah kursor) tidak boleh diganggu.
function isEditableTarget(target) {
  if (!target || typeof target.tagName !== 'string') return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable === true
  );
}

export default function useKeyboardNav({
  detailOpen = false,
  currentId = null,
  dataset = [],
  onSelect = null, // buka laporan lain (prop report baru)
  onBack = null, // tutup detail / kembali ke tampilan sebelumnya
  onSpace = null, // aksi tombol Lapor Kerusakan
  spaceEnabled = false,
}) {
  // Nilai panggilan terbaru lewat ref: listener cukup didaftarkan sekali
  // (pola sama dengan useEscapeClose - tidak perlu re-subscribe tiap render).
  const state = useRef({ detailOpen, currentId, dataset, onSelect, onBack, onSpace, spaceEnabled });
  state.current = { detailOpen, currentId, dataset, onSelect, onBack, onSpace, spaceEnabled };

  useEffect(() => {
    const onKeyDown = (e) => {
      // Shortcut browser/OS (mis. Ctrl+Panah) tidak diganggu.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Fokus di kolom teks: biarkan ketikan normal berjalan.
      if (isEditableTarget(e.target)) return;

      const s = state.current;

      if (e.key === 'ArrowLeft') {
        // Kembali = tutup detail yang sedang terbuka.
        if (!s.detailOpen || !s.onBack) return;
        e.preventDefault();
        s.onBack();
        return;
      }

      if (e.key === 'ArrowRight') {
        // Laporan berikutnya dalam urutan yang tampil (bukan daftar
        // lompatan acak). Di laporan terakhir: tidak terjadi apa-apa.
        if (!s.detailOpen || !s.onSelect || !Array.isArray(s.dataset)) return;
        const idx = s.dataset.findIndex((r) => Number(r.id) === Number(s.currentId));
        if (idx < 0 || idx >= s.dataset.length - 1) return;
        e.preventDefault();
        s.onSelect(s.dataset[idx + 1]);
        return;
      }

      if (e.key === ' ') {
        // Spasi = klik tombol "Lapor Kerusakan" - hanya bila tombol itu
        // memang tampil (spaceEnabled dihitung pemilik sesuai layernya).
        if (!s.spaceEnabled || !s.onSpace) return;
        if (e.repeat) return; // spasi ditahan: cukup satu kali
        e.preventDefault();
        s.onSpace();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
