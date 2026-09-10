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
      screen.getByText(/Diberitakan sudah diperbaiki \(menunggu validasi otoritas\)/i)
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
      screen.getByText(/Diberitakan sudah diperbaiki \(dikonfirmasi otoritas\)/i)
    ).toBeInTheDocument();
    // Bug lama: teks "menunggu verifikasi" tidak boleh muncul untuk status selesai.
    expect(screen.queryByText(/menunggu validasi/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baca beritanya/i })).toHaveAttribute('href', CLAIM_URL);
    expect(screen.getAllByText(/Antara News/).length).toBeGreaterThanOrEqual(1);
  });

  it('status selesai_diperbaiki dari PEMBERITAAN MEDIA (validated_by_display_name null): tidak menyebut konfirmasi/verifikasi otoritas', () => {
    render(
      <DetailModal
        report={{
          ...REPORT,
          status: 'selesai_diperbaiki',
          media_repair_url: CLAIM_URL,
          source_media_name: 'Antara News',
          source_media_date: '2026-09-02',
          validated_by_display_name: null,
        }}
        onClose={vi.fn()}
        onReportUpdated={vi.fn()}
      />
    );

    // Judul jujur: selesai DARI PEMBERITAAN, bukan konfirmasi otoritas.
    expect(
      screen.getByText('✓ Diberitakan sudah diperbaiki (dari pemberitaan media)')
    ).toBeInTheDocument();
    expect(screen.queryByText(/dikonfirmasi otoritas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/otoritas telah mengonfirmasi/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /baca beritanya/i })).toHaveAttribute('href', CLAIM_URL);
  });

  it('tanpa klaim media: tidak ada kartu "Baca beritanya"', () => {
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);
    expect(screen.queryByRole('link', { name: /baca beritanya/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/diberitakan sudah diperbaiki/i)).not.toBeInTheDocument();
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

describe('DetailModal: klaim status lapangan warga (bintang = sudah diperbaiki, ∅ = titik hilang)', () => {
  // Stub fetch: GET /claims mengembalikan hitungan + klaim milik user;
  // POST/DELETE /claim mengubah hitungan (seperti backend).
  const mockClaims = ({ counts = { diperbaiki: 2, hilang: 1 }, mine = [] } = {}) => {
    const state = { counts: { ...counts }, mine: [...mine] };
    const fn = vi.fn((url, init) => {
      const u = String(url);
      if (u.endsWith('/claims')) {
        return Promise.resolve({ ok: true, json: async () => ({ counts: state.counts, mine: state.mine }) });
      }
      if (u.includes('/claim')) {
        const kind =
          u.includes('hilang') || (init && String(init.body || '').includes('hilang')) ? 'hilang' : 'diperbaiki';
        const off = Boolean(init && init.method === 'DELETE');
        state.mine = off ? state.mine.filter((k) => k !== kind) : [...new Set([...state.mine, kind])];
        state.counts[kind] = Math.max(0, state.counts[kind] + (off ? -1 : 1));
        return Promise.resolve({ ok: true, json: async () => ({ counts: state.counts, mine: state.mine }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('menampilkan hitungan warga + tombol bintang/∅ (mode batalkan bila sudah dilaporkan)', async () => {
    mockClaims({ counts: { diperbaiki: 2, hilang: 1 }, mine: ['diperbaiki'] });
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    expect(await screen.findByText(/2 warga melaporkan titik sudah diperbaiki/)).toBeInTheDocument();
    expect(screen.getByText(/1 warga melaporkan titik sudah tidak ada/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Batalkan laporan titik sudah diperbaiki' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Laporkan titik sudah tidak ada' })).toBeInTheDocument();
  });

  it('klik bintang -> POST klaim; klik lagi -> DELETE (uncheck), hitungan naik/turun', async () => {
    const fetchMock = mockClaims({ counts: { diperbaiki: 0, hilang: 0 }, mine: [] });
    const user = userEvent.setup();
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Laporkan titik sudah diperbaiki' }));
    const post = fetchMock.mock.calls.find(
      ([u, i]) => String(u).includes('/claim') && i && i.method === 'POST'
    );
    expect(post).toBeTruthy();
    expect(JSON.parse(post[1].body)).toEqual({ kind: 'diperbaiki' });
    expect(await screen.findByText(/1 warga melaporkan titik sudah diperbaiki/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Batalkan laporan titik sudah diperbaiki' }));
    const del = fetchMock.mock.calls.find(
      ([u, i]) => String(u).includes('/claim') && i && i.method === 'DELETE'
    );
    expect(del).toBeTruthy();
    expect(await screen.findByText(/0 warga melaporkan titik sudah diperbaiki/)).toBeInTheDocument();
  });

  it('sesi otoritas: melihat hitungan saja, tanpa tombol klaim', async () => {
    mockClaims({ counts: { diperbaiki: 3, hilang: 2 }, mine: [] });
    render(
      <DetailModal
        report={REPORT}
        otoritas={{ displayName: 'Dinas PU' }}
        onClose={vi.fn()}
        onReportUpdated={vi.fn()}
      />
    );

    expect(
      await screen.findByText(/3 warga melaporkan titik ini sudah diperbaiki/)
    ).toBeInTheDocument();
    expect(screen.getByText(/2 warga melaporkan titik ini sudah tidak ada/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Laporkan titik/ })).not.toBeInTheDocument();
  });
});
