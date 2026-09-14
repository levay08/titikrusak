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

// Normalisasi waktu apa pun menjadi kunci terurut 'YYYY-MM-DD HH:MM:SS' (UTC).
// Cerminan backend/services/notifUnread.js -> norm(): kolom DB memakai
// 'YYYY-MM-DD HH:MM:SS' sementara media_repair_at memakai ISO, jadi
// perbandingan di klien harus lewat jalur yang sama. '' = tidak terbaca.
export function normAt(at) {
  if (!at) return '';
  const s = String(at).trim();
  if (!s) return '';
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

// Apakah kejadian `at` LEBIH BARU dari penanda terakhir dilihat? Dipakai untuk
// menandai baris notifikasi BARU di dalam menu (foreground berwarna). Penanda
// kosong = belum pernah membuka menu -> tidak ada yang ditandai baru, sama
// seperti badge lonceng yang tidak menyalakan seluruh riwayat.
export function isNewerThan(at, seen) {
  const a = normAt(at);
  const s = normAt(seen);
  if (!a || !s) return false;
  return a > s;
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
