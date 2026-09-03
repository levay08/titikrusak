// frontend/src/components/ShareButtons.test.jsx
// Tautan bagikan laporan harus menuju DETAIL titik (deep link
// ".../?laporan=<id>"), bukan sekadar beranda.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ShareButtons from './ShareButtons.jsx';

describe('ShareButtons: tautan menuju detail titik', () => {
  it('semua tombol bagikan memakai URL yang memuat ?laporan=<id>', () => {
    render(<ShareButtons report={{ id: 7, location_name: 'Jembatan Uji' }} />);

    // URL yang dibagikan = .../?laporan=7 (bukan hanya beranda).
    for (const name of [/facebook/i, /ke X/i, /whatsapp/i, /telegram/i]) {
      expect(screen.getByRole('link', { name })).toHaveAttribute(
        'href',
        expect.stringContaining('laporan%3D7')
      );
    }

    // Pratinjau pesan juga menyebut tautan detail.
    expect(screen.getByText(/Bagikan laporan titik rusak ini: Jembatan Uji/)).toBeInTheDocument();
    expect(screen.getByText(/\?laporan=7/)).toBeInTheDocument();
  });

  it('laporan tanpa id -> tetap memakai alamat utama (tidak error)', () => {
    render(<ShareButtons report={{ location_name: 'Tanpa ID' }} />);
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute('href');
  });
});
