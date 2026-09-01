// frontend/src/components/ListView.test.jsx
// Tes ListView: render baris ringkas (badge severity, nama lokasi, jenis,
// status), klik baris membuka modal detail dengan seluruh field, dan
// kondisi hasil kosong (pesan + tombol Reset Filter) yang sama seperti
// MapView.

import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import ListView from './ListView.jsx';

// Override stub matchMedia per tes (default setup: matches=false = desktop).
// Dipakai untuk menguji cabang mobile (File 1 Bagian 9.7).
const setMobile = (matches) =>
  window.matchMedia.mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

// Contoh laporan dengan seluruh field yang mungkin ada di response API.
const SAMPLE = [
  {
    id: 1,
    created_at: '2026-08-31 09:56:52',
    updated_at: '2026-08-31 09:56:52',
    infra_type: 'jembatan',
    severity: 'berat',
    bridge_authority: 'kabupaten_kota',
    vital_status: ['akses_sekolah', 'akses_ekonomi'],
    vital_status_note: null,
    description: 'Papan jembatan banyak yang lepas',
    location_name: 'Jembatan Gantung Cibeureum, Garut',
    lat: -7.2075,
    lng: 107.8881,
    photo_urls: null,
    reporter_display_name: null,
    reporter_is_verified: 0,
    validated_by_display_name: null,
    validated_at: null,
    status: 'dilaporkan',
    source_type: 'warga',
    source_media_name: null,
    source_media_url: null,
    source_media_date: null,
    related_earthquake: null,
    related_weather: null,
    vote_count: 0,
  },
  {
    id: 2,
    created_at: '2026-08-31 11:44:40',
    updated_at: '2026-08-31 11:44:40',
    infra_type: 'sekolah',
    severity: 'ringan',
    bridge_authority: 'tidak_diketahui',
    vital_status: ['akses_sekolah'],
    vital_status_note: null,
    description: null,
    location_name: 'SDN 2 Tarogong',
    lat: -7.19,
    lng: 107.9,
    photo_urls: null,
    reporter_display_name: null,
    reporter_is_verified: 0,
    validated_by_display_name: null,
    validated_at: null,
    status: 'dilaporkan',
    source_type: 'warga',
    source_media_name: null,
    source_media_url: null,
    source_media_date: null,
    related_earthquake: null,
    related_weather: null,
    vote_count: 0,
  },
];

