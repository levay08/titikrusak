// frontend/src/components/SeedNotice.test.jsx
// Tes tooltip keterangan data: seluruh titik di peta saat ini adalah data
// nyata dari pemberitaan media (bukan laporan warga) — bisa ditutup (✕);
// penutupan tersimpan per sesi tab (sessionStorage) seperti WelcomeModal.

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import SeedNotice from './SeedNotice.jsx';

const FLAG = 'titikrusak_seed_note_closed';

describe('SeedNotice (keterangan data titik dari media)', () => {
  beforeEach(() => {
    sessionStorage.removeItem(FLAG);
  });

  it('menampilkan pesan singkat bahwa titik di peta dari media (bukan laporan warga) + tombol tutup', () => {
    render(<SeedNotice />);
    expect(
      screen.getByText((_c, el) => el.tagName === 'P' && el.textContent.includes('Titik di peta adalah'))
    ).toBeInTheDocument();
    expect(
      screen.getByText((_c, el) => el.tagName === 'P' && el.textContent.includes('bukan laporan warga'))
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /tutup keterangan data titik/i })
    ).toBeInTheDocument();
  });

  it('klik ✕ menutup keterangan dan mencatat ke sessionStorage (tidak muncul lagi di sesi ini)', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SeedNotice />);

    await user.click(screen.getByRole('button', { name: /tutup keterangan data titik/i }));

    expect(
      screen.queryByText((_c, el) => el.tagName === 'P' && el.textContent.includes('Titik di peta adalah'))
    ).not.toBeInTheDocument();
    expect(sessionStorage.getItem(FLAG)).toBe('1');

    // Instance baru di sesi yang sama tetap tersembunyi (flag tersimpan).
    unmount();
    render(<SeedNotice />);
    expect(
      screen.queryByText((_c, el) => el.tagName === 'P' && el.textContent.includes('Titik di peta adalah'))
    ).not.toBeInTheDocument();
  });

  it('tanpa flag tersimpan (sesi baru) keterangan tampil lagi', () => {
    render(<SeedNotice />);
    expect(
      screen.getByText((_c, el) => el.tagName === 'P' && el.textContent.includes('Titik di peta adalah'))
    ).toBeInTheDocument();
  });
});
