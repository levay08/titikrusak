// frontend/src/components/DetailModal.test.jsx
// Tes foto laporan: klik foto membuka FRAME (lightbox dalam situs - bukan
// tab baru, tidak menutup layar penuh) dan bisa ditutup via tombol ✕.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
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

describe('DetailModal: keterangan status "Selesai Diperbaiki" di samping status (header)', () => {
  it('status selesai_diperbaiki: teks keterangan hijau tampil di bagian atas laporan', () => {
    render(
      <DetailModal
        report={{ ...REPORT, status: 'selesai_diperbaiki' }}
        onClose={vi.fn()}
        onReportUpdated={vi.fn()}
      />
    );

    // Teks lengkap: "✓ Status laporan: Selesai Diperbaiki - titik ditandai
    // hijau di peta." (label status di dalam <strong>, jadi dicocokkan
    // per-potongan teks).
    expect(screen.getByText(/✓ Status laporan:/)).toBeInTheDocument();
    expect(screen.getByText(/ditandai hijau di peta/)).toBeInTheDocument();
  });
});

describe('DetailModal: catatan update (belum ada kabar perbaikan)', () => {
  it('menampilkan catatan update dari server apa adanya, tanpa paragraf tambahan', () => {
    render(
      <DetailModal
        report={{
          ...REPORT,
          update_note: 'Banjir bandang Jan 2026 sudah surut. Belum ada kabar perbaikan titik ini.',
        }}
        onClose={vi.fn()}
        onReportUpdated={vi.fn()}
      />
    );
    expect(screen.getByText('Catatan update')).toBeInTheDocument();
    expect(
      screen.getByText('Banjir bandang Jan 2026 sudah surut. Belum ada kabar perbaikan titik ini.')
    ).toBeInTheDocument();
  });

  it('tanpa update_note: tidak ada kotak catatan (titik sudah punya kabar)', () => {
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);
    expect(screen.queryByText('Catatan update')).not.toBeInTheDocument();
  });
});

