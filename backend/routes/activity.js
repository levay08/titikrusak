'use strict';

// backend/routes/activity.js
// Feed aktivitas gabungan (transparansi): SEMUA kejadian di sistem -
// laporan baru (warga), perubahan status (otoritas), dan dukungan/vote
// (warga) - digabung menjadi satu timeline terurut terbaru. Dipakai menu
// Notifikasi (HeaderModals). TIDAK membocorkan field DID: hanya nama
// tampilan (actor) + lokasi + waktu.

const express = require('express');
const db = require('../db/db.js');
const { countUnread, latestAt } = require('../services/notifUnread.js');

const router = express.Router();

// Susun feed notifikasi (dipakai GET / dan GET /unread supaya hitungan
// "belum dibaca" selalu sama dengan yang tampil di modal).
function buildFeed(limit) {
    // 1) Laporan baru (warga): severity + infra_type disertakan agar UI
    //    bisa menampilkan chip kontekstual seperti sebelumnya.
    const created = db
      .prepare(
        `SELECT 'report_created' AS type, id AS report_id, location_name,
                reporter_display_name AS actor, source_type,
                source_media_name, source_media_date, severity, infra_type,
                reporter_is_verified, created_at AS at
         FROM reports`
      )
      .all();

    // 2) Perubahan status oleh OTORITAS via e.id (changed_by_did terisi).
    //    Baris "Kurasi Media (sistem)" TIDAK masuk tab aktivitas laporan -
    //    itu bagian kabar media (lihat mediaEvents: kind 'perbaikan').
    const statuses = db
      .prepare(
        `SELECT 'status_changed' AS type, h.report_id, r.location_name,
                h.changed_by_display_name AS actor, h.new_status, h.changed_at AS at
         FROM status_history h JOIN reports r ON r.id = h.report_id
         WHERE h.changed_by_did IS NOT NULL`
      )
      .all();

    // 4) Diskusi: ringkasan per titik (nama + kerusakan + jumlah komentar +
    //    komentar terbaru: dari siapa & kapan). Tanpa nama pribadi otoritas.
    const commentRows = db
      .prepare(
        `SELECT c.id AS cid, c.report_id, r.location_name, r.infra_type,
                r.severity, c.display_name, c.created_at
         FROM comments c JOIN reports r ON r.id = c.report_id
         ORDER BY c.id DESC LIMIT 500`
      )
      .all();
    const groupMap = new Map();
    for (const c of commentRows) {
      const g = groupMap.get(c.report_id);
      if (!g) {
        groupMap.set(c.report_id, {
          report_id: c.report_id,
          location_name: c.location_name,
          infra_type: c.infra_type,
          severity: c.severity,
          count: 1,
          last_id: c.cid,
          last_name: c.display_name || 'Anonim',
          last_at: c.created_at,
        });
      } else {
        g.count++;
      }
    }
    const commentGroups = [...groupMap.values()].slice(0, 40);

    // 5) Kabar MEDIA: kejadian terakhir tiap titik seed - apa yang DITAMBAH,
    //    DIPERBARUI, atau DIBERITAKAN SUDAH DIPERBAIKI. Diturunkan dari kolom
    //    yang ada (tidak perlu tabel log baru):
    //      - media_repair_at  -> kind 'perbaikan'
    //      - updated != created -> kind 'update' (+ judul berita [Update] terakhir)
    //      - sisanya          -> kind 'baru'
    //    `is_new_seed` = titik tersentuh cycle monitor TERAKHIR (badge BARU).
    const mediaRows = db
      .prepare(
        `SELECT id AS report_id, location_name, severity, infra_type, status,
                source_media_name, source_media_date, is_new_seed,
                created_at, updated_at, media_repair_at, description
         FROM reports WHERE source_type = 'media'`
      )
      .all();
    // Catatan [Update] TERAKHIR di deskripsi (judul berita + sumbernya).
    const LAST_NOTE_RE = /\[Update (\d{4}-\d{2}-\d{2}): ([^\]]+)\](?![\s\S]*\[Update )/;
    const allMedia = mediaRows.map((r) => {
      const m = String(r.description || '').match(LAST_NOTE_RE);
      const updated = String(r.updated_at) !== String(r.created_at);
      // kind: perbaikan > update > baru (hanya bila tersentuh cycle terakhir)
      // > tercatat (titik lama yang belum pernah diperbarui - label netral,
      // jangan mengaku "baru").
      let kind = 'tercatat';
      let at = r.created_at;
      if (r.media_repair_url || r.media_repair_at) {
        kind = 'perbaikan';
        at = r.media_repair_at || r.updated_at || r.created_at;
      } else if (updated) {
        kind = 'update';
        at = r.updated_at;
      } else if (Number(r.is_new_seed) === 1) {
        kind = 'baru';
      }
      return {
        kind,
        at,
        report_id: r.report_id,
        location_name: r.location_name,
        severity: r.severity,
        infra_type: r.infra_type,
        status: r.status,
        source_media_name: r.source_media_name,
        source_media_date: r.source_media_date,
        is_new_seed: r.is_new_seed,
        note: m ? m[2].trim() : null,
      };
    });
    // Semua kabar "diberitakan sudah diperbaiki" SELALU tampil (jangan
    // terpotong batas 60 karena tanggalnya tua), sisanya urut terbaru.
    const byAtDesc = (a, b) => String(b.at).localeCompare(String(a.at));
    const mediaEvents = [
      ...allMedia.filter((e) => e.kind === 'perbaikan').sort(byAtDesc),
      ...allMedia.filter((e) => e.kind !== 'perbaikan').sort(byAtDesc).slice(0, 60),
    ];

    // Tab "Aktivitas Laporan": HANYA laporan manual warga (source_type bukan
    // 'media') + perubahan status oleh otoritas e.id. Vote dukungan tidak
    // dimasukkan (bukan aktivitas laporan).
    const activities = [
      ...created.filter((c) => c.source_type !== 'media'),
      ...statuses,
    ]
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, limit);

  return { activities, commentGroups, mediaEvents };
}

