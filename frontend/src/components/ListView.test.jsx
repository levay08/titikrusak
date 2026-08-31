// frontend/src/components/ListView.test.jsx
// Tes ListView: render baris ringkas (badge severity, nama lokasi, jenis,
// status), klik baris membuka modal detail dengan seluruh field, dan
// kondisi hasil kosong (pesan + tombol Reset Filter) yang sama seperti
// MapView.

import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    // Sub-info jenis + severity di baris.
    expect(screen.getByText(/Jembatan · Berat/)).toBeInTheDocument();
    expect(screen.getByText(/Sekolah · Ringan/)).toBeInTheDocument();
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
