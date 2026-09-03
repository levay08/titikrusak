// frontend/src/lib/eidSession.js
// Penyimpanan sesi e.id hasil verifikasi (session_id + role) - dipakai
// sebagai header 'x-eid-session' untuk SEMUA aksi yang butuh otorisasi
// server (vote, status, edit, hapus, klaim perbaikan, tanda X). Server
// memverifikasi ke tabel verification_sessions; klien hanya menyimpan.

const KEY = 'titikrusak_eid_session';

export function getEidSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s.session_id === 'string' && s.session_id ? s : null;
  } catch (_e) {
    return null;
  }
}

export function setEidSession({ session_id, role }) {
  if (!session_id) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ session_id, role: role || 'warga' }));
    notifyEidChanged();
  } catch (_e) {
    // abaikan bila localStorage tidak tersedia
  }
}

export function clearEidSession() {
  try {
    localStorage.removeItem(KEY);
    notifyEidChanged();
  } catch (_e) {
    // abaikan
  }
}

// Beri tahu komponen lain (App, header) bahwa sesi berubah - dipakai utk
// memunculkan/menyembunyikan menu Keluar & Login tanpa perlu reload.
function notifyEidChanged() {
  try {
    window.dispatchEvent(new CustomEvent('tk:eid-changed'));
  } catch (_e) {
    // abaikan
  }
}

// Header fetch yang aman dipakai di mana saja.
export function eidSessionHeaders() {
  const s = getEidSession();
  return s ? { 'x-eid-session': s.session_id } : {};
}
