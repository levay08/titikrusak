'use strict';

// backend/scripts/news-monitor.js — CLI pemantau berita -> titik peta.
//
// Penggunaan:
//   node scripts/news-monitor.js            # jalankan & masukkan ke peta
//   MONITOR_DRY=1 node scripts/news-monitor.js   # kandidat saja, tanpa insert
//
// Dijadwalkan via cron di server (root crontab):
//   17 * * * * cd /var/www/titikrusak/backend && . /root/.nvm/nvm.sh && \
//     node scripts/news-monitor.js >> /var/log/titikrusak-news-monitor.log 2>&1

const { runMonitor } = require('../services/newsMonitor.js');

(async () => {
  const dry = process.env.MONITOR_DRY === '1';
  const started = Date.now();
  const res = await runMonitor({ dry, log: (s) => console.log(s) });
  const lines = [
    `[${new Date().toISOString()}] news-monitor ${dry ? '(DRY)' : ''}`,
    `  pindai=${res.scanned} kandidat=${res.candidates} masuk=${res.inserted} update=${res.updated} gabung=${res.merged} lewati=${res.skipped} error=${res.errors} (${Date.now() - started}ms)`,
  ];
  if (!dry && (res.inserted > 0 || res.updated > 0 || res.merged > 0)) lines.push(`  => peta diperbarui: +${res.inserted} titik baru, ${res.updated} titik di-update, ${res.merged} duplikat digabung.`);
  console.log(lines.join('\n'));
  process.exit(0);
})().catch((e) => {
  console.error('news-monitor gagal:', e && e.message ? e.message : e);
  process.exit(1);
});