describe('DetailModal: klaim status lapangan (bintang = sudah diperbaiki, ∅ = objek tidak ada)', () => {
  // Stub fetch: GET /claims mengembalikan angka + status milik pengunjung ini
  // (server menilai dari IP + sesi: `voted` dan `mine`);
  // POST/DELETE /claim mengubah angka (seperti backend).
  const mockClaims = ({ counts = { diperbaiki: 2, hilang: 1 }, mine = [], voted = false } = {}) => {
    const state = { counts: { ...counts }, mine: [...mine], voted };
    const fn = vi.fn((url, init) => {
      const u = String(url);
      if (u.endsWith('/claims')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ counts: state.counts, mine: state.mine, voted: state.voted }),
        });
      }
      if (u.includes('/claim')) {
        const kind =
          u.includes('hilang') || (init && String(init.body || '').includes('hilang')) ? 'hilang' : 'diperbaiki';
        const off = Boolean(init && init.method === 'DELETE');
        state.mine = off ? state.mine.filter((k) => k !== kind) : [...new Set([...state.mine, kind])];
        state.counts[kind] = Math.max(0, state.counts[kind] + (off ? -1 : 1));
        return Promise.resolve({ ok: true, json: async () => ({ counts: state.counts, mine: state.mine }) });
      }
      if (u.includes('/vote')) {
        state.voted = !(init && init.method === 'DELETE');
        const delta = state.voted ? 1 : -1;
        state.vote_count = Math.max(0, (state.vote_count ?? 0) + delta);
        return Promise.resolve({ ok: true, json: async () => ({ vote_count: state.vote_count }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tombol berteks ("Dukung laporan" / "Sudah diperbaiki" / "Objek tidak ada") + angka saja, tanpa kata warga', async () => {
    mockClaims({ counts: { diperbaiki: 2, hilang: 0 }, mine: ['diperbaiki'] });
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    // Sudah dilaporkan -> tombol jadi mode batalkan (teks tetap tampil).
    const star = await screen.findByRole('button', { name: 'Batalkan laporan titik sudah diperbaiki' });
    expect(within(star).getByText('Sudah diperbaiki')).toBeInTheDocument();
    expect(within(star).getByText('2')).toBeInTheDocument();

    const gone = screen.getByRole('button', { name: 'Laporkan objek sudah tidak ada' });
    expect(within(gone).getByText('Objek tidak ada')).toBeInTheDocument();
    expect(within(gone).getByText('0')).toBeInTheDocument();

    // Tidak ada lagi kata "warga" di panel dukungan (angka saja).
    expect(screen.queryByText(/\d+ warga/)).not.toBeInTheDocument();
    expect(screen.queryByText(/menurut warga/)).not.toBeInTheDocument();
    // Keterangan panjang soal hitungan dukungan sudah dihapus.
    expect(screen.queryByText(/Angka = jumlah dukungan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Satu IP atau satu sesi/)).not.toBeInTheDocument();

    // Paragraf keterangan lama sudah dihapus.
    expect(screen.queryByText(/Satu warga satu laporan per jenis/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tidak berubah oleh pembaruan dari media/)).not.toBeInTheDocument();
  });

  it('status "sudah didukung" datang dari SERVER (IP + sesi), bukan dari peramban', async () => {
    mockClaims({ counts: { diperbaiki: 0, hilang: 0 }, mine: [], voted: false });
    const { unmount } = render(
      <DetailModal report={{ ...REPORT, vote_count: 4 }} onClose={vi.fn()} onReportUpdated={vi.fn()} />
    );
    // Belum mendukung -> tombol mode dukung.
    const belum = await screen.findByRole('button', { name: 'Dukung laporan' });
    expect(within(belum).getByText('4')).toBeInTheDocument();
    unmount();

    // Server bilang IP/sesi ini sudah mendukung -> tombol menyala (mode batal).
    mockClaims({ counts: { diperbaiki: 0, hilang: 0 }, mine: [], voted: true });
    render(<DetailModal report={{ ...REPORT, vote_count: 5 }} onClose={vi.fn()} onReportUpdated={vi.fn()} />);
    const sudah = await screen.findByRole('button', { name: 'Batalkan dukungan' });
    expect(within(sudah).getByText('5')).toBeInTheDocument();
  });

  it('saling mengunci: bila "Sudah diperbaiki" sudah bernilai, "Objek tidak ada" tidak bisa diklik', async () => {
    const fetchMock = mockClaims({ counts: { diperbaiki: 2, hilang: 0 }, mine: [] });
    const user = userEvent.setup();
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    const perbaikan = await screen.findByRole('button', { name: 'Laporkan titik sudah diperbaiki' });
    const gone = screen.getByRole('button', { name: 'Laporkan objek sudah tidak ada' });

    // Yang sudah bernilai tetap bisa dipakai; yang berlawanan dikunci.
    expect(perbaikan).not.toBeDisabled();
    expect(gone).toBeDisabled();
    expect(gone).toHaveAttribute('title', 'Tidak bisa dipilih: titik sudah ditandai "sudah diperbaiki".');

    // Diklik pun tidak mengirim permintaan apa pun (tidak ada data silang).
    await user.click(gone);
    expect(
      fetchMock.mock.calls.some(([u, i]) => String(u).includes('/claim') && i && i.method === 'POST')
    ).toBe(false);
    expect(screen.getByText(/Pilih salah satu: sudah diperbaiki atau objek tidak ada/)).toBeInTheDocument();
  });

  it('animasi hanya saat CHECK: bintang+kilau untuk "diperbaiki", asap untuk "tidak ada", confetti untuk dukungan', async () => {
    mockClaims({ counts: { diperbaiki: 0, hilang: 0 }, mine: [] });
    const user = userEvent.setup();
    render(<DetailModal report={{ ...REPORT, vote_count: 0 }} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    // Belum ada animasi apa pun sebelum diklik.
    expect(screen.queryByTestId('burst-diperbaiki')).not.toBeInTheDocument();
    expect(screen.queryByTestId('burst-hilang')).not.toBeInTheDocument();
    expect(screen.queryByTestId('burst-dukung')).not.toBeInTheDocument();

    // Check "Sudah diperbaiki" -> ada partikel bintang (tk-spark) + cincin.
    await user.click(await screen.findByRole('button', { name: 'Laporkan titik sudah diperbaiki' }));
    const fixBurst = await screen.findByTestId('burst-diperbaiki');
    expect(fixBurst.querySelectorAll('.tk-spark').length).toBeGreaterThan(0);
    expect(fixBurst.querySelector('.tk-ring')).toBeTruthy();

    // Uncheck -> animasinya hilang (uncheck tanpa animasi).
    await user.click(screen.getByRole('button', { name: 'Batalkan laporan titik sudah diperbaiki' }));
    await waitFor(() => expect(screen.queryByTestId('burst-diperbaiki')).not.toBeInTheDocument());

    // Check "Objek tidak ada" -> partikel asap (tk-puff), bukan bintang.
    await user.click(screen.getByRole('button', { name: 'Laporkan objek sudah tidak ada' }));
    const goneBurst = await screen.findByTestId('burst-hilang');
    expect(goneBurst.querySelectorAll('.tk-puff').length).toBeGreaterThan(0);
    expect(goneBurst.querySelectorAll('.tk-spark').length).toBe(0);

    // Dukungan -> confetti + bintang jempol.
    await user.click(screen.getByRole('button', { name: 'Dukung laporan' }));
    const voteBurst = await screen.findByTestId('burst-dukung');
    expect(voteBurst.querySelectorAll('.tk-confetti').length).toBeGreaterThan(0);
    expect(voteBurst.querySelectorAll('.tk-star').length).toBeGreaterThan(0);
  });

  it('kunci terbuka lagi setelah klaim lawannya dibatalkan (nilai kembali 0)', async () => {
    mockClaims({ counts: { diperbaiki: 1, hilang: 0 }, mine: ['diperbaiki'] });
    const user = userEvent.setup();
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    const gone = await screen.findByRole('button', { name: 'Laporkan objek sudah tidak ada' });
    expect(gone).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Batalkan laporan titik sudah diperbaiki' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Laporkan objek sudah tidak ada' })).not.toBeDisabled()
    );
    // Sesudah bebas, status "objek tidak ada" bisa dilaporkan.
    await user.click(screen.getByRole('button', { name: 'Laporkan objek sudah tidak ada' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Batalkan laporan objek sudah tidak ada' })).toBeInTheDocument()
    );
  });

  it('klik bintang -> POST klaim; klik lagi -> DELETE (uncheck), angka naik/turun', async () => {
    const fetchMock = mockClaims({ counts: { diperbaiki: 0, hilang: 0 }, mine: [] });
    const user = userEvent.setup();
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Laporkan titik sudah diperbaiki' }));
    const post = fetchMock.mock.calls.find(
      ([u, i]) => String(u).includes('/claim') && i && i.method === 'POST'
    );
    expect(post).toBeTruthy();
    expect(JSON.parse(post[1].body)).toEqual({ kind: 'diperbaiki' });
    await waitFor(() =>
      expect(
        within(screen.getByRole('button', { name: 'Batalkan laporan titik sudah diperbaiki' })).getByText('1')
      ).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Batalkan laporan titik sudah diperbaiki' }));
    const del = fetchMock.mock.calls.find(
      ([u, i]) => String(u).includes('/claim') && i && i.method === 'DELETE'
    );
    expect(del).toBeTruthy();
    await waitFor(() =>
      expect(
        within(screen.getByRole('button', { name: 'Laporkan titik sudah diperbaiki' })).getByText('0')
      ).toBeInTheDocument()
    );
  });

  it('sesi otoritas: melihat angka (teks, tanpa tombol klaim)', async () => {
    mockClaims({ counts: { diperbaiki: 3, hilang: 2 }, mine: [] });
    render(
      <DetailModal
        report={REPORT}
        otoritas={{ displayName: 'Dinas PU' }}
        onClose={vi.fn()}
        onReportUpdated={vi.fn()}
      />
    );

    // Otoritas: tiga kartu tampil sebagai label statis (bukan tombol),
    // masing-masing dengan angkanya sendiri.
    expect(await screen.findByText('Dukungan & status lapangan')).toBeInTheDocument();
    const pillPerbaikan = screen.getByTitle('Laporkan titik sudah diperbaiki');
    const pillHilang = screen.getByTitle('Laporkan objek sudah tidak ada');
    expect(within(pillPerbaikan).getByText('3')).toBeInTheDocument();
    expect(within(pillHilang).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Dukung laporan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Laporkan/ })).not.toBeInTheDocument();
  });

  it('tiga tombol dukungan/status SEJAJAR: satu baris grid, lebar & tinggi seragam', async () => {
    mockClaims({ counts: { diperbaiki: 1, hilang: 0 }, mine: [] });
    render(<DetailModal report={REPORT} onClose={vi.fn()} onReportUpdated={vi.fn()} />);

    const dukung = await screen.findByRole('button', { name: 'Dukung laporan' });
    const perbaikan = screen.getByRole('button', { name: 'Laporkan titik sudah diperbaiki' });
    const hilang = screen.getByRole('button', { name: 'Laporkan objek sudah tidak ada' });

    // Sejajar: ketiganya anak dari baris yang sama (satu baris grid 3 kolom).
    expect(perbaikan.parentElement).toBe(dukung.parentElement);
    expect(hilang.parentElement).toBe(dukung.parentElement);
    expect(dukung.parentElement.className).toContain('tk-support-row');
    // Lebar sama dibagi rata oleh grid (bukan flex-wrap yang bisa 2+1).
    expect(dukung.parentElement.style.display).not.toBe('flex');
    // Ukuran seragam: kelas tombol sama untuk ketiganya.
    for (const el of [dukung, perbaikan, hilang]) {
      expect(el.className).toContain('tk-support-btn');
      expect(within(el).getByText(/^\d+$/)).toBeInTheDocument();
    }
  });
});