describe('ListView', () => {
  afterEach(() => {
    // Kembalikan stub matchMedia ke default desktop untuk tes berikutnya.
    setMobile(false);
  });

  it('menampilkan baris ringkas: badge severity, nama lokasi, jenis, status', () => {
    render(<ListView reports={SAMPLE} onResetFilters={vi.fn()} />);

    expect(screen.getByText('Jembatan Gantung Cibeureum, Garut')).toBeInTheDocument();
    expect(screen.getByText('SDN 2 Tarogong')).toBeInTheDocument();
    // Sub-info: Kategori + Kerusakan (label jelas, bukan sekadar dua kata).
    expect(screen.getByText(/Kategori Jembatan - Kerusakan Berat/)).toBeInTheDocument();
    expect(screen.getByText(/Kategori Sekolah - Kerusakan Ringan/)).toBeInTheDocument();
    // Badge status laporan.
    expect(screen.getAllByText('Dilaporkan')).toHaveLength(2);
    // Jumlah laporan.
    expect(screen.getByText('2 laporan')).toBeInTheDocument();
  });

  it('klik baris membuka modal detail dengan seluruh field laporan', async () => {
    const user = userEvent.setup();
    render(<ListView reports={SAMPLE} onResetFilters={vi.fn()} />);

    await user.click(screen.getByText('Jembatan Gantung Cibeureum, Garut'));

    // Field dari database tampil dengan nilai terformat.
    expect(screen.getByText('Kategori Kewenangan')).toBeInTheDocument();
    expect(screen.getByText('Kabupaten/Kota')).toBeInTheDocument();
    expect(screen.getByText('Tingkat Kerusakan')).toBeInTheDocument();
    expect(screen.getByText('Berat')).toBeInTheDocument();
    expect(screen.getByText('Status Vital')).toBeInTheDocument();
    expect(screen.getByText('Akses Sekolah, Akses Ekonomi')).toBeInTheDocument();
    expect(screen.getByText('Deskripsi')).toBeInTheDocument();
    expect(screen.getByText('Papan jembatan banyak yang lepas')).toBeInTheDocument();
    expect(screen.getByText('Pelapor Terverifikasi')).toBeInTheDocument();
    expect(screen.getByText('Tidak')).toBeInTheDocument();

    // Tutup modal.
    await user.click(screen.getByRole('button', { name: /tutup detail laporan/i }));
    expect(screen.queryByText('Kategori Kewenangan')).not.toBeInTheDocument();
  });

  it('mobile: modal detail dirender sebagai bottom sheet (File 1 9.7)', async () => {
    setMobile(true);
    const user = userEvent.setup();
    const { container } = render(<ListView reports={SAMPLE} onResetFilters={vi.fn()} />);

    await user.click(screen.getByText('Jembatan Gantung Cibeureum, Garut'));

    // Overlay modal menempel ke bawah (flex-end, tanpa padding samping).
    const overlay = [...container.querySelectorAll('div')].find(
      (d) => d.style.position === 'fixed'
    );
    expect(overlay).toBeDefined();
    expect(overlay.style.alignItems).toBe('flex-end');
    expect(overlay.style.padding).toBe('0px');

    // Lembar modal melebar penuh dengan sudut atas melengkung.
    const sheet = overlay.firstElementChild;
    expect(sheet.style.borderRadius).toBe('14px 14px 0 0');
    expect(sheet.style.maxHeight).toContain('dvh');
  });

  it('Kondisi B: ada data tapi filter kosong -> pesan filter + Reset Filter', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<ListView reports={[]} hasAnyData onResetFilters={onReset} />);

    expect(
      screen.getByText('Tidak ada laporan yang sesuai dengan filter ini')
    ).toBeInTheDocument();
    // Tanpa ajakan "Lapor Kerusakan" (bukan kondisi DB kosong).
    expect(screen.queryByRole('button', { name: /^lapor kerusakan$/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reset filter/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('Kondisi A: database kosong -> pesan ajakan + tombol Lapor Kerusakan (tanpa Reset Filter)', async () => {
    const user = userEvent.setup();
    const onOpenReportForm = vi.fn();
    render(<ListView reports={[]} hasAnyData={false} onOpenReportForm={onOpenReportForm} />);

    expect(
      screen.getByText(/Belum ada laporan infrastruktur rusak di sini/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Jadilah yang pertama melaporkan!/i)).toBeInTheDocument();

    // Tidak ada tombol Reset Filter pada kondisi ini.
    expect(screen.queryByRole('button', { name: /reset filter/i })).not.toBeInTheDocument();

    // Tombol ajakan membuka form laporan.
    await user.click(screen.getByRole('button', { name: /^lapor kerusakan$/i }));
    expect(onOpenReportForm).toHaveBeenCalledTimes(1);
  });
});

describe('ListView: mode otoritas — pengelompokan prioritas (poin Alur Inti 7)', () => {
  const OTORITAS = { displayName: 'Dinas PU Garut' };

  // Campuran yang sengaja mewakili seluruh tier:
  //   ambruk + e.id + lengkap        -> Sangat Tinggi (12+2+4 = 18)
  //   berat + tanpa e.id + minim     -> Tinggi (9)
  //   sedang + tanpa e.id            -> Sedang (6)
  //   ringan + tanpa e.id + minim    -> Rendah (3)
  const MIX = [
    {
      ...SAMPLE[0],
      id: 10,
      severity: 'ambruk',
      status: 'terverifikasi',
      reporter_is_verified: 1,
      description: 'Putus total, tidak bisa dilalui',
      bridge_authority: 'kabupaten_kota',
      vital_status_note: 'Akses sekolah terputus',
      photo_urls: ['/uploads/jembatan-cilawu.jpg'],
      location_name: 'Jembatan Ambruk Cilawu',
    },
    {
      ...SAMPLE[0],
      id: 11,
      severity: 'berat',
      status: 'dilaporkan',
      reporter_is_verified: 0,
      description: null,
      bridge_authority: 'tidak_diketahui',
      location_name: 'Jalan Berlubang Dalam',
    },
    {
      ...SAMPLE[1],
      id: 12,
      severity: 'sedang',
      status: 'dilaporkan',
      reporter_is_verified: 0,
      location_name: 'SDN 3 Tarogong',
    },
    {
      ...SAMPLE[1],
      id: 13,
      severity: 'ringan',
      status: 'dilaporkan',
      reporter_is_verified: 0,
      location_name: 'Gorong-gorong Mampang',
    },
  ];

  it('tanpa sesi otoritas daftar TIDAK dikelompokkan (tampilan biasa)', () => {
    render(<ListView reports={MIX} onResetFilters={vi.fn()} />);
    expect(screen.queryByText(/Prioritas Sangat Tinggi/)).not.toBeInTheDocument();
    expect(screen.getByText('4 laporan')).toBeInTheDocument();
  });

  it('saat otoritas masuk, laporan dikelompokkan per prioritas dengan urutan tier + chip e.id/kelengkapan', () => {
    render(<ListView reports={MIX} otoritas={OTORITAS} onResetFilters={vi.fn()} />);

    // Seluruh grup tier tampil.
    expect(screen.getByText('Prioritas Sangat Tinggi')).toBeInTheDocument();
    expect(screen.getByText('Prioritas Tinggi')).toBeInTheDocument();
    expect(screen.getByText('Prioritas Sedang')).toBeInTheDocument();
    expect(screen.getByText('Prioritas Rendah')).toBeInTheDocument();

    // Jumlah laporan per grup.
    const stHeader = screen.getByText('Prioritas Sangat Tinggi').closest('div');
    expect(within(stHeader).getByText('1 laporan')).toBeInTheDocument();
    const rHeader = screen.getByText('Prioritas Rendah').closest('div');
    expect(within(rHeader).getByText('1 laporan')).toBeInTheDocument();

    // Chip bahan prioritas: laporan terverifikasi e.id vs tanpa e.id.
    // Chip kelengkapan (Lengkap/Cukup/Minim) sengaja TIDAK ditampilkan lagi
    // (kurang jelas artinya bagi otoritas — nilai tetap dipakai di skor
    // prioritas, hanya tidak dirender).
    const stRow = screen.getByText('Jembatan Ambruk Cilawu').closest('button');
    expect(within(stRow).getByText('✓ e.id')).toBeInTheDocument();
    expect(within(stRow).queryByText(/Lengkap|Cukup|Minim/)).not.toBeInTheDocument();

    const tRow = screen.getByText('Jalan Berlubang Dalam').closest('button');
    expect(within(tRow).getByText('Tanpa e.id')).toBeInTheDocument();
    expect(within(tRow).queryByText(/Lengkap|Cukup|Minim/)).not.toBeInTheDocument();
  });

  it('otoritas dapat approve (tandai terverifikasi): PATCH status + refresh daftar/peta', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 11, status: 'terverifikasi' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onReportUpdated = vi.fn();
    const user = userEvent.setup();

    render(
      <ListView
        reports={[MIX[1]]}
        otoritas={OTORITAS}
        onReportUpdated={onReportUpdated}
        onResetFilters={vi.fn()}
      />
    );

    await user.click(screen.getByText('Jalan Berlubang Dalam'));
    await user.click(screen.getByRole('button', { name: /tandai terverifikasi \(approve\)/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reports/11/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          status: 'terverifikasi',
          changed_by_display_name: 'Dinas PU Garut',
        }),
      })
    );
    expect(onReportUpdated).toHaveBeenCalledTimes(1);
    // Modal tertutup setelah berhasil (data lama tidak ditampilkan).
    expect(screen.queryByText('Tindakan Otoritas')).not.toBeInTheDocument();
  });

  it('tanpa sesi otoritas tidak ada tombol tindakan status di detail', async () => {
    const user = userEvent.setup();
    render(<ListView reports={[MIX[1]]} onResetFilters={vi.fn()} />);

    await user.click(screen.getByText('Jalan Berlubang Dalam'));
    expect(screen.queryByText('Tindakan Otoritas')).not.toBeInTheDocument();
  });
});

