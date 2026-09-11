'use strict';

// backend/lib/voteIdentity.js
// Identitas dukungan (vote) & klaim status lapangan: IP + SESI WEB.
//
// Aturan (11 Sep 2026, permintaan langsung): hitungan dukungan HANYA boleh
// berbasis dua parameter ini. Satu orang dianggap SUDAH mendukung bila
// IP-nya sama ATAU sesinya sama - dua-duanya penentu, sehingga tidak ada
// duplikasi/kejahilan menambah jumlah vote:
//   - IP      : alamat asli pengunjung (trust proxy 'loopback' di server.js);
//   - SESI    : identitas e.id terverifikasi (holder_did) bila ada, selain itu
//               id sesi web anonim dari cookie HttpOnly `tk_sid` (dibuat
//               server saat pertama kali dibutuhkan) - jadi orang yang sama
//               tetap terdeteksi walau IP-nya berubah (pindah jaringan/HP).
//
// Modul ini pemilik SATU-SATUNYA logika hitung/cek vote & klaim: route hanya
// memanggil fungsi di sini (jangan menduplikasi pemeriksaan di route).

const crypto = require('crypto');
const db = require('../db/db.js');

const COOKIE_NAME = 'tk_sid';
const SESSION_ID_RE = /^[a-f0-9]{24}$/;

function parseCookies(header) {
  const out = {};
  String(header || '')
    .split(';')
    .forEach((part) => {
      const i = part.indexOf('=');
      if (i < 1) return;
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    });
  return out;
}

// IP asli pengunjung (buang awalan IPv4-mapped IPv6).
function clientIp(req) {
  const raw = String((req && req.ip) || '').replace(/^::ffff:/, '').trim();
  return raw || 'unknown';
}

// holder_did sesi e.id yang benar-benar approved di server (bukan klaim klien).
function eidHolderDid(req) {
  const sessionId = (req && req.get && req.get('x-eid-session')) || '';
  if (!sessionId) return null;
  const row = db
    .prepare("SELECT holder_did FROM verification_sessions WHERE session_id = ? AND status = 'approved'")
    .get(sessionId);
  return (row && row.holder_did) || null;
}

// Sesi web anonim: id acak yang dibuat server dan disimpan di cookie HttpOnly
// (tidak bisa dibaca/dipalsukan lewat localStorage).
function webSessionId(req, res) {
  if (req.tkSid) return req.tkSid;
  const jar = parseCookies(req.headers && req.headers.cookie);
  let sid = jar[COOKIE_NAME];
  if (!SESSION_ID_RE.test(sid || '')) {
    sid = crypto.randomBytes(12).toString('hex');
    if (res && typeof res.append === 'function') {
      res.append(
        'Set-Cookie',
        `${COOKIE_NAME}=${sid}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax`
      );
    }
  }
  req.tkSid = sid;
  return sid;
}

// { ip, session, viaEid } - dua parameter penentu dukungan.
function voterIdentity(req, res) {
  const ip = clientIp(req);
  const did = eidHolderDid(req);
  return { ip, session: did || webSessionId(req, res), viaEid: Boolean(did) };
}

// ---- DUKUNGAN (dukung laporan) --------------------------------------------

const VOTE_DUP_ERROR = 'Laporan ini sudah didukung dari IP atau sesi ini';

// Sudah mendukung? true bila IP ATAU sesi ini sudah punya baris vote.
function hasVoted(reportId, idn) {
  return Boolean(
    db
      .prepare(
        `SELECT id FROM votes
          WHERE report_id = ?
            AND ((voter_ip <> '' AND voter_ip = ?)
              OR (voter_session IS NOT NULL AND voter_session = ?))
          LIMIT 1`
      )
      .get(reportId, idn.ip, idn.session)
  );
}

function voteCountOf(reportId) {
  const r = db.prepare('SELECT COUNT(*) AS n FROM votes WHERE report_id = ?').get(reportId);
  return r ? r.n : 0;
}

// Tambah dukungan. Mengembalikan { ok:false, code:409 } bila IP/sesi sudah
// mendukung (duplikat ditolak, angka tidak pernah bertambah dua kali).
function castVote(reportId, idn) {
  if (hasVoted(reportId, idn)) {
    return { ok: false, code: 409, error: VOTE_DUP_ERROR };
  }
  db.transaction(() => {
    db.prepare('INSERT INTO votes (report_id, voter_did, voter_ip, voter_session) VALUES (?, ?, ?, ?)').run(
      reportId,
      `sess:${idn.session}`,
      idn.ip,
      idn.session
    );
    // Angka di kartu = jumlah baris vote yang sah (tidak pernah dihitung ganda).
    db.prepare('UPDATE reports SET vote_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      voteCountOf(reportId),
      reportId
    );
  })();
  return { ok: true, vote_count: voteCountOf(reportId) };
}

