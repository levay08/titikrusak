// frontend/src/components/DetailModal.test.jsx
// Tes foto laporan: klik foto membuka FRAME (lightbox dalam situs - bukan
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

    // Thumbnail foto ada (bukan link keluar - tombol).
    const thumb = screen.getByRole('button', { name: /Lihat foto laporan lebih besar/ });
    expect(thumb).toBeInTheDocument();

    await user.click(thumb);

    // Frame foto terbuka: foto besar + tombol tutup ✕.
    expect(screen.getByRole('button', { name: 'Tutup foto' })).toBeInTheDocument();
    expect(screen.getByAltText('Foto laporan (besar)')).toBeInTheDocument();

    // Tutup frame - foto menghilang.
    await user.click(screen.getByRole('button', { name: 'Tutup foto' }));
    expect(screen.queryByRole('button', { name: 'Tutup foto' })).not.toBeInTheDocument();
    expect(screen.queryByAltText('Foto laporan (besar)')).not.toBeInTheDocument();
  });
});

describe('DetailModal: info perbaikan dari media pada titik hijau (klaim media)', () => {
  const CLAIM_URL = 'https://berita.example/diperbaiki';

  it('status masih dilaporkan + klaim media: kartu menunggu validasi + SUMBER berita penguat (media, tanggal, tautan)', () => {
    render(
      <DetailModal
        report={{
          ...REPORT,
          status: 'dilaporkan',
          media_repair_url: CLAIM_URL,
          source_media_name: 'Antara News',
          source_media_date: '2026-09-02',
        }}
        onClose={vi.fn()}
        onReportUpdated={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Menurut media sudah diperbaiki \(menunggu validasi otoritas\)/i)
    ).toBeInTheDocument();
    // Laporan penguat perbaikan: nama media + tanggal artikel tertulis jelas
    // (nama media juga tampil di baris field "Nama Media" -> getAllByText).
    expect(screen.getAllByText(/Antara News/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/· 2 Sep 2026/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /baca beritanya/i });
    expect(link).toHaveAttribute('href', CLAIM_URL);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('status selesai_diperbaiki (hijau ✓): kartu konfirmasi otoritas, TANPA teks "menunggu" yang basi', () => {
    render(
      <DetailModal
        report={{
          ...REPORT,
          status: 'selesai_diperbaiki',
          media_repair_url: CLAIM_URL,
          source_media_name: 'Antara News',
          source_media_date: '2026-09-02',
          validated_by_display_name: 'Dinas PU Garut',
        }}
        onClose={vi.fn()}
        onReportUpdated={vi.fn()}
      />
    );

    expect(
      screen.getByText(/Sudah diperbaiki menurut media \(dikonfirmasi otoritas\)/i)
    ).toBeInTheDocument();
    // Bug lama: teks "menunggu verifikasi" tidak boleh muncul untuk status selesai.
    expect(screen.queryByText(/menunggu validasi/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baca beritanya/i })).toHaveAttribute('href', CLAIM_URL);
    expect(screen.getAllByText(/Antara News/).length).toBeGreaterThanOrEqual(1);
  });

  it('tanpa klaim media: tidak ada kartu "Baca beritanya"', () => {
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);
    expect(screen.queryByRole('link', { name: /baca beritanya/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/menurut media sudah diperbaiki/i)).not.toBeInTheDocument();
  });

  it('titik ditolak otoritas (unverifiable): klaim media lama tidak ditampilkan sebagai perbaikan', () => {
    render(
      <DetailModal
        report={{
          ...REPORT,
          status: 'dilaporkan',
          unverifiable: 1,
          media_repair_url: CLAIM_URL,
        }}
        onClose={vi.fn()}
        onReportUpdated={vi.fn()}
      />
    );
    expect(screen.queryByRole('link', { name: /baca beritanya/i })).not.toBeInTheDocument();
  });
});
