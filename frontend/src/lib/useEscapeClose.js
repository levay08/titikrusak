// frontend/src/lib/useEscapeClose.js
// Tutup modal dengan tombol Escape (setara menekan tombol tutup ✕).
//
// Dipakai pada lapisan modal TERLUAR (capture=false, default). Overlay di
// DALAM modal (mis. VerificationFlow) memakai capture=true supaya Escape
// menangani langkah dalam itu lebih dulu dan TIDAK ikut menutup modal
// luarnya (stopImmediatePropagation menghentikan listener modal luar).
import { useEffect, useRef } from 'react';

export default function useEscapeClose(onEscape, { capture = false, enabled = true } = {}) {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      ref.current?.();
    };
    document.addEventListener('keydown', handler, capture);
    return () => document.removeEventListener('keydown', handler, capture);
  }, [capture, enabled]);
}
