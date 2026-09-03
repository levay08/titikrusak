'use strict';

// backend/scripts/osm-enrich.js
// Isi enrichment OSM untuk SEMUA titik yang belum punya konteks OSM.
//   OSM_LIMIT=N  -> proses hanya N titik (uji cepat)
//   OSM_DRY=1    -> hanya menampilkan apa yang akan dikerjakan

const db = require('../db/db.js');
const { ensureColumns, enrichOne } = require('../services/osmEnrich.js');

const LIMIT = Number(process.env.OSM_LIMIT) || 0;
const DRY = process.env.OSM_DRY === '1';

ensureColumns(db);
// Bersihkan hasil cacat dari percobaan sebelumnya (jarak NaN).
db.prepare("UPDATE reports SET enriched_osm = NULL WHERE enriched_osm LIKE '%NaN%'").run();
const missing = db
  .prepare('SELECT id, lat, lng, infra_type, location_name FROM reports WHERE enriched_osm IS NULL ORDER BY id')
  .all();
const target = LIMIT > 0 ? missing.slice(0, LIMIT) : missing;
console.log(`titik tanpa konteks OSM: ${missing.length}; diproses: ${target.length}`);

(async () => {
  const stat = { terisi: 0, kosong: 0, error: 0 };
  for (const r of target) {
    if (DRY) {
      console.log(`[dry] #${r.id} ${r.location_name} (${r.infra_type})`);
      continue;
    }
    const res = await enrichOne(db, r);
    if (res === 'terisi') stat.terisi++;
    else if (res === 'kosong') stat.kosong++;
    else stat.error++;
    if (LIMIT <= 10) console.log(`#${r.id} ${r.location_name.slice(0, 50)} -> ${res}`);
    await new Promise((ok) => setTimeout(ok, 2000)); // sopan ke Overpass (rate limit)
  }
  if (!DRY) console.log(`selesai: terisi=${stat.terisi} kosong(>300m)=${stat.kosong} error=${stat.error}`);
  process.exit(0);
})();
