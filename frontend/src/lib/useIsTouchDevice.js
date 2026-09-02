// frontend/src/lib/useIsTouchDevice.js
// Deteksi PERANGKAT sentuh (ponsel & tablet) untuk keputusan alur e.id:
// perangkat sentuh memakai alur "Buka Wallet e.id" (deep link langsung,
// TANPA scan QR); desktop (pointer presisi) memakai alur QR biasa.
// Berbeda dari useIsMobile (lebar <= 640px = ponsel): tablet > 640px juga
// termasuk perangkat sentuh, sehingga verifikasi e.id tetap bisa dilakukan
// dari tablet itu sendiri tanpa perangkat kedua untuk memindai QR.

import { useEffect, useState } from 'react';

const TOUCH_QUERY = '(pointer: coarse)';

export default function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia &&
      window.matchMedia(TOUCH_QUERY).matches
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(TOUCH_QUERY);
    const onChange = (e) => setIsTouch(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isTouch;
}
