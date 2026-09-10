'use strict';

// backend/services/notifUnread.js
// Hitungan notifikasi BELUM DIBACA untuk lonceng header.
//
// Sumber "belum dibaca" = kejadian yang waktu-nya LEBIH BARU dari waktu
// terakhir kali warga membuka menu Notifikasi (`since`). Sama persis dengan
// isi tiga tab di modal Notifikasi:
//   - media      : kabar seed media yang BARU / DIPERBARUI / DIBERITAKAN
//                  SUDAH DIPERBAIKI (kind 'tercatat' TIDAK dihitung - itu
//                  cuma titik lama yang tidak pernah berubah).
//   - activities : laporan manual warga + perubahan status oleh otoritas.
//   - comments   : komentar warga (dihitung per komentar, bukan per titik).
//
// PENTING - format waktu: kolom created_at/updated_at/changed_at disimpan
// sebagai 'YYYY-MM-DD HH:MM:SS' (UTC) sedangkan media_repair_at sebagai ISO
// 'YYYY-MM-DDTHH:MM:SS.sssZ'. Karena itu SEMUA perbandingan lewat normalisasi
// dulu (norm) supaya campur format tidak salah hitung.

const UNREAD_MEDIA_KINDS = new Set(['baru', 'update', 'perbaikan']);

// Normalisasi waktu apa pun menjadi kunci terurut 'YYYY-MM-DD HH:MM:SS' (UTC).
// '' kalau tidak bisa dibaca.
function norm(at) {
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

// Apakah `at` lebih baru dari `since`? `since` kosong = tidak ada yang baru
// (kunjungan pertama: jangan menyalakan badge untuk seluruh riwayat).
function isAfter(at, since) {
  const a = norm(at);
  if (!a) return false;
  const s = norm(since);
  if (!s) return false;
  return a > s;
}

// Hitung jumlah per kategori dari feed yang sudah jadi (activities +
// mediaEvents) plus jumlah komentar mentah dari DB.
function countUnread(feed = {}, commentCount = 0, since = '') {
  const mediaEvents = Array.isArray(feed.mediaEvents) ? feed.mediaEvents : [];
  const activities = Array.isArray(feed.activities) ? feed.activities : [];
  const media = mediaEvents.filter(
    (e) => UNREAD_MEDIA_KINDS.has(String(e.kind)) && isAfter(e.at, since)
  ).length;
  const acts = activities.filter((a) => isAfter(a.at, since)).length;
  const comments = norm(since) ? Math.max(Number(commentCount) || 0, 0) : 0;
  return { media, activities: acts, comments, total: media + acts + comments };
}

// Waktu kejadian TERBARU di seluruh sumber (untuk disimpan klien sebagai
// penanda "sudah dilihat").
function latestAt(rows = {}) {
  const all = [];
  const push = (list, key) => {
    for (const r of Array.isArray(list) ? list : []) {
      const n = norm(r && r[key]);
      if (n) all.push(n);
    }
  };
  push(rows.reports, 'created_at');
  push(rows.reports, 'updated_at');
  push(rows.reports, 'media_repair_at');
  push(rows.statuses, 'changed_at');
  push(rows.comments, 'created_at');
  return all.sort().pop() || '';
}

module.exports = { norm, isAfter, countUnread, latestAt, UNREAD_MEDIA_KINDS };
