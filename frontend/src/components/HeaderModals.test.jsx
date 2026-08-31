// frontend/src/components/HeaderModals.test.jsx
// Tes menu header (poin Alur Inti 9) — semuanya MODAL: Tentang (about),
// Statistik (total/severity/wilayah per pulau & provinsi, tabel + grafik),
// Pantau (hanya laporan dalam perbaikan & selesai), Notifikasi (aktivitas
// laporan: dibuat oleh, lokasi, apa yang rusak, status kerusakan).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AboutModal, StatistikModal, PantauModal, NotifikasiModal } from './HeaderModals.jsx';

const base = {
  infra_type: 'jembatan',
  vital_status: ['akses_sekolah'],
  bridge_authority: 'tidak_diketahui',
  location_name: 'Lokasi',
  description: null,
  photo_urls: null,
  vital_status_note: null,
  reporter_display_name: null,
  reporter_is_verified: 0,
  validated_by_display_name: null,
  validated_at: null,
  status: 'dilaporkan',
  vote_count: 0,
};

// Koordinat nyata: Garut (Jawa Barat/Jawa), Jakarta (DKI/Jawa),
// Medan (Sumatera Utara/Sumatera), Denpasar (Bali/Bali & Nusa Tenggara).
const REPORTS = [
  {
    ...base,
    id: 1,
    lat: -7.2075,
    lng: 107.8881,
    severity: 'berat',
    reporter_is_verified: 1,
    reporter_display_name: 'Warga Garut',
    location_name: 'Jembatan Cibeureum',
    created_at: '2026-08-31 09:00:00',
    updated_at: '2026-08-31 09:00:00',
  },
  {
    ...base,
    id: 2,
    lat: -6.2,
    lng: 106.8,
    severity: 'ringan',
    infra_type: 'jalan',
    status: 'selesai_diperbaiki',
    location_name: 'Jalan Merdeka Jakarta',
    created_at: '2026-08-31 10:00:00',
    updated_at: '2026-09-01 08:00:00',
  },
  {
    ...base,
    id: 3,
    lat: 3.59,
    lng: 98.67,
    severity: 'sedang',
    infra_type: 'sekolah',
    status: 'dalam_perbaikan',
    reporter_display_name: 'Budi Medan',
    location_name: 'SDN 1 Medan',
    created_at: '2026-08-30 07:00:00',
    updated_at: '2026-09-01 07:00:00',
  },
  {
    ...base,
    id: 4,
    lat: -8.65,
    lng: 115.22,
    severity: 'ambruk',
    location_name: 'Pasar Kreneng Denpasar',
    created_at: '2026-08-29 12:00:00',
    updated_at: '2026-08-29 12:00:00',
  },
];

describe('AboutModal (poin 9: tentang aplikasi)', () => {
  it('menampilkan deskripsi aplikasi + cara pakai', () => {
    render(<AboutModal onClose={vi.fn()} />);
    expect(screen.getByText('Tentang titikrusak.id')).toBeInTheDocument();
    expect(screen.getByText(/platform crowdsourcing untuk melaporkan/i)).toBeInTheDocument();
    expect(screen.getByText('Cara pakai')).toBeInTheDocument();
    expect(screen.getByText(/Dukung laporan warga lain/i)).toBeInTheDocument();
  });
});

