// frontend/src/lib/interest.js
// Beacon event minat — ringan & privasi-aman: hanya mengirim JENIS aksi,
// TIDAK pernah mengirim isi teks/field apa pun. Dipakai utk mengukur
// ketertarikan (buka detail, buka form lapor, kontak diketik/kirim WA).
// Memakai navigator.sendBeacon (tidak memblokir; otomatis no-op di
// lingkungan tanpa sendBeacon, mis. test/jsdom).

export function beacon(ev) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
    const blob = new Blob([JSON.stringify({ e: ev })], { type: 'application/json' });
    navigator.sendBeacon('/api/track', blob);
  } catch (_e) {
    // gagal mengirim = abaikan (tidak mengganggu UX)
  }
}
