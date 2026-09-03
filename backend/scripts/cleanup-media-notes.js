'use strict';

// backend/scripts/cleanup-media-notes.js - merapikan deskripsi titik media
// yang terlanjur menumpuk catatan [Update ...] duplikat (bug 2-3 Sep 2026:
// artikel sama di-append berulang lintas run). Idempotent - aman dijalankan
// ulang kapan saja.
//
// Aturan: pecah deskripsi jadi bagian-bagian "[Update YYYY-MM-DD: ...]";
// hanya pertahankan catatan yang UNIK (dedupe isi, case-insensitive, urutan
// kemunculan pertama dipertahankan); dasar = teks sebelum catatan pertama.

const db = require('../db/db.js');

const SEG_RE = /\[Update \d{4}-\d{2}-\d{2}: ([^\]]*?)\]/g;

function normalize(desc) {
  const s = String(desc || '').trim();
  const segs = [];
  SEG_RE.lastIndex = 0;
  let m;
  let baseEnd = 0;
  while ((m = SEG_RE.exec(s)) !== null) {
    if (!baseEnd) baseEnd = m.index;
    segs.push({ full: m[0], inner: m[1].trim() });
  }
  if (segs.length === 0) return s;
  const base = s.slice(0, baseEnd).trim();
  const baseKey = base.toLowerCase();
  const seen = new Set();
  const uniq = [];
  for (const seg of segs) {
    const inner = seg.inner.trim();
    // buang embel-embel "- nama outlet" utk pembandingan isi
    const innerKey = inner.replace(/\s*-\s*[^-\]]*$/u, '').toLowerCase();
    if (seen.has(innerKey)) continue;
    // catatan yang isinya sama persis dengan teks dasar = artikel itu
    // meng-update dirinya sendiri - buang (redundan).
    if (innerKey === baseKey) continue;
    seen.add(innerKey);
    uniq.push(seg.full);
  }
  let out = base;
  if (uniq.length > 0) out += (out ? ' ' : '') + uniq.join(' ');
  return out.trim();
}

const rows = db
  .prepare("SELECT id, description FROM reports WHERE source_type = 'media'")
  .all();
let changed = 0;
let maxBefore = 0;
let maxAfter = 0;
for (const row of rows) {
  const before = String(row.description || '');
  const after = normalize(before);
  if (before.length > maxBefore) maxBefore = before.length;
  if (after.length > maxAfter) maxAfter = after.length;
  if (after !== before) {
    db.prepare('UPDATE reports SET description = ? WHERE id = ?').run(after, row.id);
    changed += 1;
    console.log(`#${row.id}: ${before.length} -> ${after.length} karakter`);
  }
}
console.log(`\nselesai: ${changed}/${rows.length} titik dirapikan (panjang maks sebelum ${maxBefore} -> sesudah ${maxAfter})`);