describe('StatistikModal (poin 9: statistik pelaporan)', () => {
  it('menghitung total, severity, wilayah per pulau dan per provinsi (tabel + grafik)', () => {
    render(<StatistikModal reports={REPORTS} onClose={vi.fn()} />);

    // Kartu ringkasan: total 4, terverifikasi e.id 1.
    expect(screen.getByText('Total Laporan')).toBeInTheDocument();
    expect(within(screen.getByText('Total Laporan').parentElement).getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Terverifikasi e.id')).toBeInTheDocument();
    expect(
      within(screen.getByText('Terverifikasi e.id').parentElement).getByText('1')
    ).toBeInTheDocument();

    // Grafik severity: Ringan/Sedang/Berat/Ambruk masing-masing 1.
    expect(screen.getByText('Tingkat Kerusakan')).toBeInTheDocument();
    expect(screen.getByText('Ambruk')).toBeInTheDocument();
    expect(screen.getByText('Berat')).toBeInTheDocument();
    expect(screen.getByText('Sedang')).toBeInTheDocument();
    expect(screen.getByText('Ringan')).toBeInTheDocument();

    // Wilayah per pulau.
    expect(screen.getByText('Wilayah per Pulau')).toBeInTheDocument();
    expect(screen.getByText('Jawa')).toBeInTheDocument();
    expect(screen.getByText('Sumatera')).toBeInTheDocument();
    expect(screen.getByText('Bali & Nusa Tenggara')).toBeInTheDocument();

    // Wilayah per provinsi (deteksi dari koordinat).
    expect(screen.getByText('Wilayah per Provinsi (10 besar)')).toBeInTheDocument();
    expect(screen.getByText('Jawa Barat')).toBeInTheDocument();
    expect(screen.getByText('DKI Jakarta')).toBeInTheDocument();
    expect(screen.getByText('Sumatera Utara')).toBeInTheDocument();
    expect(screen.getByText('Bali')).toBeInTheDocument();
  });

  it('data kosong tidak error dan menampilkan provinsi kosong', () => {
    render(<StatistikModal reports={[]} onClose={vi.fn()} />);
    expect(within(screen.getByText('Total Laporan').parentElement).getByText('0')).toBeInTheDocument();
    expect(
      screen.getByText('Belum ada laporan untuk dihitung per provinsi.')
    ).toBeInTheDocument();
  });
});

describe('PantauModal (poin 9: laporan perbaikan & selesai)', () => {
  it('hanya menampilkan laporan dalam perbaikan dan yang baru selesai', () => {
    render(<PantauModal reports={REPORTS} onClose={vi.fn()} />);

    expect(screen.getByText('🚧 Dalam Perbaikan (1)')).toBeInTheDocument();
    expect(screen.getByText('✅ Baru Selesai Diperbaiki (1)')).toBeInTheDocument();

    expect(screen.getByText('SDN 1 Medan')).toBeInTheDocument();
    expect(screen.getByText('Jalan Merdeka Jakarta')).toBeInTheDocument();

    // Laporan masih 'dilaporkan' tidak masuk daftar pantau.
    expect(screen.queryByText('Jembatan Cibeureum')).not.toBeInTheDocument();
    expect(screen.queryByText('Pasar Kreneng Denpasar')).not.toBeInTheDocument();
  });
});

describe('NotifikasiModal (poin 9: aktivitas laporan)', () => {
  it('menampilkan aktivitas: dibuat oleh, lokasi, apa yang rusak, status kerusakan', () => {
    render(<NotifikasiModal reports={REPORTS} onClose={vi.fn()} />);

    // Terbaru dulu (created_at desc).
    const feed = screen.getAllByText(/melaporkan/i);
    expect(feed).toHaveLength(4);

    // Identitas pelapor + lokasi + jenis + severity + status.
    expect(screen.getByText('Warga Garut')).toBeInTheDocument();
    expect(screen.getByText('Budi Medan')).toBeInTheDocument();
    expect(screen.getByText('Jembatan Cibeureum')).toBeInTheDocument();
    expect(screen.getByText('Pasar Kreneng Denpasar')).toBeInTheDocument();

    // "apa yang rusak" (jenis infrastruktur) + status kerusakan.
    expect(screen.getAllByText('Jembatan')).toHaveLength(2); // 2 laporan jembatan
    expect(screen.getByText('Sekolah')).toBeInTheDocument();
    expect(screen.getByText('Ambruk')).toBeInTheDocument();
    expect(screen.getByText('Selesai Diperbaiki')).toBeInTheDocument();
    expect(screen.getByText('Dalam Perbaikan')).toBeInTheDocument();
  });
});
