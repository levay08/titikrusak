// frontend/src/App.test.jsx
// Tes alur end-to-end level aplikasi via kode (tanpa browser nyata):
// buka modal Lapor Kerusakan -> isi form -> geocoding (Cari Lokasi) ->
// submit -> POST terkirim -> pesan sukses tampil -> MapView me-refresh
// (GET /api/reports kedua) -> modal tertutup. Leaflet di-mock
// (lihat src/test/setup.js).
// Catatan: query memakai getByRole (bukan getByLabelText) karena
// @testing-library/dom v10 mengembalikan elemen duplikat untuk kontrol
// yang dibungkus <label> (radio/checkbox).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from './App.jsx';

describe('App: alur lapor kerusakan end-to-end', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('geocoding, submit laporan baru, lalu peta me-refresh otomatis tanpa reload', async () => {
    const getMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    const postMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 42 }),
    });
    const fetchMock = vi.fn((url, init) => {
      // Geocoding Nominatim dari form.
      if (String(url).includes('nominatim')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{ lat: '-7.4032', lon: '107.8139', display_name: 'Jl. Raya Cikajang' }],
        });
      }
      return init && init.method === 'POST' ? postMock() : getMock();
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<App />);

    // Muat awal peta: satu kali GET /api/reports.
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));

    // Buka modal via tombol floating.
    await user.click(screen.getByRole('button', { name: /lapor kerusakan/i }));

    // Isi formulir (tanpa verifikasi e.id).
    await user.selectOptions(screen.getByRole('combobox', { name: /jenis infrastruktur/i }), 'jalan');
    await user.click(screen.getByRole('radio', { name: 'Sedang' }));
    await user.click(screen.getByRole('checkbox', { name: 'Akses Kesehatan' }));
    await user.type(screen.getByRole('textbox', { name: /nama lokasi/i }), 'Jl. Raya Cikajang, Garut');
    // Geocoding: klik Cari Lokasi -> koordinat dari hasil Nominatim.
    await user.click(screen.getByRole('button', { name: /cari lokasi/i }));
    expect(await screen.findByText(/Lokasi ditemukan/i)).toBeInTheDocument();

    // Submit.
    await user.click(screen.getByRole('button', { name: /kirim laporan/i }));

    // POST terkirim, pesan sukses tampil, peta me-refresh (GET kedua).
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Laporan Terkirim/i)).toBeInTheDocument();
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));

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
    expect(screen.queryByRole('textbox', { name: /nama lokasi/i })).not.toBeInTheDocument();
  });
});
