// qa-clean-window.js — bersihkan titik media di luar jendela Jan-Sep 2026
// dan rapikan duplikat, dengan arsip + backup lebih dulu.
//
//   node qa-clean-window.js            -> laporan (dry-run)
//   node qa-clean-window.js --apply    -> jalankan perubahan
//
// Aman diulang (idempotent): baris yang sudah bersih tidak disentuh lagi.
'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { mergeMediaDuplicates, fetchOgImage, inSeedWindow, SEED_MIN_DATE } = require('../services/newsMonitor.js');

const APPLY = process.argv.includes('--apply');
const DATA_DIR = path.join(__dirname, '..', 'data');
const ARCHIVE = path.join(DATA_DIR, 'archive-media-out-of-window.json');

const db = new Database(path.join(__dirname, '..', 'reports.db'));
const q = (s, ...a) => db.prepare(s).all(...a);

async function main() {
  // ---- 1) Arsipkan titik di luar jendela (beserta datanya) ----
  const outside = q(
    `SELECT * FROM reports
     WHERE source_type = 'media'
       AND (source_media_date IS NULL OR source_media_date = '' OR source_media_date < ? OR source_media_date > '2026-09-30')`,
    SEED_MIN_DATE
  );
  console.log(`Titik di luar jendela Jan-Sep 2026: ${outside.length}`);
  for (const r of outside) {
    console.log(`  #${r.id} ${String(r.source_media_date).slice(0, 10)}  ${r.location_name.slice(0, 58)}`);
  }

  // ---- 2) Duplikat objek yang sama (nama lokasi identik) ----
  const dupNames = q(
    `SELECT lower(location_name) AS nm, COUNT(*) n, GROUP_CONCAT(id) ids
     FROM reports GROUP BY nm HAVING n > 1 ORDER BY n DESC`
  );
  console.log(`\nGrup nama lokasi duplikat: ${dupNames.length}`);
  for (const d of dupNames) console.log(`  ${d.n}x [${d.ids}] ${d.name || d.nm.slice(0, 60)}`);

  if (!APPLY) {
    console.log('\n(dry-run) tidak ada perubahan. Jalankan dengan --apply untuk menerapkan.');
    db.close();
    return;
  }

  // ---- Backup ----
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
  const bak = path.join(__dirname, '..', `reports.db.bak-${stamp}-prewindow`);
  await db.backup(bak);
  console.log(`\nbackup: ${bak}`);

  // ---- Arsip + hapus titik di luar jendela ----
  const archived = JSON.parse(fs.existsSync(ARCHIVE) ? fs.readFileSync(ARCHIVE, 'utf8') : '[]');
  const byId = new Map(archived.map((x) => [x.report.id, x]));
  let removed = 0;
  const del = db.transaction(() => {
    for (const r of outside) {
      byId.set(r.id, {
        report: r,
        status_history: q('SELECT * FROM status_history WHERE report_id = ?', r.id),
        votes: q('SELECT * FROM votes WHERE report_id = ?', r.id),
        comments: q('SELECT * FROM comments WHERE report_id = ?', r.id),
        status_claims: q('SELECT * FROM status_claims WHERE report_id = ?', r.id),
      });
      db.prepare('DELETE FROM status_history WHERE report_id = ?').run(r.id);
      db.prepare('DELETE FROM votes WHERE report_id = ?').run(r.id);
      db.prepare('DELETE FROM comments WHERE report_id = ?').run(r.id);
      db.prepare('DELETE FROM status_claims WHERE report_id = ?').run(r.id);
      db.prepare('DELETE FROM reports WHERE id = ?').run(r.id);
      removed += 1;
    }
  });
  del();
  fs.writeFileSync(ARCHIVE, `${JSON.stringify([...byId.values()], null, 1)}\n`);
  console.log(`dihapus (diarsipkan ke ${path.basename(ARCHIVE)}): ${removed}`);

  // ---- Gabung duplikat (pakai logika monitor yang sudah teruji) ----
  const merged = mergeMediaDuplicates((m) => console.log(m));
  console.log(`duplikat digabung: ${merged}`);

  // ---- Foto yang belum ada: ambil dari artikel sumbernya ----
  const noPhoto = q(
    `SELECT id, location_name, source_media_url FROM reports
     WHERE (photo_urls IS NULL OR photo_urls IN ('', '[]'))`
  );
  console.log(`\nTitik tanpa foto: ${noPhoto.length}`);
  let fixed = 0;
  for (const r of noPhoto) {
    if (!/^https?:/i.test(String(r.source_media_url || ''))) continue;
    const img = await fetchOgImage(r.source_media_url);
    if (img) {
      db.prepare('UPDATE reports SET photo_urls = ? WHERE id = ?').run(JSON.stringify([img]), r.id);
      fixed += 1;
      console.log(`  + foto #${r.id} ${r.location_name.slice(0, 45)} -> ${img.slice(0, 70)}`);
    } else {
      console.log(`  - tanpa og:image: #${r.id} ${r.location_name.slice(0, 45)}`);
    }
    await new Promise((s) => setTimeout(s, 700));
  }
  console.log(`foto ditambahkan: ${fixed}`);

  // ---- Ringkasan akhir ----
  const s = db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN source_media_date < ? THEN 1 ELSE 0 END) AS pra_2026,
        SUM(CASE WHEN source_media_date > '2026-09-30' THEN 1 ELSE 0 END) AS pasca_sep,
        SUM(CASE WHEN photo_urls IS NULL OR photo_urls IN ('','[]') THEN 1 ELSE 0 END) AS tanpa_foto,
        SUM(CASE WHEN status='selesai_diperbaiki' THEN 1 ELSE 0 END) AS selesai
      FROM reports`
    )
    .get(SEED_MIN_DATE);
  console.log('\n=== SETELAH PEMBERSIHAN ===');
  console.log(s);
  console.log('sebaran bulan:');
  for (const row of q(
    `SELECT substr(source_media_date,1,7) bulan, COUNT(*) n FROM reports GROUP BY bulan ORDER BY bulan`
  )) {
    console.log(`  ${row.bulan}: ${row.n}`);
  }
  db.close();
}

main().catch((e) => {
  console.error('GAGAL:', e);
  process.exit(1);
});