describe('ListView: fitur Dukungan warga (poin Alur Inti 6) — butuh e.id', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const REPORT = { ...SAMPLE[0], id: 11, location_name: 'Jalan Berlubang Dalam' };

  it('tanpa verifikasi e.id: klik Dukung memunculkan ajakan verifikasi, Batal kembali', async () => {
    const user = userEvent.setup();
    render(<ListView reports={[REPORT]} onResetFilters={vi.fn()} />);

    await user.click(screen.getByText('Jalan Berlubang Dalam'));
    await user.click(screen.getByRole('button', { name: /dukung laporan \(e\.id\)/i }));

    expect(
      screen.getByText(/Fitur Dukungan tersedia untuk warga terverifikasi e\.id/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^batal$/i }));
    expect(screen.getByRole('button', { name: /dukung laporan \(e\.id\)/i })).toBeInTheDocument();
  });

  it('warga terverifikasi e.id: Dukung mengirim POST /vote dan menampilkan jumlah baru', async () => {
    localStorage.setItem(
      'titikrusak_eid',
      JSON.stringify({ displayName: 'Warga Garut', isVerified: true })
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 11, vote_count: 3 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<ListView reports={[REPORT]} onResetFilters={vi.fn()} />);

    await user.click(screen.getByText('Jalan Berlubang Dalam'));
    await user.click(screen.getByRole('button', { name: /^dukung laporan$/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reports/11/vote',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          voter_display_name: 'Warga Garut',
          voter_is_verified: true,
        }),
      })
    );
    expect(
      await screen.findByText(/Terima kasih! Dukungan Anda tercatat \(3\)\./i)
    ).toBeInTheDocument();
  });

  it('dukungan duplikat (409) menampilkan pesan sudah mendukung', async () => {
    localStorage.setItem(
      'titikrusak_eid',
      JSON.stringify({ displayName: 'Warga Garut', isVerified: true })
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Laporan ini sudah didukung oleh identitas yang sama' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<ListView reports={[REPORT]} onResetFilters={vi.fn()} />);

    await user.click(screen.getByText('Jalan Berlubang Dalam'));
    await user.click(screen.getByRole('button', { name: /^dukung laporan$/i }));

    expect(await screen.findByText(/Laporan ini sudah Anda dukung\./i)).toBeInTheDocument();
  });
});
