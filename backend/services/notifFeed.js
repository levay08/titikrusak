'use strict';

// backend/services/notifFeed.js
// Urutan feed notifikasi: SELALU waktu kejadian terbaru di atas.
//
// Menu Notifikasi = daftar notifikasi masuk, jadi urutannya murni KRONOLOGIS -
// bukan dikelompokkan per jenis kejadian. Ini memperbaiki keluhan nyata: tab
// "Kabar Media" dulu menaruh SEMUA kabar 'perbaikan' di paling atas, sehingga
// titik yang sudah lama diberitakan diperbaiki (mis. Jan 2026) menutupi kabar
// yang baru masuk hari ini.
//
// Aturan yang tidak boleh dilanggar:
//  - Kabar 'perbaikan' tetap SELALU tampil walau tanggalnya tua: batas 60
//    hanya berlaku untuk kabar jenis lain, jadi tidak ada kabar perbaikan yang
//    hilang dari daftar.
//  - Perbandingan waktu memakai norm() (services/notifUnread.js) karena kolom
//    waktu di DB bercampur format: 'YYYY-MM-DD HH:MM:SS' (UTC) vs ISO
//    'YYYY-MM-DDTHH:MM:SS.sssZ'. Bandingkan mentah = ISO selalu menang di
//    tanggal yang sama ('T' > ' '), urutannya jadi salah.

const { norm } = require('./notifUnread.js');

const MEDIA_LIMIT = 60;
const COMMENT_GROUP_LIMIT = 40;

// Pembanding: terbaru dulu. Waktu yang tidak terbaca (norm '' -> paling kecil)
// jatuh ke paling bawah, bukan menghalangi baris lain.
function byAtDesc(key) {
  return (a, b) => norm(b && b[key]).localeCompare(norm(a && a[key]));
}

// Feed tab "Kabar Media": kejadian 'perbaikan' (selalu ikut) + maksimal
// `limit` kejadian jenis lain, lalu SELURUHNYA diurutkan terbaru dulu.
function orderMediaEvents(allMedia = [], limit = MEDIA_LIMIT) {
  const list = Array.isArray(allMedia) ? allMedia : [];
  const selaluTampil = list.filter((e) => String(e && e.kind) === 'perbaikan');
  const lain = list
    .filter((e) => String(e && e.kind) !== 'perbaikan')
    .sort(byAtDesc('at'))
    .slice(0, limit);
  return [...selaluTampil, ...lain].sort(byAtDesc('at'));
}

// Feed tab "Komentar": ringkasan per titik, diurutkan menurut komentar
// TERBARU tiap titik (bukan menurut jumlah komentar) supaya notifikasi baru
// selalu di atas.
function orderCommentGroups(groups = [], limit = COMMENT_GROUP_LIMIT) {
  return (Array.isArray(groups) ? groups : [])
    .slice()
    .sort(byAtDesc('last_at'))
    .slice(0, limit);
}

module.exports = {
  orderMediaEvents,
  orderCommentGroups,
  byAtDesc,
  MEDIA_LIMIT,
  COMMENT_GROUP_LIMIT,
};
