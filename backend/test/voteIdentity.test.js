// backend/test/voteIdentity.test.js
// UJI END-TO-END (server sungguhan + HTTP sungguhan) untuk aturan dukungan
// 11 Sep 2026: hitungan dukungan & klaim status HANYA boleh berbasis IP + SESI
// WEB. Satu IP atau satu sesi = sudah mendukung (409), angka tidak pernah
// bertambah dua kali. Dijalankan di DB sementara (TK_DB_PATH) supaya tidak
// menyentuh data pengembangan.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const BACKEND = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'tk-vote-'));
const DB_FILE = path.join(TMP, 'test.db');
const PORT = 3100 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;

let child = null;
let db = null;
let reportId = null;

function waitReady(proc) {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('server tidak siap dalam 15 detik')), 15000);
    proc.stdout.on('data', (buf) => {
      if (String(buf).includes('berjalan di port')) {
        clearTimeout(to);
        resolve();
      }
    });
    proc.stderr.on('data', (buf) => process.stderr.write(`[server] ${buf}`));
    proc.on('exit', (code) => reject(new Error(`server keluar dengan kode ${code}`)));
  });
}

// ip = alamat yang dipalsukan lewat X-Forwarded-For (trust proxy loopback),
// sid = cookie sesi web (tk_sid) yang dikirim kembali seperti browser.
async function call(method, url, { ip, sid, body } = {}) {
  const headers = { 'x-forwarded-for': ip, 'user-agent': 'tk-test' };
  if (sid) headers.cookie = `tk_sid=${sid}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_e) {
    json = null;
  }
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/tk_sid=([a-f0-9]{24})/);
  return { status: res.status, json, sid: m ? m[1] : null };
}

const vote = (ip, sid) => call('POST', `/api/reports/${reportId}/vote`, { ip, sid, body: {} });
const unvote = (ip, sid) => call('DELETE', `/api/reports/${reportId}/vote`, { ip, sid });
const claims = (ip, sid) => call('GET', `/api/reports/${reportId}/claims`, { ip, sid });
const claim = (ip, sid, kind) => call('POST', `/api/reports/${reportId}/claim`, { ip, sid, body: { kind } });
const unclaim = (ip, sid, kind) => call('DELETE', `/api/reports/${reportId}/claim?kind=${kind}`, { ip, sid });

function dbRow() {
  return db.prepare('SELECT vote_count, claim_fixed_count, claim_gone_count FROM reports WHERE id = ?').get(reportId);
}
function voteRows() {
  return db.prepare('SELECT voter_ip, voter_session FROM votes WHERE report_id = ? ORDER BY id').all(reportId);
}

before(async () => {
  child = spawn(process.execPath, ['server.js'], {
    cwd: BACKEND,
    env: { ...process.env, PORT: String(PORT), TK_DB_PATH: DB_FILE, TK_HITS_DIR: path.join(TMP, 'hits') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitReady(child);
  db = new Database(DB_FILE);
  db.pragma('journal_mode = WAL');
  const info = db
    .prepare(
      `INSERT INTO reports (infra_type, severity, bridge_authority, vital_status, description,
        location_name, lat, lng, source_type, status)
       VALUES ('jembatan', 'ambruk', 'tidak_diketahui', '["akses_ekonomi"]', 'uji dukungan IP + sesi',
        'Jembatan Uji, Kabupaten Landak', 0.5, 109.3, 'warga', 'dilaporkan')`
    )
    .run();
  reportId = Number(info.lastInsertRowid);
});

after(async () => {
  try {
    if (db) db.close();
  } catch (_e) {
    /* abaikan */
  }
  if (child) child.kill('SIGKILL');
  fs.rmSync(TMP, { recursive: true, force: true });
});

test('dukungan pertama dari sebuah IP berhasil; orang lain (IP lain, sesi lain) juga boleh', async () => {
  const first = await vote('10.0.0.1');
  assert.equal(first.status, 201, JSON.stringify(first.json));
  assert.equal(first.json.vote_count, 1);
  assert.ok(first.sid, 'server harus memberi cookie sesi web (tk_sid)');
  assert.equal(dbRow().vote_count, 1);

  // IP & sesi sama persis -> DITOLAK, angka tidak bertambah.
  const dup = await vote('10.0.0.1', first.sid);
  assert.equal(dup.status, 409, JSON.stringify(dup.json));
  assert.match(dup.json.error, /sudah didukung/i);
  assert.equal(dbRow().vote_count, 1);

  // IP lain, SESI sama -> tetap DITOLAK (sesi jadi penentu).
  const otherIpSameSession = await vote('10.0.0.2', first.sid);
  assert.equal(otherIpSameSession.status, 409);
  assert.equal(dbRow().vote_count, 1);

  // IP lain + sesi lain -> dukungan kedua yang sah.
  const second = await vote('10.0.0.2');
  assert.equal(second.status, 201, JSON.stringify(second.json));
  assert.equal(second.json.vote_count, 2);
  assert.equal(dbRow().vote_count, 2);
  assert.equal(voteRows().length, 2, 'dua baris vote, satu per identitas');
});

test('angka vote selalu sama dengan jumlah baris bukti (tidak bisa digelembungkan)', async () => {
  for (let i = 0; i < 5; i += 1) {
    const r = await vote('10.0.0.1');
    assert.equal(r.status, 409, 'percobaan berulang dari IP/sesi yang sama harus ditolak');
  }
  const rows = voteRows();
  assert.equal(dbRow().vote_count, rows.length);
  assert.equal(rows.length, 2);
});

test('GET /claims memberi tahu tombol "Dukung laporan" sudah menyala atau belum (per IP & sesi)', async () => {
  const mine = await claims('10.0.0.1');
  assert.equal(mine.json.voted, true, 'IP yang sudah mendukung harus tampil menyala');
  assert.deepEqual(mine.json.counts, { diperbaiki: 0, hilang: 0 });
  // sesi baru dari IP yang sudah mendukung: tetap dianggap sudah (penentu IP).
  const sameIpNewSession = await claims('10.0.0.1', 'aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(sameIpNewSession.json.voted, true);
  const fresh = await claims('10.9.9.9');
  assert.equal(fresh.json.voted, false);
});

test('batalkan dukungan (unlike) hanya untuk IP/sesi pemiliknya', async () => {
  const notMine = await unvote('10.7.7.7');
  assert.equal(notMine.status, 404);
  const ok = await unvote('10.0.0.2');
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.vote_count, 1);
  assert.equal(dbRow().vote_count, 1);
  assert.equal(voteRows().length, 1);
});

test('klaim status lapangan memakai aturan identitas yang sama (IP + sesi)', async () => {
  const first = await claim('10.0.0.1', undefined, 'diperbaiki');
  assert.equal(first.status, 201, JSON.stringify(first.json));
  assert.equal(first.json.counts.diperbaiki, 1);
  assert.deepEqual(first.json.mine, ['diperbaiki']);

  const dupSameIp = await claim('10.0.0.1', first.sid, 'diperbaiki');
  assert.equal(dupSameIp.status, 409, 'IP sama tidak boleh menambah klaim kedua');

  const dupSameSession = await claim('10.0.0.5', first.sid, 'diperbaiki');
  assert.equal(dupSameSession.status, 409, 'sesi sama tidak boleh menambah klaim kedua');

  // IP lain + sesi lain: klaim sah untuk jenis yang lain... tapi terkunci
  // karena titik sudah ditandai "sudah diperbaiki".
  const lawan = await claim('10.0.0.5', undefined, 'hilang');
  assert.equal(lawan.status, 409);
  assert.equal(dbRow().claim_fixed_count, 1);
  assert.equal(dbRow().claim_gone_count, 0);

  const mine = await claims('10.0.0.1');
  assert.deepEqual(mine.json.mine, ['diperbaiki']);
  assert.equal(mine.json.counts.diperbaiki, 1);
});

test('klaim bisa dibatalkan pemiliknya saja, lalu status lain bisa dipilih', async () => {
  const notMine = await unclaim('10.7.7.7', undefined, 'diperbaiki');
  assert.equal(notMine.status, 404);

  const off = await unclaim('10.0.0.1', undefined, 'diperbaiki');
  assert.equal(off.status, 200, JSON.stringify(off.json));
  assert.deepEqual(off.json.counts, { diperbaiki: 0, hilang: 0 });

  const gone = await claim('10.0.0.3', undefined, 'hilang');
  assert.equal(gone.status, 201, JSON.stringify(gone.json));
  assert.equal(gone.json.counts.hilang, 1);
  assert.equal(dbRow().claim_gone_count, 1);
  assert.equal(dbRow().claim_fixed_count, 0);
});

test('index unik di DB menolak duplikat walau lewat jalur lain', () => {
  const ipRows = voteRows();
  const sameIpTwice = ipRows.filter((r) => r.voter_ip === '10.0.0.1').length;
  assert.equal(sameIpTwice, 1, 'satu IP hanya satu baris per laporan');
  assert.ok(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'ux_votes_report_ip'").get(),
    'index unik IP harus ada'
  );
  assert.ok(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'ux_claims_report_kind_session'").get(),
    'index unik sesi klaim harus ada'
  );
  assert.throws(
    () =>
      db
        .prepare('INSERT INTO votes (report_id, voter_did, voter_ip, voter_session) VALUES (?, ?, ?, ?)')
        .run(reportId, 'sess:duplikat', '10.0.0.1', 'aaaaaaaaaaaaaaaaaaaaaaaa'),
    /UNIQUE/i
  );
});
