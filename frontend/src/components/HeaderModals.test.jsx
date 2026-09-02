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

describe('AboutModal (menu Tentang — konten SAMA dengan modal welcome)', () => {
  it('menampilkan konten yang sama dengan modal welcome: latar belakang, solusi, fitur utama, ajakan', () => {
    render(<AboutModal onClose={vi.fn()} />);
    expect(screen.getByText('Tentang titikrusak.id')).toBeInTheDocument();

    // Konten diambil dari WelcomeBody (satu sumber dengan WelcomeModal).
    expect(screen.getByText('Latar Belakang')).toBeInTheDocument();
    expect(screen.getByText('Solusi')).toBeInTheDocument();
    expect(screen.getByText('Fitur Utama')).toBeInTheDocument();
    expect(
      screen.getByText(/peta terpadu kerusakan infrastruktur/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Dukungan warga via e\.id — menaikkan prioritas/i)
    ).toBeInTheDocument();
    // Ajakan verifikasi — teks terbagi elemen <strong>, cek textContent.
    expect(
      screen.getByText(
        (_c, el) =>
          el.tagName === 'P' &&
          el.textContent.includes('verifikasi identitas dengan') &&
          el.textContent.includes('tanpa KTP untuk warga')
      )
    ).toBeInTheDocument();
    // Tidak ada lagi konten lama (hero/kartu fitur/cara pakai).
    expect(screen.queryByText('Cara pakai')).not.toBeInTheDocument();
    expect(screen.queryByText(/platform crowdsourcing untuk melaporkan/i)).not.toBeInTheDocument();
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

describe('NotifikasiModal (feed aktivitas gabungan — transparansi)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('menampilkan laporan, perubahan status, dan dukungan dari /api/activity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            activities: [
              {
                type: 'report_created',
                report_id: 3,
                location_name: 'Jembatan Cibeureum',
                actor: 'Warga Garut',
                severity: 'ambruk',
                infra_type: 'jembatan',
                at: '2026-09-01 10:00:00',
              },
              {
                type: 'status_changed',
                report_id: 3,
                location_name: 'Jembatan Cibeureum',
                actor: 'Dinas PU',
                new_status: 'terverifikasi',
                at: '2026-09-01 11:00:00',
              },
              {
                type: 'voted',
                report_id: 3,
                location_name: 'Jembatan Cibeureum',
                actor: 'Anonim',
                at: '2026-09-01 12:00:00',
              },
            ],
          }),
        })
      )
    );

    render(<NotifikasiModal onClose={vi.fn()} />);

    // Ketiga jenis aktivitas tampil.
    expect(await screen.findByText(/melaporkan/i)).toBeInTheDocument();
    expect(screen.getByText(/mengubah status menjadi/i)).toBeInTheDocument();
    expect(screen.getByText(/mendukung laporan/i)).toBeInTheDocument();

    // Aktor + lokasi.
    expect(screen.getByText('Warga Garut')).toBeInTheDocument();
    expect(screen.getByText('Dinas PU')).toBeInTheDocument();
    expect(screen.getByText('Anonim')).toBeInTheDocument();
    expect(screen.getAllByText('Jembatan Cibeureum').length).toBeGreaterThanOrEqual(1);

    // Chip status perubahan + chip severity laporan.
    expect(screen.getByText('Terverifikasi')).toBeInTheDocument();
    expect(screen.getByText('Ambruk')).toBeInTheDocument();
  });

  it('gagal memuat -> pesan error, tidak throw', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 })));
    render(<NotifikasiModal onClose={vi.fn()} />);
    expect(await screen.findByText(/gagal memuat aktivitas/i)).toBeInTheDocument();
  });
});
