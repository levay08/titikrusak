// frontend/src/lib/useIsMobile.js
// Deteksi viewport mobile (lebar <= 640px) untuk pola mobile-first
// (File 1 Bagian 9.7). Dipakai komponen untuk menukar layout, mis.
// FilterPanel sidebar -> drawer.

import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 640px)';

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(MOBILE_QUERY).matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
