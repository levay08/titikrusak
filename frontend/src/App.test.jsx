// frontend/src/App.test.jsx
// Tes alur end-to-end level aplikasi via kode (tanpa browser nyata):
// buka modal Lapor Kerusakan -> isi form -> geocoding (Cari Lokasi) ->
// submit -> POST terkirim -> pesan sukses tampil -> MapView me-refresh
// (GET /api/reports kedua) -> modal tertutup. Leaflet di-mock
// (lihat src/test/setup.js).
// Catatan: query memakai getByRole (bukan getByLabelText) karena
// @testing-library/dom v10 mengembalikan elemen duplikat untuk kontrol
// yang dibungkus <label> (radio/checkbox).

import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

// Override stub matchMedia per tes (default setup: matches=false = desktop).
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

describe('App: alur lapor kerusakan end-to-end', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  afterEach(() => {
    setMobile(false);
  });

  it('geocoding, submit laporan baru, lalu peta me-refresh otomatis tanpa reload', async () => {
    const filteredMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    // Fetch total (tanpa filter) mengembalikan 1 laporan -> ada data di DB.
    const totalMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => [{ id: 1, location_name: 'X' }] });
    const postMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 42 }),
    });
    const fetchMock = vi.fn((url, init) => {
      const u = String(url);
      // Geocoding Nominatim dari form.
      if (u.includes('nominatim')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{ lat: '-7.4032', lon: '107.8139', display_name: 'Jl. Raya Cikajang' }],
        });
      }
      if (init && init.method === 'POST') return postMock();
      if (u.startsWith('/api/reports?')) return filteredMock(); // hasil dengan filter aktif
      if (u === '/api/reports') return totalMock(); // total tanpa filter
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<App />);

    // Muat awal: satu GET hasil-filter + satu GET total (tanpa filter).
    await waitFor(() => expect(filteredMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(totalMock).toHaveBeenCalledTimes(1));

    // Buka modal via tombol floating.
    await user.click(screen.getByRole('button', { name: /^\+ lapor kerusakan/i }));

    // Lewati layar awal pilihan verifikasi -> form utama.
    await user.click(screen.getByRole('button', { name: /lanjut tanpa verifikasi/i }));

    // Scope query ke dalam form modal (FilterPanel di sidebar punya
    // checkbox dengan nama yang sama, mis. "Akses Kesehatan").
    const form = screen.getByRole('heading', { name: 'Lapor Kerusakan' }).closest('form');
    expect(form).not.toBeNull();

    // Isi formulir (tanpa verifikasi e.id).
    await user.selectOptions(within(form).getByRole('combobox', { name: /jenis infrastruktur/i }), 'jalan');
    await user.click(within(form).getByRole('radio', { name: 'Sedang' }));
    await user.click(within(form).getByRole('checkbox', { name: 'Akses Kesehatan' }));
    await user.type(within(form).getByRole('textbox', { name: /nama lokasi/i }), 'Jl. Raya Cikajang, Garut');
    // Geocoding: klik Cari Lokasi -> koordinat dari hasil Nominatim.
    await user.click(within(form).getByRole('button', { name: /cari lokasi/i }));
    expect(await screen.findByText(/Lokasi ditemukan/i)).toBeInTheDocument();

    // Submit.
    await user.click(within(form).getByRole('button', { name: /kirim laporan/i }));

    // POST terkirim, pesan sukses tampil, peta me-refresh (GET kedua).
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Laporan Terkirim/i)).toBeInTheDocument();
    await waitFor(() => expect(filteredMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(totalMock).toHaveBeenCalledTimes(2));

    // Payload POST sesuai skema backend, koordinat dari pin hasil geocoding.
    const body = JSON.parse(fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')[1].body);
    expect(body).toMatchObject({
      infra_type: 'jalan',
      severity: 'sedang',
      bridge_authority: 'tidak_diketahui',
      vital_status: ['akses_kesehatan'],
      location_name: 'Jl. Raya Cikajang, Garut',
      lat: -7.4032,
      lng: 107.8139,
    });

    // Tutup modal.
    await user.click(screen.getByRole('button', { name: /^tutup$/i }));
    expect(screen.queryByText(/Laporan Terkirim/i)).not.toBeInTheDocument();
    // Form modal sudah tidak ada (textbox "Cari Nama Lokasi" di panel tetap ada).
    expect(screen.queryByText('Lapor Kerusakan')).not.toBeInTheDocument();
  });

  it('mobile: menu header (drawer) -> Login sebagai Otoritas menampilkan info scan QR/desktop, bukan alur verifikasi', async () => {
    setMobile(true);
    const verifyStart = vi.fn();
    const fetchMock = vi.fn((url, init) => {
      const u = String(url);
      if (init && init.method === 'POST' && u.includes('/api/verify/start')) return verifyStart();
      if (u.startsWith('/api/reports?')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (u === '/api/reports') {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Menu header mobile ada di drawer "☰ Menu".
    await user.click(screen.getByRole('button', { name: /buka menu/i }));
    expect(screen.getByRole('button', { name: /^tentang$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^statistik$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pantau$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^notifikasi$/i })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /login sebagai otoritas/i })[0]);

    // Info tampil (pesan baku SAMA dengan form warga): butuh scan QR +
    // hanya optimal dan lancar di desktop.
    expect(
      screen.getByText(
        /Verifikasi e\.id memerlukan pemindaian QR menggunakan aplikasi e\.id di perangkat lain\. Fitur ini hanya optimal dan lancar di tampilan desktop\./i
      )
    ).toBeInTheDocument();
    // Alur verifikasi e.id TIDAK dimulai dari HP (tidak ada POST /api/verify/start).
    expect(verifyStart).not.toHaveBeenCalled();

    // Tutup -> modal hilang.
    await user.click(screen.getByRole('button', { name: /^tutup$/i }));
    expect(screen.queryByText(/pemindaian QR/i)).not.toBeInTheDocument();
  });

  it('desktop: menu header (Tentang/Statistik/Pantau/Notifikasi) membuka MODAL, bukan halaman baru', async () => {
    const fetchMock = vi.fn((url, init) => {
      const u = String(url);
      if (u.startsWith('/api/reports?')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (u === '/api/reports') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 1,
              location_name: 'Jembatan Cibeureum',
              lat: -7.2075,
              lng: 107.8881,
              severity: 'ringan',
              status: 'dilaporkan',
              reporter_is_verified: 0,
              infra_type: 'jembatan',
            },
          ],
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Menu tersedia langsung di header desktop.
    expect(screen.getByRole('button', { name: /^tentang$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^statistik$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pantau$/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /notifikasi aktivitas laporan/i })
    ).toBeInTheDocument();

    // Tentang -> modal.
    await user.click(screen.getByRole('button', { name: /^tentang$/i }));
    expect(screen.getByText('Tentang titikrusak.id')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tutup tentang titikrusak\.id/i }));
    expect(screen.queryByText('Tentang titikrusak.id')).not.toBeInTheDocument();

    // Statistik -> modal dengan data nyata dari fetch tanpa filter.
    await user.click(screen.getByRole('button', { name: /^statistik$/i }));
    expect(screen.getByText('Statistik Pelaporan')).toBeInTheDocument();
    expect(
      within(screen.getByText('Total Laporan').parentElement).getByText('1')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /tutup statistik pelaporan/i }));
    expect(screen.queryByText('Statistik Pelaporan')).not.toBeInTheDocument();
  });

  it('desktop: menu "Login Otoritas" (gembok) membuka halaman Admin (gate)', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => [] })
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Menu gabungan login + Admin di header: ikon gembok + teks "Login Otoritas".
    const loginMenu = screen.getAllByRole('button', { name: /login otoritas/i })[0];
    expect(loginMenu).toHaveTextContent('🔒');
    expect(loginMenu).toHaveTextContent('Login Otoritas');

    // Klik -> buka halaman Admin (gate, belum masuk sebagai otoritas).
    await user.click(loginMenu);
    expect(await screen.findByText('Panel Administrator')).toBeInTheDocument();
  });

  it('sidebar filter desktop bisa disembunyikan dan dimunculkan lagi', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => [] })
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Sidebar tampil -> sembunyikan.
    expect(screen.getByRole('heading', { name: /filter laporan/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sembunyikan panel filter/i }));
    expect(screen.queryByRole('heading', { name: /filter laporan/i })).not.toBeInTheDocument();

    // Tab tipis muncul -> klik untuk memunculkan kembali.
    await user.click(screen.getByRole('button', { name: /tampilkan panel filter/i }));
    expect(screen.getByRole('heading', { name: /filter laporan/i })).toBeInTheDocument();
  });

  it('database kosong: hanya SATU tombol Lapor Kerusakan (poin Alur Inti 14)', async () => {
    const fetchMock = vi.fn((url) => {
      const u = String(url);
      if (u.startsWith('/api/reports')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    // Kartu ajakan tampil (DB kosong)...
    expect(
      await screen.findByText(/Belum ada laporan infrastruktur rusak di sini/i)
    ).toBeInTheDocument();
    // ...dan TEPAT SATU tombol "Lapor Kerusakan" (dari kartu; tombol
    // floating disembunyikan — tidak ada duplikat).
    expect(screen.getAllByRole('button', { name: /lapor kerusakan/i })).toHaveLength(1);
  });

  it('sidebar: klik "Verifikasi e.id Warga" membuka modal verifikasi warga Member level 1 (tanpa KTP)', async () => {
    const verifyStart = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ qr_data: { qr_token: 't', challenge: 'c' }, session_id: 's1' }),
    });
    const fetchMock = vi.fn((url, init) => {
      const u = String(url);
      if (init && init.method === 'POST' && u.includes('/api/verify/start')) {
        return verifyStart(url, init);
      }
      if (u.startsWith('/api/reports?')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (u === '/api/reports') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{ id: 1, location_name: 'X', lat: -7.2, lng: 107.8 }],
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: /verifikasi e\.id warga/i }));

    // Modal verifikasi WARGA terbuka + skema Member level 1 (email/nama/
    // alamat/no. telp, tanpa KTP).
    expect(await screen.findByText(/Verifikasi e\.id — Warga/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Verifikasi Member level 1: email, nama, alamat, dan nomor telepon — tanpa KTP\./i)
    ).toBeInTheDocument();
    await waitFor(() => expect(verifyStart).toHaveBeenCalledTimes(1));
    expect(verifyStart).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ role: 'warga' }) })
    );
  });

  it('header & footer memakai logo aplikasi; footer menampilkan sponsor PANDI, e.id, IDCloudHost (sejajar)', async () => {
    const fetchMock = vi.fn((url) => {
      const u = String(url);
      if (u.startsWith('/api/reports?')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (u === '/api/reports') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{ id: 1, location_name: 'X', lat: -7.2, lng: 107.8 }],
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Logo aplikasi (header + footer) dengan tema peta/koordinat/rusak.
    expect(screen.getAllByRole('img', { name: 'Logo titikrusak.id' }).length).toBeGreaterThanOrEqual(1);

    // Footer: label + tiga logo sponsor.
    expect(screen.getByText('Didukung oleh:')).toBeInTheDocument();
    expect(screen.getByAltText('Logo PANDI')).toBeInTheDocument();
    expect(screen.getByAltText('Logo e.id')).toBeInTheDocument();
    expect(screen.getByAltText('Logo IDCloudHost')).toBeInTheDocument();
  });
});
