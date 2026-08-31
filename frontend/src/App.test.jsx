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
    const form = screen.getByText('Lapor Kerusakan').closest('form');
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

  it('mobile: tombol Otoritas menampilkan info scan QR/desktop, bukan alur verifikasi', async () => {
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

    await user.click(screen.getByRole('button', { name: /^otoritas$/i }));

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
});
