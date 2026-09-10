// backend/scripts/trim-media-reports.js
// Rapikan scripts/media-reports.json ke jendela produk (Jan-Sep 2026).
// Entri di luar jendela DIPINDAH ke scripts/media-reports-pra-2026.json
// (tidak dihapus - tetap tersimpan sebagai arsip).
//
// Jalankan: node scripts/trim-media-reports.js            (laporan saja)
//           node scripts/trim-media-reports.js --apply    (tulis file)
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'media-reports.json');
const ARCHIVE = path.join(__dirname, 'media-reports-pra-2026.json');
const MIN = '2026-01-01';
const MAX = '2026-09-30';
const APPLY = process.argv.includes('--apply');

const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const inWindow = [];
const outside = [];
for (const it of items) {
  const d = String(it.source_date || '').slice(0, 10);
  if (d >= MIN && d <= MAX) inWindow.push(it);
  else outside.push(it);
}

console.log(`total entri   : ${items.length}`);
console.log(`dalam jendela : ${inWindow.length}`);
console.log(`di luar       : ${outside.length}`);
for (const it of outside) console.log(`  - ${String(it.source_date).slice(0, 10)}  ${it.location_name.slice(0, 60)}`);

if (APPLY) {
  let archived = [];
  if (fs.existsSync(ARCHIVE)) {
    try {
      archived = JSON.parse(fs.readFileSync(ARCHIVE, 'utf8'));
    } catch (_e) {
      archived = [];
    }
  }
  const seenUrl = new Set(archived.map((x) => x.source_url));
  for (const it of outside) if (!seenUrl.has(it.source_url)) archived.push(it);
  fs.writeFileSync(ARCHIVE, `${JSON.stringify(archived, null, 2)}\n`);
  fs.writeFileSync(FILE, `${JSON.stringify(inWindow, null, 2)}\n`);
  console.log(`\n--apply: media-reports.json -> ${inWindow.length} entri; arsip -> ${archived.length} entri (${path.basename(ARCHIVE)})`);
} else {
  console.log('\n(dry-run - pakai --apply untuk menulis)');
}
