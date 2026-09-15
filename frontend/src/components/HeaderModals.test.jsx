// frontend/src/components/HeaderModals.test.jsx
// Tes menu header (poin Alur Inti 9) - semuanya MODAL: Tentang (about),
// Statistik (total/severity/wilayah per pulau & provinsi, tabel + grafik),
// Pantau (hanya laporan dalam perbaikan & selesai), Notifikasi (aktivitas
// laporan: dibuat oleh, lokasi, apa yang rusak, status kerusakan).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('AboutModal (menu Tentang - konten SAMA dengan modal welcome)', () => {
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
      screen.getByText(/Dukungan warga via e\.id - menaikkan prioritas/i)
    ).toBeInTheDocument();
    // Ajakan verifikasi - teks terbagi elemen <strong>, cek textContent.
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

    // Disclaimer independensi (koreksi user - juga tampil di modal welcome
    // karena memakai WelcomeBody yang sama).
    expect(
      screen.getByText(
        (_c, el) =>
          el.tagName === 'P' &&
          el.textContent.includes('portal independen dari warga untuk warga') &&
          el.textContent.includes('tidak berafiliasi dengan lembaga')
      )
    ).toBeInTheDocument();
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

describe('NotifikasiModal: 3 tab (Kabar Media / Aktivitas Laporan / Komentar)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const ACTIVITY = {
    activities: [
      {
        type: 'report_created',
        report_id: 3,
        location_name: 'Jembatan Cibeureum',
        actor: 'Warga Garut',
        source_type: 'warga',
        reporter_is_verified: 1,
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
    ],
    commentGroups: [
      {
        report_id: 3,
        location_name: 'Jembatan Cibeureum',
        infra_type: 'jembatan',
        severity: 'ambruk',
        count: 2,
        last_name: 'Warga',
        last_at: '2026-09-01 12:00:00',
      },
    ],
    // Kabar media: kejadian ditambah / diperbarui / diberitakan diperbaiki.
    mediaEvents: [
      {
        kind: 'baru',
        at: '2026-09-01 10:30:00',
        report_id: 40,
        location_name: 'Jalan Trans Sulawesi Parimo',
        severity: 'berat',
        infra_type: 'jalan',
        status: 'dilaporkan',
        source_media_name: 'Kompas.com',
        is_new_seed: 1,
        note: 'Jembatan putus di Parimo - Kompas.com',
      },
      {
        kind: 'update',
        at: '2026-08-30 08:00:00',
        report_id: 12,
        location_name: 'Jembatan Saka Harang',
        severity: 'ambruk',
        infra_type: 'jembatan',
        status: 'dilaporkan',
        source_media_name: 'ANTARA',
        is_new_seed: 0,
        note: 'Perbaikan darurat jembatan dimulai - ANTARA',
      },
      {
        kind: 'perbaikan',
        at: '2026-09-08 14:03:13',
        report_id: 13,
        location_name: 'SDN 12 Bintang',
        severity: 'berat',
        infra_type: 'sekolah',
        status: 'selesai_diperbaiki',
        source_media_name: 'detikSumut',
        is_new_seed: 0,
        note: 'Sekolah direvitalisasi - detikSumut',
      },
    ],
  };

  it('tab Kabar Media: titik BARU ditandai, yang lama tidak; baris bisa diklik buka detail', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    const user = userEvent.setup();
    const onOpenReport = vi.fn();
    render(
      <NotifikasiModal
        onClose={vi.fn()}
        reports={[
          {
            id: 40,
            location_name: 'Jalan Trans Sulawesi Parimo',
            severity: 'berat',
            infra_type: 'jalan',
            status: 'dilaporkan',
          },
        ]}
        onOpenReport={onOpenReport}
      />
    );

    expect(await screen.findByText('Jalan Trans Sulawesi Parimo')).toBeInTheDocument();
    // Tiga jenis kabar media: ditambah, diperbarui, diberitakan diperbaiki.
    expect(screen.getByText(/Titik baru dari berita/)).toBeInTheDocument();
    expect(screen.getByText(/Diperbarui dari berita/)).toBeInTheDocument();
    expect(screen.getByText(/Diberitakan sudah diperbaiki/)).toBeInTheDocument();
    // Judul berita terakhir (note) ikut tampil sebagai konteks.
    expect(screen.getByText(/Jembatan putus di Parimo/)).toBeInTheDocument();
    // Tanda BARU hanya untuk titik yang tersentuh cycle monitor terakhir.
    expect(screen.getAllByText('BARU')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Jalan Trans Sulawesi Parimo/ }));
    expect(onOpenReport).toHaveBeenCalledWith(expect.objectContaining({ id: 40 }));
  });

  it('tab Kabar Media: baris baru berlatar kuning, baris lain tanpa latar', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    // Kunjungan terakhir 9 Sep: #40 (01 Sep, is_new_seed 1) tetap BARU karena
    // tersentuh cycle monitor terakhir; #12 (30 Agu) dan #13 'perbaikan'
    // (8 Sep) sudah dilihat -> tanpa latar.
    render(<NotifikasiModal onClose={vi.fn()} seenAt="2026-09-09 00:00:00" />);

    const barisBaru = (await screen.findByText('Jalan Trans Sulawesi Parimo')).closest('[data-baru]');
    const barisLama = screen.getByText('Jembatan Saka Harang').closest('[data-baru]');
    const barisPerbaikan = screen.getByText('SDN 12 Bintang').closest('[data-baru]');

    expect(barisBaru).toHaveAttribute('data-baru', '1');
    expect(barisLama).toHaveAttribute('data-baru', '0');
    expect(barisPerbaikan).toHaveAttribute('data-baru', '0');

    // Hanya baris baru yang punya LATAR; baris lain transparan.
    expect(barisBaru).toHaveStyle({ background: '#fef3c7' });
    expect(barisPerbaikan).toHaveStyle({ background: 'transparent' });
    expect(barisLama).toHaveStyle({ background: 'transparent' });

    // Label BARU hanya di baris baru.
    const label = within(barisBaru).getByTestId('notif-baru');
    expect(label).toHaveTextContent('BARU');
    expect(within(barisLama).queryByTestId('notif-baru')).not.toBeInTheDocument();
    expect(within(barisPerbaikan).queryByTestId('notif-baru')).not.toBeInTheDocument();

    // Format lama tidak diubah: ikon + chip severity tetap berwarna.
    expect(within(barisLama).getByTestId('notif-ikon')).toHaveStyle({ color: '#ef4444' });
    expect(within(barisLama).getByTestId('notif-chip-severity')).toHaveStyle({ color: '#ef4444' });
    expect(within(barisLama).getByTestId('notif-chip-infra')).toHaveStyle({ color: '#334155' });
  });

  it('tab Kabar Media: urut dari kabar TERBARU, kabar perbaikan tua tidak dipaksa di atas', async () => {
    // Server mengirim urut kronologis terbaru dulu (services/notifFeed.js).
    // Kabar 'perbaikan' tanggalnya paling tua -> wajib render paling BAWAH.
    const TERURUT = {
      activities: [],
      commentGroups: [],
      mediaEvents: [
        {
          kind: 'update',
          at: '2026-09-15 04:25:15',
          report_id: 450,
          location_name: 'Sabo dam Jorong Duo Koto',
          severity: 'berat',
          infra_type: 'bendungan',
          is_new_seed: 1,
        },
        {
          kind: 'tercatat',
          at: '2026-09-02 07:01:26',
          report_id: 101,
          location_name: 'Jalan utama Karangan',
          severity: 'ringan',
          infra_type: 'jalan',
          is_new_seed: 0,
        },
        {
          kind: 'perbaikan',
          at: '2026-01-12T00:00:00.000Z',
          report_id: 504,
          location_name: 'Jembatan Desa Nibung',
          severity: 'berat',
          infra_type: 'jembatan',
          is_new_seed: 0,
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => TERURUT })));
    const { container } = render(<NotifikasiModal onClose={vi.fn()} seenAt="2026-09-10 00:00:00" />);

    await screen.findByText('Sabo dam Jorong Duo Koto');
    // Baris tab Kabar Media = <button> bertanda data-baru.
    const baris = [...container.querySelectorAll('button[data-baru]')].map((b) => b.textContent);

    expect(baris).toHaveLength(3);
    expect(baris[0]).toContain('Sabo dam Jorong Duo Koto');
    expect(baris[1]).toContain('Jalan utama Karangan');
    expect(baris[2]).toContain('Jembatan Desa Nibung'); // perbaikan tua di bawah
    // Baris teratas = notifikasi baru: berlatar kuning + label BARU + waktu kabar.
    const atas = container.querySelectorAll('button[data-baru]')[0];
    expect(atas).toHaveAttribute('data-baru', '1');
    expect(atas).toHaveStyle({ background: '#fef3c7' });
    expect(within(atas).getByTestId('notif-baru')).toHaveTextContent('BARU');
    expect(baris[0]).toContain('15 Sep 2026');
  });

  it('tab Komentar: ringkasan terurut dari komentar terbaru, bukan dari jumlah komentar', async () => {
    const KOMENTAR = {
      activities: [],
      mediaEvents: [],
      commentGroups: [
        {
          report_id: 9,
          location_name: 'Jembatan Rantau Limau',
          infra_type: 'jembatan',
          severity: 'ambruk',
          count: 2,
          last_name: 'Warga',
          last_at: '2026-09-14 09:00:00',
        },
        {
          report_id: 4,
          location_name: 'Jalan Pusuk Sembalun',
          infra_type: 'jalan',
          severity: 'berat',
          count: 12,
          last_name: 'Warga',
          last_at: '2026-09-01 09:00:00',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => KOMENTAR })));
    const user = userEvent.setup();
    const { container } = render(<NotifikasiModal onClose={vi.fn()} seenAt="2026-09-10 00:00:00" />);

    await screen.findByText('Belum ada kabar dari seed media.'); // tunggu data termuat
    await user.click(screen.getByRole('button', { name: /^Komentar/ }));

    const baris = [...container.querySelectorAll('div[role="button"][data-baru]')].map((b) => b.textContent);
    expect(baris).toHaveLength(2);
    expect(baris[0]).toContain('Jembatan Rantau Limau'); // 2 komentar tapi terbaru
    expect(baris[0]).toContain('BARU');
    expect(baris[1]).toContain('Jalan Pusuk Sembalun');
  });

  it('tab Kabar Media: kabar lebih baru dari kunjungan terakhir ikut berlatar walau is_new_seed 0', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    // Kunjungan terakhir 5 Sep: 'perbaikan' #13 (8 Sep 14:03) lebih baru.
    render(<NotifikasiModal onClose={vi.fn()} seenAt="2026-09-05 00:00:00" />);

    const barisPerbaikan = (await screen.findByText('SDN 12 Bintang')).closest('[data-baru]');
    expect(barisPerbaikan).toHaveAttribute('data-baru', '1');
    expect(barisPerbaikan).toHaveStyle({ background: '#fef3c7' });
    // #12 (30 Agu) tetap lama.
    expect(screen.getByText('Jembatan Saka Harang').closest('[data-baru]')).toHaveAttribute('data-baru', '0');
  });

  it('tab Kabar Media: sebelum pernah membuka menu -> tidak ada baris bertanda, walau ada is_new_seed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    render(<NotifikasiModal onClose={vi.fn()} seenAt="" />);

    // is_new_seed = 1 (cycle monitor terakhir) tetap ditandai.
    expect((await screen.findByText('Jalan Trans Sulawesi Parimo')).closest('[data-baru]')).toHaveAttribute('data-baru', '1');
    // Yang lain tidak, karena belum ada penanda kunjungan.
    expect(screen.getByText('SDN 12 Bintang').closest('[data-baru]')).toHaveAttribute('data-baru', '0');
    expect(screen.getByText('Jembatan Saka Harang').closest('[data-baru]')).toHaveAttribute('data-baru', '0');
  });

  it('tab Aktivitas Laporan: laporan warga + verifikasi otoritas, TANPA titik seed media', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    const user = userEvent.setup();
    render(<NotifikasiModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Aktivitas Laporan' }));

    expect(await screen.findByText('Warga Garut')).toBeInTheDocument();
    expect(screen.getAllByText(/melaporkan/).length).toBeGreaterThanOrEqual(1);
    // Pemisah sumber laporan: e.id terverifikasi vs tanpa e.id.
    expect(screen.getByText('Warga · e.id terverifikasi')).toBeInTheDocument();
    expect(screen.getByText('Dinas PU')).toBeInTheDocument();
    expect(screen.getByText(/mengubah status menjadi/)).toBeInTheDocument();
    expect(screen.getAllByText('Jembatan Cibeureum').length).toBeGreaterThanOrEqual(1);
    // Titik hasil seed media tidak boleh ikut di tab ini.
    expect(screen.queryByText('Jalan Trans Sulawesi Parimo')).not.toBeInTheDocument();
  });

  it('tab Aktivitas Laporan: hanya aktivitas setelah kunjungan terakhir yang ditandai baru', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    const user = userEvent.setup();
    // Aktivitas: laporan warga 01 Sep 10:00, verifikasi otoritas 01 Sep 11:00.
    render(<NotifikasiModal onClose={vi.fn()} seenAt="2026-09-01 10:30:00" />);

    await user.click(screen.getByRole('button', { name: 'Aktivitas Laporan' }));

    const barisBaru = (await screen.findByText('Dinas PU')).closest('[data-baru]');
    const barisLama = screen.getByText('Warga Garut').closest('[data-baru]');
    expect(barisBaru).toHaveAttribute('data-baru', '1');
    expect(barisLama).toHaveAttribute('data-baru', '0');
    expect(within(barisBaru).getByTestId('notif-baru')).toHaveTextContent('BARU');
    expect(within(barisLama).queryByTestId('notif-baru')).not.toBeInTheDocument();

    // Latar kuning hanya di baris baru; format lama (avatar + chip berwarna)
    // tetap dipertahankan.
    expect(barisBaru).toHaveStyle({ background: '#fef3c7' });
    expect(barisLama).toHaveStyle({ background: 'transparent' });
    expect(within(barisBaru).getByTestId('notif-avatar')).toHaveStyle({ color: '#2563eb' });
    expect(within(barisLama).getByTestId('notif-avatar')).toHaveStyle({ color: '#854d0e' });
    expect(within(barisLama).getByTestId('notif-chip-sumber')).toHaveStyle({ color: '#2563eb' });
    expect(within(barisLama).getByTestId('notif-chip-severity')).toHaveStyle({ color: '#ef4444' });
    expect(within(barisLama).getByTestId('notif-chip-infra')).toHaveStyle({ color: '#334155' });
    expect(within(barisBaru).getByTestId('notif-chip-status')).toHaveStyle({ color: '#3b82f6' });
  });

  it('tab Aktivitas Laporan KOSONG saat belum ada laporan manual warga / aktivitas otoritas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: async () => ({ activities: [], commentGroups: [], mediaEvents: [] }) })
      )
    );
    const user = userEvent.setup();
    render(<NotifikasiModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Aktivitas Laporan' }));
    expect(await screen.findByText(/Belum ada laporan manual dari warga/i)).toBeInTheDocument();
  });

  it('tab Komentar: ringkasan komentar per titik (istilah "komentar", bukan "diskusi")', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    const user = userEvent.setup();
    render(<NotifikasiModal onClose={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: /Komentar/ }));
    expect(screen.getByRole('button', { name: /Komentar \(1\)/ })).toBeInTheDocument();
    expect(screen.getAllByText('Jembatan Cibeureum').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/diskusi/i)).not.toBeInTheDocument();
  });

  it('tab Komentar: titik dengan komentar setelah kunjungan terakhir ditandai baru', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    const user = userEvent.setup();
    // Komentar terakhir 01 Sep 12:00 > kunjungan 01 Sep 11:00.
    render(<NotifikasiModal onClose={vi.fn()} seenAt="2026-09-01 11:00:00" />);

    await user.click(await screen.findByRole('button', { name: /Komentar/ }));

    const baris = screen
      .getAllByText('Jembatan Cibeureum')
      .map((el) => el.closest('[data-baru]'))
      .find((el) => el && el.getAttribute('role') === 'button');
    expect(baris).toHaveAttribute('data-baru', '1');
    expect(within(baris).getByTestId('notif-baru')).toHaveTextContent('BARU');
    // Baris baru berlatar kuning; format chip lama tetap berwarna.
    expect(baris).toHaveStyle({ background: '#fef3c7' });
    expect(within(baris).getByTestId('notif-chip-severity')).toHaveStyle({ color: '#ef4444' });
    expect(within(baris).getByTestId('notif-chip-infra')).toHaveStyle({ color: '#334155' });
  });

  it('menu Notifikasi: hanya baris baru yang punya latar, di ketiga tab', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    const user = userEvent.setup();
    // Latar kuning (#fef3c7) hanya boleh ada pada baris data-baru="1".
    const cekLatar = () => {
      const barisBerlatar = Array.from(document.querySelectorAll('[data-baru="1"]'));
      const berwarna = Array.from(document.querySelectorAll('[style*="rgb(254, 243, 199)"]'));
      expect(berwarna.length).toBe(barisBerlatar.length);
      for (const b of berwarna) {
        expect(b.getAttribute('data-baru')).toBe('1');
      }
    };

    render(<NotifikasiModal onClose={vi.fn()} seenAt="2026-09-05 00:00:00" />);
    await screen.findByText('Jalan Trans Sulawesi Parimo');
    cekLatar();

    await user.click(screen.getByRole('button', { name: 'Aktivitas Laporan' }));
    await screen.findByText('Warga Garut');
    cekLatar();

    await user.click(screen.getByRole('button', { name: /Komentar/ }));
    await screen.findByText(/Komentar terbaru dari/);
    cekLatar();
  });

  it('gagal memuat -> pesan error, tidak throw', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 })));
    render(<NotifikasiModal onClose={vi.fn()} />);
    expect(await screen.findByText(/gagal memuat kabar media/i)).toBeInTheDocument();
  });

  it('badge "belum dibaca" tampil di tab yang punya notifikasi baru', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ACTIVITY })));
    render(
      <NotifikasiModal onClose={vi.fn()} unread={{ media: 3, activities: 1, comments: 0 }} />
    );

    expect(await screen.findByTestId('notif-tab-badge-media')).toHaveTextContent('3');
    expect(screen.getByTestId('notif-tab-badge-laporan')).toHaveTextContent('1');
    // Tidak ada komentar baru -> tab Komentar tanpa badge angka.
    expect(screen.queryByTestId('notif-tab-badge-komentar')).not.toBeInTheDocument();
  });
});
