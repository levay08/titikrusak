'use strict';

// backend/lib/hitLogger.js
// Logger hit web app (2 Sep 2026): catat IP + waktu + request apa saja
// secara real-time ke file JSONL kecil di /srv/tk-hits/hits-YYYYMMDD-HH.jsonl.
// Ringan: tulis di-buffer dalam memori & di-flush tiap 5 detik; file
// berganti tiap jam (ukuran kecil). Aset statis (js/css/gambar/favicon)
// di-skip agar file tetap kecil - yang dicatat: halaman, API, dsb.
//
// File dipindah (bukan disalin) tiap hari ke mesin lokal lewat sftp/scp
// oleh cron sistem - lihat script lokal tk-pull.sh. Proses transfer
// berjalan sebagai user 'tklog' (tanpa root; ForceCommand internal-sftp).

const fs = require('fs');
const path = require('path');

const DIR = process.env.TK_HITS_DIR || '/srv/tk/hits';
const FLUSH_MS = 5000;
// Sesi berbasis IDLE (rekomendasi analitik): catat selama IP aktif, dan
// hentikan bila DIAM 10 menit. Kembali lagi >10 menit kemudian = sesi
// baru (boleh beberapa kali sehari). Batas aman per IP per hari agar
// file tetap kecil.
const IDLE_MS = Number(process.env.TK_HITS_IDLE_MS || 10 * 60 * 1000);
const MAX_PER_IP_DAY = 400;
const MAX_IPS = 50000; // pelindung memori

// ip -> { day: 'YYYYMMDD', last: ts, cnt }
const sessions = new Map();

function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

// true = catat baris ini; state sesi di-update di sini.
function trackDecision(ip, now) {
  const today = dayKey();
  let s = sessions.get(ip);
  if (!s || s.day !== today) {
    if (sessions.size >= MAX_IPS) {
      // buang yang paling lama diam dulu
      let oldestKey = null;
      let oldest = Infinity;
      for (const [k, v] of sessions) {
        if (v.last < oldest) { oldest = v.last; oldestKey = k; }
      }
      if (oldestKey) sessions.delete(oldestKey);
    }
    sessions.set(ip, { day: today, last: now, cnt: 1 });
    return true;
  }
  if (s.cnt >= MAX_PER_IP_DAY) return false;
  s.last = now;
  s.cnt += 1;
  return true;
}

// Path yang TIDAK dicatat (noise aset): /assets/*, gambar, favicon, dll.
const SKIP = /\.(js|css|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|webmanifest|json)$/i;
const SKIP_PATH = /^\/(assets\/|uploads\/|favicon\.|og-image\.)/;

let queue = [];
let timer = null;
let currentFile = '';

function fileNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `hits-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}.jsonl`;
}

function flush() {
  if (queue.length === 0) return;
  const rows = queue;
  queue = [];
  const f = fileNow();
  if (f !== currentFile) currentFile = f;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(path.join(DIR, currentFile), rows.join('\n') + '\n');
  } catch (_e) {
    // logger tidak boleh mematikan request - gagal tulis = lewati.
  }
}

function start() {
  if (timer) return;
  timer = setInterval(flush, FLUSH_MS);
  timer.unref();
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  flush();
}

// Middleware Express: catat setelah response selesai.
function hitLogger(req, res, next) {
  res.on('finish', () => {
    try {
      const u = (req.originalUrl || req.url || '/').split('?')[0];
      if (SKIP.test(u) || SKIP_PATH.test(u)) return;
      if (String(req.headers['user-agent'] || '').toLowerCase().includes('claudebot')) return;
      const fwd = req.headers['x-forwarded-for'];
      const ip = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket?.remoteAddress || '';
      const ipClean = String(ip).replace('::ffff:', '');
      if (!trackDecision(ipClean, Date.now())) return; // di luar sesi/batas aman
      const ts = new Date().toISOString();
      const ua = String(req.headers['user-agent'] || '').slice(0, 90);
      queue.push(
        JSON.stringify({
          t: ts,
          ip: ipClean,
          m: req.method,
          p: u.slice(0, 160),
          s: res.statusCode,
          ua,
        })
      );
    } catch (_e) {
      // abaikan
    }
  });
  next();
}

// Catat event minat dari frontend (mis. mengetik di form kontak, klik
// kirim WA, buka detail laporan) - TANPA isi teks (privasi), hanya jenis
// aksi. Baris: { t, ip, ev, ua }.
function recordEvent({ ip, ev, ua }) {
  try {
    const ipClean = String(ip || '').replace('::ffff:', '');
    if (!ipClean) return;
    if (!trackDecision(ipClean, Date.now())) return;
    queue.push(
      JSON.stringify({
        t: new Date().toISOString(),
        ip: ipClean,
        ev,
        ua: String(ua || '').slice(0, 90),
      })
    );
  } catch (_e) {
    // abaikan
  }
}

module.exports = { hitLogger, start, stop, recordEvent };