// GET /api/activity?limit=50
router.get('/', (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  try {
    res.json(buildFeed(limit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat aktivitas' });
  }
});

// GET /api/activity/unread?since=<YYYY-MM-DD HH:MM:SS>
// Jumlah notifikasi BELUM DIBACA sejak warga terakhir membuka menu Notifikasi.
// `since` kosong (kunjungan pertama) -> total 0 supaya badge tidak menyalakan
// seluruh riwayat; `latestAt` tetap dikirim sebagai penanda awal.
router.get('/unread', (req, res) => {
  const since = String(req.query.since || '').trim();
  try {
    const feed = buildFeed(200);
    const comments = since
      ? db
          .prepare('SELECT COUNT(*) AS c FROM comments WHERE datetime(created_at) > datetime(?)')
          .get(since).c
      : 0;
    const counts = countUnread(feed, comments, since);
    const newest = latestAt({
      reports: db.prepare('SELECT created_at, updated_at, media_repair_at FROM reports').all(),
      statuses: db.prepare('SELECT changed_at FROM status_history').all(),
      comments: db.prepare('SELECT created_at FROM comments').all(),
    });
    res.json({ ...counts, latestAt: newest, since });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal memuat jumlah notifikasi' });
  }
});

// ---- Riwayat status SATU laporan (transparansi publik): siapa/apa/kapan
//      tanpa nama pribadi otoritas - cukup label "Otoritas". ----
router.get('/report/:reportId', (req, res) => {
  const id = Number(req.params.reportId);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(404).json({ error: 'Laporan tidak ditemukan' });
  }
  try {
    const rows = db
      .prepare(
        `SELECT new_status, changed_at
         FROM status_history WHERE report_id = ?
         ORDER BY changed_at DESC`
      )
      .all(id);
    res.json({
      history: rows.map((r) => ({ new_status: r.new_status, changed_at: r.changed_at })),
    });
  } catch (_e) {
    res.status(500).json({ error: 'Gagal memuat riwayat status' });
  }
});

module.exports = router;
