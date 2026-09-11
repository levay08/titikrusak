'use strict';

// backend/services/updateNotes.js
// CATATAN UPDATE titik (11 Sep 2026).
//
// Masalah yang dijawab: titik hasil pemberitaan media sering hanya punya SATU
// berita (kejadian awal) dan tidak pernah ada kabar perbaikan setelahnya.
// Untuk kerusakan akibat BENCANA ALAM ini menyesatkan: banjir bulan Juli yang
// disemai bulan September tidak mungkin "masih banjir" - air pasti sudah surut,
// jadi yang benar adalah "belum ada kabar perbaikan" (bisa jadi sudah diperbaiki
// tanpa diberitakan, bisa jadi rusak tapi belum disentuh). Sebaliknya untuk
// GEMPA/LONGSOR, perbaikan memang sering berbulan-bulan, sehingga wajar titik
// tetap rusak walau belum ada kabar.
//
// Karena itu setiap titik media dapat kolom `update_note` (kalimat pendek yang
// jujur) + `disaster_type`/`disaster_at` (dasar kalimatnya). Catatan ini DIISI
// OTOMATIS dan selalu disegarkan: monitor memanggilnya tiap cycle, deploy
// memanggilnya lewat scripts/annotate-update-notes.js. Bila sudah ada kabar
// lanjutan (media_updates), klaim perbaikan media, atau otoritas sudah
// bertindak, catatannya DIKOSONGKAN - tidak perlu lagi.

const db = require('../db/db.js');

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Umur (hari) sejak kejadian yang membuat klaim "peristiwa sudah berlalu"
// aman: banjir/kebakaran/angin tidak bertahan berminggu-minggu.
const LEWAT_HARI = 14;
// Untuk kerusakan BUKAN bencana, catatan baru perlu setelah cukup lama
// (berita 2 hari lalu yang belum ada lanjutannya itu wajar, bukan anomali).
const DIAM_HARI = 30;

// Urutan penting: gempa > kebakaran > banjir bandang > banjir > longsor >
// angin > erupsi. Judul seperti "banjir bandang dan longsor" dipetakan ke
// bencana yang paling cepat berlalu (air surut), itu yang paling informatif.
const BENCANA = [
  {
    type: 'gempa',
    label: 'Gempa',
    re: /\bgempa\b|mengguncang|magnitudo|richter|\bm\s?\d[.,]\d\b/i,
    lama: (p) => `Gempa ${p}. Perbaikan pascagempa biasanya berbulan-bulan. Belum ada kabar perbaikan titik ini.`,
    baru: (p) => `Gempa ${p}. Belum ada kabar perbaikan titik ini.`,
  },
  {
    type: 'kebakaran',
    label: 'Kebakaran',
    re: /kebakaran|terbakar|dilalap api|si jago merah/i,
    lama: (p) => `Kebakaran ${p} sudah padam. Belum ada kabar perbaikan titik ini, jadi kondisinya belum bisa dipastikan.`,
    baru: (p) => `Kebakaran ${p}. Belum ada kabar perbaikan titik ini.`,
  },
  {
    type: 'banjir_bandang',
    label: 'Banjir bandang',
    re: /banjir bandang|bandang/i,
    lama: (p) => `Banjir bandang ${p} sudah surut. Belum ada kabar perbaikan titik ini, jadi kondisinya belum bisa dipastikan masih rusak atau sudah diperbaiki.`,
    baru: (p) => `Banjir bandang ${p}. Belum ada kabar perbaikan titik ini.`,
  },
  {
    type: 'banjir',
    label: 'Banjir',
    re: /banjir|terendam|digenangi|genangan/i,
    lama: (p) => `Banjir ${p} sudah surut. Belum ada kabar perbaikan titik ini, jadi kondisinya belum bisa dipastikan masih rusak atau sudah diperbaiki.`,
    baru: (p) => `Banjir ${p}. Belum ada kabar perbaikan titik ini.`,
  },
  {
    type: 'longsor',
    label: 'Longsor',
    re: /longsor|tanah longsor|galodo|material/i,
    lama: (p) => `Longsor ${p}: materialnya sudah ditangani. Belum ada kabar perbaikan titik ini, jadi kondisinya belum bisa dipastikan.`,
    baru: (p) => `Longsor ${p}. Belum ada kabar perbaikan titik ini.`,
  },
  {
    type: 'angin',
    label: 'Angin kencang',
    re: /puting beliung|angin kencang|angin ribut|diterjang angin/i,
    lama: (p) => `Angin kencang ${p} sudah berlalu. Belum ada kabar perbaikan titik ini, jadi kondisinya belum bisa dipastikan.`,
    baru: (p) => `Angin kencang ${p}. Belum ada kabar perbaikan titik ini.`,
  },
  {
    type: 'erupsi',
    label: 'Erupsi gunung',
    re: /erupsi|meletus|letusan gunung|lahar|abu vulkanik/i,
    lama: (p) => `Erupsi ${p}. Belum ada kabar perbaikan titik ini, jadi kondisinya belum bisa dipastikan.`,
    baru: (p) => `Erupsi ${p}. Belum ada kabar perbaikan titik ini.`,
  },
];

