'use strict';

// backend/test/notifUnread.test.js
// Kunci perilaku hitungan notifikasi BELUM DIBACA (lonceng header):
// apa yang dihitung, apa yang TIDAK, dan bagaimana campur format waktu
// (created_at 'YYYY-MM-DD HH:MM:SS' vs media_repair_at ISO 'Z') ditangani.

const test = require('node:test');
const assert = require('node:assert/strict');
const { norm, isAfter, countUnread, latestAt } = require('../services/notifUnread.js');

test('norm: menyamakan format DB biasa dan ISO-Z', () => {
  assert.equal(norm('2026-09-10 13:12:10'), '2026-09-10 13:12:10');
  assert.equal(norm('2026-09-10T13:12:10.000Z'), '2026-09-10 13:12:10');
  assert.equal(norm('2026-09-10 20:12:10+07:00'), '2026-09-10 13:12:10');
  assert.equal(norm(''), '');
  assert.equal(norm(null), '');
});

test('isAfter: kunjungan pertama (since kosong) tidak dianggap baru', () => {
  assert.equal(isAfter('2026-09-10 13:12:10', ''), false);
  assert.equal(isAfter('2026-09-10 13:12:10', '2026-09-10 13:12:09'), true);
  assert.equal(isAfter('2026-09-10 13:12:10', '2026-09-10 13:12:10'), false);
});

test('isAfter: campur format tetap benar (ISO-Z dibanding string DB)', () => {
  // media_repair_at ISO-Z 13:00Z vs penanda DB 12:00 (UTC) -> lebih baru.
  assert.equal(isAfter('2026-09-10T13:00:00.000Z', '2026-09-10 12:00:00'), true);
  assert.equal(isAfter('2026-09-10T11:00:00.000Z', '2026-09-10 12:00:00'), false);
});

test('countUnread: kabar media baru/update/perbaikan dihitung, "tercatat" tidak', () => {
  const feed = {
    mediaEvents: [
      { kind: 'baru', at: '2026-09-10 14:00:00' },
      { kind: 'update', at: '2026-09-10 13:59:00' },
      { kind: 'perbaikan', at: '2026-01-12T00:00:00.000Z' }, // tua -> tidak
      { kind: 'tercatat', at: '2026-09-10 13:58:00' }, // bukan kejadian baru
    ],
    activities: [{ type: 'report_created', at: '2026-09-10 13:30:00' }],
  };
  const c = countUnread(feed, 0, '2026-09-10 12:00:00');
  assert.deepEqual(c, { media: 2, activities: 1, comments: 0, total: 3 });
});

test('countUnread: aktivitas & komentar ikut dihitung bila lebih baru', () => {
  const feed = {
    mediaEvents: [],
    activities: [
      { type: 'status_changed', at: '2026-09-10 13:50:00' },
      { type: 'report_created', at: '2026-09-10 11:00:00' }, // lebih tua
    ],
  };
  const c = countUnread(feed, 2, '2026-09-10 12:00:00');
  assert.deepEqual(c, { media: 0, activities: 1, comments: 2, total: 3 });
});

test('countUnread: kunjungan pertama (since kosong) -> semua 0', () => {
  const feed = {
    mediaEvents: [{ kind: 'update', at: '2026-09-10 14:00:00' }],
    activities: [{ type: 'report_created', at: '2026-09-10 14:10:00' }],
  };
  assert.deepEqual(countUnread(feed, 5, ''), {
    media: 0,
    activities: 0,
    comments: 0,
    total: 0,
  });
});

test('latestAt: mengambil waktu terbaru lintas tabel & format', () => {
  const newest = latestAt({
    reports: [
      { created_at: '2026-09-10 13:12:10', updated_at: '2026-09-10 13:12:10', media_repair_at: null },
      { created_at: '2026-09-01 08:00:00', updated_at: '2026-09-01 08:00:00', media_repair_at: '2026-09-09T10:00:00.000Z' },
    ],
    statuses: [{ changed_at: '2026-09-08 14:03:13' }],
    comments: [],
  });
  assert.equal(newest, '2026-09-10 13:12:10');
});

test('latestAt: tanpa data -> string kosong (klien simpan apa adanya)', () => {
  assert.equal(latestAt({}), '');
});
