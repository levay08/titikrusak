'use strict';

// backend/test/seedWindow.test.js
// Kunci perilaku jendela seed media (aturan produk 10 Sep 2026): titik dari
// pemberitaan hanya untuk rentang Januari 2026 - September 2026.

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inSeedWindow,
  SEED_MIN_DATE,
  SEED_MAX_DATE,
} = require('../services/newsMonitor.js');

test('batas jendela: 1 Jan 2026 s.d. akhir Sep 2026', () => {
  assert.equal(SEED_MIN_DATE, '2026-01-01');
  assert.equal(SEED_MAX_DATE, '2026-09-30');
});

test('inSeedWindow: di dalam rentang diterima', () => {
  assert.equal(inSeedWindow('2026-01-01'), true);
  assert.equal(inSeedWindow('2026-02-14'), true);
  assert.equal(inSeedWindow('2026-08-30'), true);
  assert.equal(inSeedWindow('2026-09-10'), true);
});

test('inSeedWindow: sebelum 2026 ditolak', () => {
  assert.equal(inSeedWindow('2025-12-31'), false);
  assert.equal(inSeedWindow('2025-12-02'), false);
  assert.equal(inSeedWindow('2025-04-01'), false);
});

test('inSeedWindow: setelah September 2026 ditolak', () => {
  assert.equal(inSeedWindow('2026-10-01'), false);
  assert.equal(inSeedWindow('2026-12-31'), false);
});

test('inSeedWindow: tanggal ISO panjang & kosong ditangani', () => {
  // newsClient mengirim ISO ('2026-08-15T00:00:00.000Z')
  assert.equal(inSeedWindow('2026-08-15T00:00:00.000Z'), true);
  assert.equal(inSeedWindow('2025-12-02T10:00:00.000Z'), false);
  assert.equal(inSeedWindow(''), false);
  assert.equal(inSeedWindow(null), false);
  assert.equal(inSeedWindow(undefined), false);
});