// Batalkan dukungan milik IP/sesi ini.
function removeVote(reportId, idn) {
  const row = db
    .prepare(
      `SELECT id FROM votes
        WHERE report_id = ?
          AND ((voter_ip <> '' AND voter_ip = ?)
            OR (voter_session IS NOT NULL AND voter_session = ?))
        ORDER BY id LIMIT 1`
    )
    .get(reportId, idn.ip, idn.session);
  if (!row) return { ok: false, code: 404, error: 'Dukungan tidak ditemukan' };
  db.transaction(() => {
    db.prepare('DELETE FROM votes WHERE id = ?').run(row.id);
    db.prepare('UPDATE reports SET vote_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      voteCountOf(reportId),
      reportId
    );
  })();
  return { ok: true, vote_count: voteCountOf(reportId) };
}

// ---- KLAIM STATUS LAPANGAN (diperbaiki / hilang) --------------------------

const CLAIM_KINDS = ['diperbaiki', 'hilang'];

function claimCounts(reportId) {
  const r =
    db.prepare('SELECT claim_fixed_count, claim_gone_count FROM reports WHERE id = ?').get(reportId) || {};
  return { diperbaiki: r.claim_fixed_count || 0, hilang: r.claim_gone_count || 0 };
}

// Jenis klaim yang sudah dilakukan IP/sesi ini (untuk tombol menyala/uncheck).
function myClaims(reportId, idn) {
  const rows = db
    .prepare(
      `SELECT kind FROM status_claims
        WHERE report_id = ?
          AND ((claimer_ip <> '' AND claimer_ip = ?)
            OR (claimer_session IS NOT NULL AND claimer_session = ?))`
    )
    .all(reportId, idn.ip, idn.session);
  return [...new Set(rows.map((r) => r.kind))];
}

function countClaims(reportId, kind) {
  const r = db
    .prepare('SELECT COUNT(*) AS n FROM status_claims WHERE report_id = ? AND kind = ?')
    .get(reportId, kind);
  return r ? r.n : 0;
}

function syncClaimCounts(reportId) {
  db.prepare(
    `UPDATE reports SET claim_fixed_count = ?, claim_gone_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(countClaims(reportId, 'diperbaiki'), countClaims(reportId, 'hilang'), reportId);
}

// Tandai status oleh warga. Saling mengunci: titik tidak mungkin sekaligus
// "sudah diperbaiki" dan "sudah tidak ada".
function claimStatus(reportId, kind, idn) {
  if (!CLAIM_KINDS.includes(kind)) {
    return { ok: false, code: 400, error: `kind harus salah satu dari: ${CLAIM_KINDS.join(', ')}` };
  }
  const other = kind === 'diperbaiki' ? 'hilang' : 'diperbaiki';
  const otherCount = countClaims(reportId, other);
  if (otherCount > 0) {
    const label = other === 'diperbaiki' ? 'sudah diperbaiki' : 'objek tidak ada';
    return {
      ok: false,
      code: 409,
      error: `Titik ini sudah ditandai "${label}". Batalkan dulu supaya bisa memilih status yang lain.`,
      conflict: other,
    };
  }
  const dup = db
    .prepare(
      `SELECT id FROM status_claims
        WHERE report_id = ? AND kind = ?
          AND ((claimer_ip <> '' AND claimer_ip = ?)
            OR (claimer_session IS NOT NULL AND claimer_session = ?))
        LIMIT 1`
    )
    .get(reportId, kind, idn.ip, idn.session);
  if (dup) {
    return { ok: false, code: 409, error: 'Anda sudah melaporkan status ini untuk titik tersebut' };
  }
  db.transaction(() => {
    db.prepare(
      'INSERT INTO status_claims (report_id, kind, claimer_did, claimer_ip, claimer_session) VALUES (?, ?, ?, ?, ?)'
    ).run(reportId, kind, `sess:${idn.session}`, idn.ip, idn.session);
    syncClaimCounts(reportId);
  })();
  return { ok: true };
}

function unclaimStatus(reportId, kind, idn) {
  if (!CLAIM_KINDS.includes(kind)) {
    return { ok: false, code: 400, error: `kind harus salah satu dari: ${CLAIM_KINDS.join(', ')}` };
  }
  const row = db
    .prepare(
      `SELECT id FROM status_claims
        WHERE report_id = ? AND kind = ?
          AND ((claimer_ip <> '' AND claimer_ip = ?)
            OR (claimer_session IS NOT NULL AND claimer_session = ?))
        ORDER BY id LIMIT 1`
    )
    .get(reportId, kind, idn.ip, idn.session);
  if (!row) return { ok: false, code: 404, error: 'Klaim tidak ditemukan' };
  db.transaction(() => {
    db.prepare('DELETE FROM status_claims WHERE id = ?').run(row.id);
    syncClaimCounts(reportId);
  })();
  return { ok: true };
}

module.exports = {
  COOKIE_NAME,
  clientIp,
  voterIdentity,
  hasVoted,
  castVote,
  removeVote,
  voteCountOf,
  claimCounts,
  myClaims,
  claimStatus,
  unclaimStatus,
  CLAIM_KINDS,
  VOTE_DUP_ERROR,
};
