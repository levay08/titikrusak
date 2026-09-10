// frontend/src/lib/notifUnread.test.js
// Kunci perilaku penanda "sudah dilihat" (localStorage) + ambil jumlah dari
// server. Dipakai badge lonceng supaya tetap benar setelah refresh.

import { describe, it, expect, vi } from 'vitest';
import {
  NOTIF_SEEN_KEY,
  NO_UNREAD,
  badgeText,
  fetchUnread,
  readSeen,
  writeSeen,
} from './notifUnread.js';

function storeAwal(isi = null) {
  const data = new Map();
  if (isi !== null) data.set(NOTIF_SEEN_KEY, isi);
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    _dump: () => Object.fromEntries(data),
  };
}

describe('notifUnread: penanda sudah dilihat', () => {
  it('belum pernah dibuka -> penanda kosong, badge tidak menyala', () => {
    const s = storeAwal();
    expect(readSeen(s)).toBe('');
    expect(badgeText(0)).toBe('');
  });

  it('menyimpan & membaca penanda waktu dari server apa adanya', () => {
    const s = storeAwal();
    writeSeen('2026-09-10 13:12:10', s);
    expect(readSeen(s)).toBe('2026-09-10 13:12:10');
    // Format ISO (dari media_repair_at) juga disimpan apa adanya - server
    // yang menormalkan saat membandingkan.
    writeSeen('2026-09-10T13:12:10.000Z', s);
    expect(readSeen(s)).toBe('2026-09-10T13:12:10.000Z');
  });

  it('localStorage rusak/diblokir tidak membuat aplikasi gagal', () => {
    const rusak = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readSeen(rusak)).toBe('');
    expect(() => writeSeen('x', rusak)).not.toThrow();
  });

  it('badgeText: 1-9 -> apa adanya, >9 -> "9+", 0/kosong -> ""', () => {
    expect(badgeText(1)).toBe('1');
    expect(badgeText(9)).toBe('9');
    expect(badgeText(10)).toBe('9+');
    expect(badgeText(120)).toBe('9+');
    expect(badgeText(0)).toBe('');
    expect(badgeText(undefined)).toBe('');
  });
});

describe('notifUnread: ambil jumlah dari server', () => {
  it('mengirim penanda sebagai query since dan mengembalikan angka', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ total: 4, media: 3, activities: 1, comments: 0, latestAt: '2026-09-10 14:00:00' }),
    }));
    const out = await fetchUnread('2026-09-10 13:00:00', fetchMock);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/activity/unread?since=${encodeURIComponent('2026-09-10 13:00:00')}`
    );
    expect(out).toEqual({ total: 4, media: 3, activities: 1, comments: 0, latestAt: '2026-09-10 14:00:00' });
  });

  it('belum pernah dibuka -> tanpa query since (badge tidak menyalakan riwayat)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ...NO_UNREAD, latestAt: '2026-09-10 14:00:00' }),
    }));
    const out = await fetchUnread('', fetchMock);
    expect(fetchMock).toHaveBeenCalledWith('/api/activity/unread');
    expect(out.total).toBe(0);
    expect(out.latestAt).toBe('2026-09-10 14:00:00');
  });

  it('gagal jaringan / respons bukan 200 -> null (badge tidak berubah)', async () => {
    expect(await fetchUnread('x', vi.fn(async () => ({ ok: false, json: async () => ({}) })))).toBeNull();
    expect(
      await fetchUnread('x', vi.fn(async () => { throw new Error('offline'); }))
    ).toBeNull();
  });
});
