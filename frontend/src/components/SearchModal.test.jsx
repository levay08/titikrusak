// frontend/src/components/SearchModal.test.jsx
// Tes modal hasil pencarian header (poin: tagline -> search bar):
//   - hasil sesuai kata kunci (mis. "Depok" cocok dengan nama lokasi);
//   - kata kunci tanpa kecocokan -> modal "tidak ada hasil";
//   - klik hasil memanggil onOpenReport (membuka DetailModal laporan);
//   - initialQuery dari search bar header mengisi input otomatis.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import SearchModal from './SearchModal.jsx';

const REPORTS = [
  {
    id: 1,
    location_name: 'Jembatan Penghubung Depok–Bogor, Sukmajaya (Jawa Barat)',
    description: 'Jembatan putus akibat banjir.',
    infra_type: 'jembatan',
    severity: 'ambruk',
    status: 'dilaporkan',
    source_media_name: 'detikJabar',
    created_at: '2025-11-01T00:00:00Z',
  },
  {
    id: 2,
    location_name: 'Jalan Raya Cianjur (Jawa Barat)',
    description: 'Longsor menutup badan jalan.',
    infra_type: 'jalan',
    severity: 'berat',
    status: 'terverifikasi',
    created_at: '2025-10-01T00:00:00Z',
  },
];

describe('SearchModal: hasil pencarian kata kunci', () => {
  it('menampilkan hanya laporan yang cocok dengan kata kunci lokasi (mis. Depok)', async () => {
    const user = userEvent.setup();
    render(<SearchModal reports={REPORTS} onClose={vi.fn()} onOpenReport={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), 'Depok');

    expect(screen.getByText(/Jembatan Penghubung Depok–Bogor/)).toBeInTheDocument();
    expect(screen.queryByText(/Jalan Raya Cianjur/)).not.toBeInTheDocument();
    expect(screen.getByText(/1 titik ditemukan/)).toBeInTheDocument();
  });

  it('menampilkan "Tidak ada hasil" saat kata kunci tidak cocok dengan apa pun', async () => {
    const user = userEvent.setup();
    render(<SearchModal reports={REPORTS} onClose={vi.fn()} onOpenReport={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), 'zxyz-tidak-ada');

    expect(screen.getByText(/Tidak ada hasil untuk/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Jembatan Penghubung Depok/ })).not.toBeInTheDocument();
  });

  it('klik hasil memanggil onOpenReport dengan laporan tersebut', async () => {
    const user = userEvent.setup();
    const onOpenReport = vi.fn();
    render(<SearchModal reports={REPORTS} onClose={vi.fn()} onOpenReport={onOpenReport} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), 'Depok');
    await user.click(screen.getByText(/Jembatan Penghubung Depok–Bogor/));

    expect(onOpenReport).toHaveBeenCalledTimes(1);
    expect(onOpenReport).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('initialQuery dari search bar header mengisi input pencarian otomatis', () => {
    render(
      <SearchModal reports={REPORTS} initialQuery="Cianjur" onClose={vi.fn()} onOpenReport={vi.fn()} />
    );

    expect(screen.getByPlaceholderText(/kata kunci/i)).toHaveValue('Cianjur');
    expect(screen.getByText(/Jalan Raya Cianjur/)).toBeInTheDocument();
  });
});
