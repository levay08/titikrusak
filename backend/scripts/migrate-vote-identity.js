#!/usr/bin/env node
// backend/scripts/migrate-vote-identity.js
// Migrasi identitas dukungan & klaim status: IP + SESI WEB (11 Sep 2026).
//
// Langkah (semua idempotent, aman diulang):
//   1. Isi kolom baru dari data lama:
//        votes.voter_ip / voter_session          (dari voter_did lama)
//        status_claims.claimer_ip / claimer_session
//      Baris lama tanpa identitas yang bisa dipulihkan dibiarkan kosong - tetap
//      dihitung sebagai dukungan historis, tapi tidak memblokir siapa pun.
//   2. Buang duplikat yang mungkin ada (satu IP / satu sesi lebih dari sekali
//      pada laporan yang sama) sebelum index unik dibuat.
//   3. Buat index unik: (report_id, voter_ip) & (report_id, voter_session),
//      begitu juga untuk klaim per jenis.
//   4. Hitung ulang angka di kartu dari tabel sumber (votes / status_claims)
//      supaya tidak ada angka yang tidak punya baris bukti.
'use strict';

const db = require('../db/db.js'); // sekaligus menjalankan ALTER kolom baru

function cols(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

const report = {};

// ---- 1) Backfill dari voter_did / claimer_did -------------------------------
function backfill() {
  const voteCols = cols('votes');
  if (voteCols.includes('voter_ip') && voteCols.includes('voter_session')) {
    report.votesIp = db
      .prepare(
        "UPDATE votes SET voter_ip = substr(voter_did, 4) WHERE (voter_ip IS NULL OR voter_ip = '') AND voter_did LIKE 'ip:%'"
      ).run().changes;
    report.votesSess = db
      .prepare(
        "UPDATE votes SET voter_session = substr(voter_did, 6) WHERE voter_session IS NULL AND voter_did LIKE 'sess:%'"
      ).run().changes;
  }
  const claimCols = cols('status_claims');
  if (claimCols.includes('claimer_ip') && claimCols.includes('claimer_session')) {
    report.claimsIp = db
      .prepare(
        "UPDATE status_claims SET claimer_ip = substr(claimer_did, 4) WHERE (claimer_ip IS NULL OR claimer_ip = '') AND claimer_did LIKE 'ip:%'"
      ).run().changes;
    report.claimsSess = db
      .prepare(
        "UPDATE status_claims SET claimer_session = substr(claimer_did, 6) WHERE claimer_session IS NULL AND claimer_did LIKE 'sess:%'"
      ).run().changes;
  }
}

// ---- 2) Buang duplikat identitas -------------------------------------------
function dropDuplicates(table, ipCol, sessCol, kindCol) {
  const removed = { ip: 0, session: 0 };
  const key = kindCol ? `, ${kindCol}` : '';
  const dumpIp = db
    .prepare(
      `SELECT id FROM ${table} WHERE ${ipCol} <> '' AND id NOT IN (
         SELECT MIN(id) FROM ${table} WHERE ${ipCol} <> '' GROUP BY report_id${key}, ${ipCol}
       )`
    )
    .all();
  for (const row of dumpIp) db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
  removed.ip = dumpIp.length;
  const dumpSess = db
    .prepare(
      `SELECT id FROM ${table} WHERE ${sessCol} IS NOT NULL AND id NOT IN (
         SELECT MIN(id) FROM ${table} WHERE ${sessCol} IS NOT NULL GROUP BY report_id${key}, ${sessCol}
       )`
    )
    .all();
  for (const row of dumpSess) db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
  removed.session = dumpSess.length;
  return removed;
}

// ---- 3) Index unik (jaring kedua di level DB) ------------------------------
function createIndexes() {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_votes_report_ip ON votes(report_id, voter_ip) WHERE voter_ip <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS ux_votes_report_session ON votes(report_id, voter_session) WHERE voter_session IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_report_kind_ip ON status_claims(report_id, kind, claimer_ip) WHERE claimer_ip <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_report_kind_session ON status_claims(report_id, kind, claimer_session) WHERE claimer_session IS NOT NULL;
  `);
}

// ---- 4) Hitung ulang angka di kartu ---------------------------------------
function recount() {
  db.exec(`
    UPDATE reports SET vote_count = (SELECT COUNT(*) FROM votes v WHERE v.report_id = reports.id);
    UPDATE reports SET claim_fixed_count = (
      SELECT COUNT(*) FROM status_claims c WHERE c.report_id = reports.id AND c.kind = 'diperbaiki'
    );
    UPDATE reports SET claim_gone_count = (
      SELECT COUNT(*) FROM status_claims c WHERE c.report_id = reports.id AND c.kind = 'hilang'
    );
  `);
}

const run = db.transaction(() => {
  backfill();
  report.dupVotes = dropDuplicates('votes', 'voter_ip', 'voter_session', null);
  report.dupClaims = dropDuplicates('status_claims', 'claimer_ip', 'claimer_session', 'kind');
  createIndexes();
  recount();
});
run();

const nVotes = db.prepare('SELECT COUNT(*) AS n FROM votes').get().n;
const nClaims = db.prepare('SELECT COUNT(*) AS n FROM status_claims').get().n;
const sumVotes = db.prepare('SELECT COALESCE(SUM(vote_count),0) AS n FROM reports').get().n;
const sumFixed = db.prepare('SELECT COALESCE(SUM(claim_fixed_count),0) AS n FROM reports').get().n;
const sumGone = db.prepare('SELECT COALESCE(SUM(claim_gone_count),0) AS n FROM reports').get().n;

console.log('migrasi identitas dukungan (IP + sesi) selesai:');
console.log(`  backfill   : votes ip ${report.votesIp || 0}, votes sesi ${report.votesSess || 0}, klaim ip ${report.claimsIp || 0}, klaim sesi ${report.claimsSess || 0}`);
console.log(`  duplikat   : votes ${report.dupVotes.ip} ip / ${report.dupVotes.session} sesi, klaim ${report.dupClaims.ip} ip / ${report.dupClaims.session} sesi dibuang`);
console.log(`  index unik : dibuat (ip & sesi, vote & klaim)`);
console.log(`  angka kartu: vote ${sumVotes} = baris ${nVotes} | diperbaiki ${sumFixed} | tidak ada ${sumGone} = klaim ${nClaims}`);
const okVotes = sumVotes === nVotes;
const okClaims = sumFixed + sumGone === nClaims;
console.log(okVotes && okClaims ? 'OK: angka kartu konsisten dengan tabel bukti' : 'PERIKSA: angka kartu TIDAK konsisten');
db.close();
process.exit(okVotes && okClaims ? 0 : 1);
