// frontend/src/lib/notifUnread.js
// Penanda "notifikasi sudah dilihat" untuk badge lonceng header.
//
// Cara kerja: server mengirim jumlah notifikasi yang waktunya lebih baru dari
// `since` (penanda terakhir dilihat). Penanda itu disimpan di localStorage
// supaya badge tetap benar setelah halaman di-refresh, dan diambil dari
// SERVER (latestAt) - bukan jam browser - agar format waktunya sama dengan
// kolom waktu di DB.

export const NOTIF_SEEN_KEY = 'tk_notif_seen_at';

// Semua 0 = tidak ada yang baru.
export const NO_UNREAD = { total: 0, media: 0, activities: 0, comments: 0, latestAt: '' };

// Penanda terakhir dilihat ('' = belum pernah membuka menu Notifikasi).
export function readSeen(store) {
  try {
    const s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    return (s && s.getItem(NOTIF_SEEN_KEY)) || '';
  } catch (_e) {
    return '';
  }
}

export function writeSeen(at, store) {
  try {
    const s = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (s) s.setItem(NOTIF_SEEN_KEY, String(at || ''));
  } catch (_e) {
    /* localStorage bisa diblokir; abaikan */
  }
}

// Angka pada badge: maksimal "9+" supaya lingkarannya tidak melebar.
export function badgeText(total) {
  const n = Number(total) || 0;
  if (n <= 0) return '';
  return n > 9 ? '9+' : String(n);
}

// Ambil jumlah belum-dibaca dari server. Gagal jaringan -> null (badge
// dibiarkan seperti sebelumnya, jangan menyalakan angka palsu).
export async function fetchUnread(since, fetchImpl) {
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) return null;
  try {
    const q = since ? `?since=${encodeURIComponent(since)}` : '';
    const res = await f(`/api/activity/unread${q}`);
    if (!res.ok) return null;
    const body = await res.json();
    return {
      total: Number(body.total) || 0,
      media: Number(body.media) || 0,
      activities: Number(body.activities) || 0,
      comments: Number(body.comments) || 0,
      latestAt: body.latestAt ? String(body.latestAt) : '',
    };
  } catch (_e) {
    return null;
  }
}
