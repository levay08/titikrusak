// qa-inventory.js — inventarisasi + pemeriksaan integritas data (READ-ONLY).
// Jalankan di backend: node qa-inventory.js
const Database = require('better-sqlite3');
const db = new Database(require('path').join(__dirname, '..', 'reports.db'), { readonly: true });
const q = (s, ...a) => db.prepare(s).all(...a);
const one = (s, ...a) => db.prepare(s).get(...a);
const line = (t) => console.log(`\n== ${t}`);

line('JUMLAH');
console.log(one(`SELECT COUNT(*) AS total,
  SUM(CASE WHEN source_type='media' THEN 1 ELSE 0 END) AS media,
  SUM(CASE WHEN source_type='warga' OR source_type IS NULL THEN 1 ELSE 0 END) AS warga FROM reports`));

line('SEBARAN BULAN source_media_date (media)');
for (const r of q(`SELECT substr(COALESCE(source_media_date,'(kosong)'),1,7) AS bulan,
      COUNT(*) AS n, SUM(CASE WHEN status='selesai_diperbaiki' THEN 1 ELSE 0 END) AS selesai
    FROM reports WHERE source_type='media' GROUP BY bulan ORDER BY bulan`)) {
  console.log(`  ${r.bulan} : ${r.n} titik (selesai_diperbaiki: ${r.selesai})`);
}

line('DI LUAR JENDELA Jan-Sep 2026');
console.log(one(`SELECT
  SUM(CASE WHEN source_type='media' AND (source_media_date IS NULL OR source_media_date='') THEN 1 ELSE 0 END) AS tanpa_tanggal,
  SUM(CASE WHEN source_type='media' AND source_media_date < '2026-01-01' THEN 1 ELSE 0 END) AS sebelum_2026,
  SUM(CASE WHEN source_type='media' AND source_media_date > '2026-09-30' THEN 1 ELSE 0 END) AS setelah_sep2026,
  SUM(CASE WHEN source_type='media' AND source_media_date >= '2026-01-01' AND source_media_date <= '2026-09-30' THEN 1 ELSE 0 END) AS di_dalam FROM reports`));

line('STATUS');
for (const r of q(`SELECT status, COUNT(*) n FROM reports GROUP BY status ORDER BY n DESC`)) {
  console.log(`  ${r.status} : ${r.n}`);
}

line('FOTO');
console.log(one(`SELECT SUM(CASE WHEN photo_urls IS NULL OR photo_urls IN ('','[]') THEN 1 ELSE 0 END) AS tanpa_foto,
  SUM(CASE WHEN photo_urls LIKE '%news.google.com%' THEN 1 ELSE 0 END) AS foto_gnews FROM reports`));

line('SUMBER');
console.log(one(`SELECT SUM(CASE WHEN source_media_url IS NULL OR source_media_url='' THEN 1 ELSE 0 END) AS tanpa_url,
  SUM(CASE WHEN source_media_url LIKE '%news.google.com%' THEN 1 ELSE 0 END) AS url_gnews FROM reports WHERE source_type='media'`));

line('INTEGRITAS');
console.log('vote_count != jumlah baris votes:');
console.log(q(`SELECT r.id, r.location_name, r.vote_count, (SELECT COUNT(*) FROM votes v WHERE v.report_id=r.id) AS asli
  FROM reports r WHERE COALESCE(r.vote_count,0) != (SELECT COUNT(*) FROM votes v WHERE v.report_id=r.id) LIMIT 10`));
console.log('claim count != jumlah baris status_claims:');
console.log(q(`SELECT r.id, r.claim_fixed_count, r.claim_gone_count,
  (SELECT COUNT(*) FROM status_claims s WHERE s.report_id=r.id AND s.kind='diperbaiki') AS fix_asli,
  (SELECT COUNT(*) FROM status_claims s WHERE s.report_id=r.id AND s.kind='hilang') AS gone_asli
  FROM reports r WHERE COALESCE(r.claim_fixed_count,0) != (SELECT COUNT(*) FROM status_claims s WHERE s.report_id=r.id AND s.kind='diperbaiki')
     OR COALESCE(r.claim_gone_count,0) != (SELECT COUNT(*) FROM status_claims s WHERE s.report_id=r.id AND s.kind='hilang') LIMIT 10`));
console.log('baris yatim (votes/komentar/status/klaim menunjuk laporan yang tidak ada):');
console.log(one(`SELECT (SELECT COUNT(*) FROM votes v LEFT JOIN reports r ON r.id=v.report_id WHERE r.id IS NULL) AS votes_yatim,
  (SELECT COUNT(*) FROM comments c LEFT JOIN reports r ON r.id=c.report_id WHERE r.id IS NULL) AS komentar_yatim,
  (SELECT COUNT(*) FROM status_history h LEFT JOIN reports r ON r.id=h.report_id WHERE r.id IS NULL) AS status_yatim,
  (SELECT COUNT(*) FROM status_claims s LEFT JOIN reports r ON r.id=s.report_id WHERE r.id IS NULL) AS klaim_yatim`));
console.log('status selesai_diperbaiki tanpa media_repair_at:');
console.log(q(`SELECT id, location_name FROM reports WHERE status='selesai_diperbaiki' AND (media_repair_at IS NULL OR media_repair_at='') LIMIT 10`));
console.log('koordinat kosong/aneh:');
console.log(one(`SELECT SUM(CASE WHEN lat IS NULL OR lng IS NULL THEN 1 ELSE 0 END) AS kosong,
  SUM(CASE WHEN lat NOT BETWEEN -11.5 AND 6.5 OR lng NOT BETWEEN 94.5 AND 141.5 THEN 1 ELSE 0 END) AS di_luar_indonesia FROM reports`));
console.log('tanggal tidak berformat YYYY-MM-DD:');
console.log(q(`SELECT id, source_media_date FROM reports WHERE source_type='media'
  AND source_media_date IS NOT NULL AND source_media_date != '' AND source_media_date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*' LIMIT 10`));

line('DUPLIKAT nama lokasi (>=2 baris)');
for (const r of q(`SELECT location_name, COUNT(*) n, GROUP_CONCAT(id) ids FROM reports
    GROUP BY lower(location_name) HAVING n > 1 ORDER BY n DESC LIMIT 15`)) {
  console.log(`  ${r.n}x  ${r.location_name.slice(0, 70)}  [${r.ids}]`);
}

line('JUMLAH BARIS TABEL LAIN');
for (const t of ['votes', 'comments', 'status_history', 'status_claims', 'fix_claims', 'bookmarks']) {
  try { console.log(`  ${t}: ${one(`SELECT COUNT(*) n FROM ${t}`).n}`); } catch (e) { console.log(`  ${t}: (tidak ada: ${e.message.slice(0, 40)})`); }
}

line('UPDATE DI DESKRIPSI');
console.log(one(`SELECT SUM(CASE WHEN description LIKE '%[Update %' THEN 1 ELSE 0 END) AS ada_update,
  SUM(CASE WHEN description LIKE '%[Update 2026-0%' THEN 1 ELSE 0 END) AS update_2026 FROM reports`));