// Jenis bencana dari teks laporan (deskripsi + judul berita pertama).
function detectDisaster(text, { relatedEarthquake } = {}) {
  const t = String(text || '');
  if (relatedEarthquake && String(relatedEarthquake).trim() !== '') return 'gempa';
  for (const b of BENCANA) if (b.re.test(t)) return b.type;
  return null;
}

function bulanTahun(d) {
  const dt = new Date(`${String(d).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return '';
  return `${BULAN[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

function umurHari(iso, now = Date.now()) {
  const t = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((now - t) / 86400000);
}

// Kalimat catatan untuk satu baris (null = tidak perlu catatan).
function buildNote(row, now) {
  const sudahAdaKabar = Boolean(row.media_repair_url || row.media_repair_at)
    || (() => {
      try {
        const v = JSON.parse(row.media_updates || '[]');
        return Array.isArray(v) && v.length > 0;
      } catch (_e) {
        return false;
      }
    })();
  // Otoritas sudah memverifikasi/menangani = sudah ada informasi, atau titik
  // sudah selesai: tidak perlu catatan "belum ada kabar".
  if (sudahAdaKabar || row.status !== 'dilaporkan') return null;

  const teks = `${row.description || ''}`;
  const type = detectDisaster(teks, { relatedEarthquake: row.related_earthquake });
  const acuan = String(row.source_media_date || row.created_at || '').slice(0, 10);
  const periode = bulanTahun(acuan);
  const umur = umurHari(acuan, now);
  if (!periode) return null;

  if (type) {
    const b = BENCANA.find((x) => x.type === type);
    if (!b) return null;
    return { type, at: acuan, note: umur >= LEWAT_HARI ? b.lama(periode) : b.baru(periode) };
  }
  if (umur >= DIAM_HARI) {
    return { type: null, at: acuan, note: `Belum ada kabar lanjutan sejak pemberitaan pertama (${periode}).` };
  }
  return null;
}

// Segarkan catatan SEMUA titik media (idempotent, dipanggil tiap cycle monitor
// dan saat deploy). Hanya kolom catatan yang disentuh - updated_at TIDAK
// diubah supaya feed "Kabar Media" tidak banjir entri palsu.
function refreshUpdateNotes({ log = () => {} } = {}) {
  const rows = db
    .prepare(
      `SELECT id, description, media_updates, media_repair_url, media_repair_at,
              status, source_media_date, created_at, related_earthquake,
              update_note, disaster_type
       FROM reports WHERE source_type = 'media'`
    )
    .all();
  const set = db.prepare('UPDATE reports SET update_note = ?, disaster_type = ?, disaster_at = ? WHERE id = ?');
  const now = Date.now();
  let filled = 0;
  let cleared = 0;
  let sama = 0;
  const tx = db.transaction(() => {
    for (const row of rows) {
      const hasil = buildNote(row, now);
      const note = hasil ? hasil.note : null;
      const type = hasil ? hasil.type : null;
      const at = hasil ? hasil.at : null;
      if (!note && !row.update_note) {
        sama += 1;
        continue;
      }
      if (note && note === row.update_note && type === row.disaster_type) {
        sama += 1;
        continue;
      }
      set.run(note, type, at, row.id);
      if (note) filled += 1;
      else cleared += 1;
    }
  });
  tx();
  const ringkas = { scanned: rows.length, filled, cleared, sama };
  log(`  catatan update: ${filled} titik diberi catatan, ${cleared} dikosongkan, ${sama} tidak berubah`);
  return ringkas;
}

module.exports = { detectDisaster, buildNote, refreshUpdateNotes, bulanTahun, LEWAT_HARI, DIAM_HARI };
