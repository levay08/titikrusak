// frontend/src/components/DetailModal.test.jsx
// Tes foto laporan: klik foto membuka FRAME (lightbox dalam situs — bukan
// tab baru, tidak menutup layar penuh) dan bisa ditutup via tombol ✕.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import DetailModal from './DetailModal.jsx';

const REPORT = {
  id: 1,
  location_name: 'Jembatan Cibeureum, Garut',
  status: 'dilaporkan',
  infra_type: 'jembatan',
  severity: 'berat',
  photo_urls: ['https://example.com/foto-laporan.jpg'],
  created_at: '2025-11-01 00:00:00',
};

describe('DetailModal: foto dalam frame (lightbox)', () => {
  it('klik foto membuka frame foto (bukan tab baru) dan bisa ditutup', async () => {
    const user = userEvent.setup();
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    // Thumbnail foto ada (bukan link keluar — tombol).
    const thumb = screen.getByRole('button', { name: /Lihat foto laporan lebih besar/ });
    expect(thumb).toBeInTheDocument();

    await user.click(thumb);

    // Frame foto terbuka: foto besar + tombol tutup ✕.
    expect(screen.getByRole('button', { name: 'Tutup foto' })).toBeInTheDocument();
    expect(screen.getByAltText('Foto laporan (besar)')).toBeInTheDocument();

    // Tutup frame — foto menghilang.
    await user.click(screen.getByRole('button', { name: 'Tutup foto' }));
    expect(screen.queryByRole('button', { name: 'Tutup foto' })).not.toBeInTheDocument();
    expect(screen.queryByAltText('Foto laporan (besar)')).not.toBeInTheDocument();
  });
});
