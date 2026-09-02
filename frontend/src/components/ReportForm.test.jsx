// frontend/src/components/ReportForm.test.jsx
// Tes pengisian dan submit ReportForm secara nyata via kode (user-event),
// dengan fetch di-stub. Membuktikan: layar awal pilihan verifikasi,
// validasi field wajib, alur geocoding Nominatim (Cari Lokasi), payload
// POST persis sesuai skema backend, pesan sukses, dan panggilan
// onSubmitted.
// Catatan: query memakai getByRole (bukan getByLabelText) karena
// @testing-library/dom v10 mengembalikan elemen duplikat untuk kontrol
// yang dibungkus <label> (radio/checkbox).

import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import ReportForm from './ReportForm.jsx';

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

// Hasil geocoding stub: 1 hasil dengan koordinat Garut.
const GEO_RESULT = [
  { lat: '-7.2075', lon: '107.8881', display_name: 'Jembatan Gantung Cibeureum, Garut' },
];

// Stub fetch yang membedakan: geocoding Nominatim, POST /api/reports,
// dan GET lainnya.
function buildFetchMock({ postResponse, geoResult = GEO_RESULT }) {
  return vi.fn((url, init) => {
    if (String(url).includes('nominatim')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => geoResult });
    }
    if (init && init.method === 'POST') return Promise.resolve(postResponse);
    return Promise.resolve({ ok: true, status: 200, json: async () => [] });
  });
}

// Lewati layar awal pilihan verifikasi -> masuk form utama tanpa verifikasi.
async function openForm(user) {
  await user.click(screen.getByRole('button', { name: /lanjut tanpa verifikasi/i }));
}

describe('ReportForm', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  afterEach(() => {
    setMobile(false);
  });

  it('menampilkan layar awal dengan opsi verifikasi e.id + ajakan manfaat (poin Alur Inti 6)', () => {
    render(<ReportForm onSubmitted={vi.fn()} onClose={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /verifikasi dengan e\.id/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /lanjut tanpa verifikasi/i })
    ).toBeInTheDocument();

    // Ajakan melapor dengan e.id menyebutkan manfaatnya: mudah diverifikasi
    // otoritas + fitur dukungan warga yang menaikkan prioritas laporan.
    expect(screen.getByText(/Dengan e\.id, laporan Anda:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/langsung bertanda terverifikasi — mudah diverifikasi dan diproses otoritas/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/dukungan menaikkan prioritas penanganan laporan/i)
    ).toBeInTheDocument();

    // Catatan untuk jalur tanpa verifikasi.
    expect(
      screen.getByText(/Tanpa verifikasi, laporan tetap terkirim dan diproses/i)
    ).toBeInTheDocument();
  });

  it('sudah terverifikasi e.id: tidak perlu verifikasi ulang — opsi nama/anonim, "tanpa verifikasi" nonaktif', async () => {
    localStorage.setItem(
      'titikrusak_eid',
      JSON.stringify({ displayName: 'Warga Garut', isVerified: true })
    );
    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    render(<ReportForm onSubmitted={onSubmitted} onClose={vi.fn()} />);

    // Layar konfirmasi identitas, bukan layar verifikasi ulang.
    expect(screen.getByText(/Terverifikasi e\.id — Role:/)).toBeInTheDocument();
    expect(screen.getByText('Warga')).toBeInTheDocument();
    expect(screen.getByText(/Member Lv1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /melapor sebagai Warga Garut/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /melapor anonim/i })).toBeInTheDocument();

    // "Lanjut tanpa verifikasi" NONAKTIF karena sudah terverifikasi.
    const tanpaBtn = screen.getByRole('button', { name: /lanjut tanpa verifikasi/i });
    expect(tanpaBtn).toBeDisabled();
    expect(
      screen.getByText(/opsi "tanpa verifikasi" nonaktif karena anda sudah terverifikasi e\.id\./i)
    ).toBeInTheDocument();

    // Pilih anonim -> form terbuka dengan badge terverifikasi anonim.
    await user.click(screen.getByRole('button', { name: /melapor anonim/i }));
    expect(screen.getByText(/melapor sebagai/i)).toBeInTheDocument();
    expect(screen.getByText('Anonim')).toBeInTheDocument();
  });

  it('mobile/tablet: tombol verifikasi e.id membuka alur WALLET (buka aplikasi via deep link, tanpa scan QR)', async () => {
    setMobile(true);
    // stub verifikasi e.id: start -> session + eid_oauth_url; status pending.
    const fetchMock = vi.fn((url, init) => {
      const u = String(url);
      if (init && init.method === 'POST' && u.includes('/api/verify/start')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            session_id: 'sess-m1',
            qr_data: { challenge: 'c1', qr_token: 't1', schema_id: 'vs1' },
            eid_oauth_url: 'https://wallet.e.id/oauth/credential?c=c1&q=t1',
          }),
        });
      }
      if (u.includes('/api/verify/status/')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'pending' }) });
      }
      if (init && init.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 99 }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<ReportForm onSubmitted={vi.fn()} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /verifikasi dengan e\.id/i }));

    // Alur verifikasi LANGSUNG dimulai dari perangkat ini (POST start).
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/verify/start', expect.anything())
    );
    // Tautan deep link wallet e.id (tanpa pindai QR).
    const walletLink = await screen.findByRole('link', { name: /buka wallet e\.id/i }, { timeout: 2000 });
    expect(walletLink).toHaveAttribute('href', 'https://wallet.e.id/oauth/credential?c=c1&q=t1');
    expect(screen.queryByText(/Scan QR ini dengan aplikasi e\.id/i)).not.toBeInTheDocument();

    // Batal -> kembali ke layar awal pilihan verifikasi.
    await user.click(screen.getByRole('button', { name: /^batal$/i }));
    expect(
      screen.getByRole('button', { name: /lanjut tanpa verifikasi/i })
    ).toBeInTheDocument();
  });

  it('mobile/tablet: tombol verifikasi DI DALAM form juga membuka alur wallet e.id', async () => {
    setMobile(true);
    const fetchMock = vi.fn((url, init) => {
      const u = String(url);
      if (init && init.method === 'POST' && u.includes('/api/verify/start')) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            session_id: 'sess-m2',
            qr_data: { challenge: 'c2', qr_token: 't2', schema_id: 'vs2' },
            eid_oauth_url: 'https://wallet.e.id/oauth/credential?c=c2&q=t2',
          }),
        });
      }
      if (u.includes('/api/verify/status/')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'pending' }) });
      }
      if (init && init.method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, json: async () => ({ id: 99 }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    render(<ReportForm onSubmitted={vi.fn()} onClose={vi.fn()} />);
    await openForm(user); // lewati layar awal -> form (badge "Melapor tanpa verifikasi")

    // Tombol verifikasi di baris badge form -> alur wallet, bukan info.
    await user.click(screen.getByRole('button', { name: /verifikasi dengan e\.id/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/verify/start', expect.anything())
    );
    expect(
      await screen.findByRole('link', { name: /buka wallet e\.id/i }, { timeout: 2000 })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Scan QR ini dengan aplikasi e\.id/i)).not.toBeInTheDocument();

    // Batal -> kembali ke form (badge tetap).
    await user.click(screen.getByRole('button', { name: /^batal$/i }));
    expect(screen.getByText(/melapor tanpa verifikasi identitas/i)).toBeInTheDocument();
  });

  it('menampilkan error validasi saat field wajib kosong (termasuk lokasi belum ditentukan)', async () => {
    const user = userEvent.setup();
    render(<ReportForm onSubmitted={vi.fn()} onClose={vi.fn()} />);
    await openForm(user);

    await user.click(screen.getByRole('button', { name: /kirim laporan/i }));

    expect(await screen.findByText('Pilih jenis infrastruktur')).toBeInTheDocument();
    expect(screen.getByText('Pilih tingkat kerusakan')).toBeInTheDocument();
    expect(screen.getByText('Pilih minimal satu status vital')).toBeInTheDocument();
    expect(screen.getByText('Nama lokasi wajib diisi')).toBeInTheDocument();
    expect(screen.getByText(/Tentukan lokasi dulu/i)).toBeInTheDocument();
  });

  it('memunculkan field vital_status_note saat Lainnya dicentang dan mewajibkannya', async () => {
    vi.stubGlobal('fetch', buildFetchMock({ postResponse: { ok: true, status: 201, json: async () => ({ id: 99 }) } }));

    const user = userEvent.setup();
    render(<ReportForm onSubmitted={vi.fn()} onClose={vi.fn()} />);
    await openForm(user);

    // Field note belum ada sebelum Lainnya dicentang.
    expect(screen.queryByRole('textbox', { name: /keterangan status vital/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Lainnya' }));

    const noteInput = screen.getByRole('textbox', { name: /keterangan status vital/i });
    expect(noteInput).toBeInTheDocument();

    // Isi field wajib lainnya; lokasi ditentukan lewat geocoding.
    await user.selectOptions(screen.getByRole('combobox', { name: /jenis infrastruktur/i }), 'jalan');
    await user.click(screen.getByRole('radio', { name: 'Ringan' }));
    await user.click(screen.getByRole('checkbox', { name: 'Akses Sekolah' }));
    await user.type(screen.getByRole('textbox', { name: /nama lokasi/i }), 'Jl. Uji Coba');
    await user.click(screen.getByRole('button', { name: /cari lokasi/i }));
    expect(await screen.findByText(/Lokasi ditemukan/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /kirim laporan/i }));

    expect(await screen.findByText(/wajib diisi karena Lainnya dipilih/i)).toBeInTheDocument();
  });

  it('mengirim payload lengkap dengan koordinat hasil geocoding dan memanggil onSubmitted saat sukses', async () => {
    const fetchMock = buildFetchMock({ postResponse: { ok: true, status: 201, json: async () => ({ id: 99 }) } });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    const onSubmitted = vi.fn();
    const onClose = vi.fn();
    render(<ReportForm onSubmitted={onSubmitted} onClose={onClose} />);
    await openForm(user);

    // Isi seluruh field.
    await user.selectOptions(screen.getByRole('combobox', { name: /jenis infrastruktur/i }), 'jembatan');
    await user.click(screen.getByRole('radio', { name: 'Berat' }));
    await user.selectOptions(screen.getByRole('combobox', { name: /kategori kewenangan/i }), 'desa_swadaya');
    await user.click(screen.getByRole('checkbox', { name: 'Akses Sekolah' }));
    await user.click(screen.getByRole('checkbox', { name: 'Akses Sungai' }));
    await user.type(
      screen.getByRole('textbox', { name: /nama lokasi/i }),
      'Jembatan Gantung Cibeureum, Garut'
    );
    // Geocoding: klik Cari Lokasi -> fetch Nominatim -> pin di koordinat hasil.
    await user.click(screen.getByRole('button', { name: /cari lokasi/i }));
    expect(await screen.findByText(/Lokasi ditemukan/i)).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: /deskripsi/i }),
      'Tali penyangga putus sebagian, papan banyak lepas'
    );

    await user.click(screen.getByRole('button', { name: /kirim laporan/i }));

    // Sukses: POST terkirim sekali dengan payload persis, onSubmitted dipanggil.
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1x geocoding + 1x POST
    const postCall = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(postCall[0]).toBe('/api/reports');
    expect(JSON.parse(postCall[1].body)).toEqual({
      infra_type: 'jembatan',
      severity: 'berat',
      bridge_authority: 'desa_swadaya',
      vital_status: ['akses_sekolah', 'akses_sungai'],
      location_name: 'Jembatan Gantung Cibeureum, Garut',
      lat: -7.2075,   // koordinat pin = hasil geocoding
      lng: 107.8881,
      description: 'Tali penyangga putus sebagian, papan banyak lepas',
    });
    expect(await screen.findByText(/Laporan Terkirim/i)).toBeInTheDocument();
    // Umpan balik sukses (poin Alur Inti 5): terima kasih + laporan akan
    // di-review dan ditindaklanjuti oleh otoritas.
    expect(
      screen.getByText(
        /Terima kasih! Laporan Anda sudah terkirim dan akan segera di-review serta ditindaklanjuti oleh otoritas setempat/i
      )
    ).toBeInTheDocument();
  });

  it('menampilkan pesan error server saat POST gagal', async () => {
    vi.stubGlobal(
      'fetch',
      buildFetchMock({
        postResponse: { ok: false, status: 400, json: async () => ({ error: 'lat wajib diisi berupa angka' }) },
      })
    );

    const user = userEvent.setup();
    render(<ReportForm onSubmitted={vi.fn()} onClose={vi.fn()} />);
    await openForm(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /jenis infrastruktur/i }), 'jalan');
    await user.click(screen.getByRole('radio', { name: 'Sedang' }));
    await user.click(screen.getByRole('checkbox', { name: 'Akses Ekonomi' }));
    await user.type(screen.getByRole('textbox', { name: /nama lokasi/i }), 'Jl. Contoh');
    await user.click(screen.getByRole('button', { name: /cari lokasi/i }));
    await screen.findByText(/Lokasi ditemukan/i);
    await user.click(screen.getByRole('button', { name: /kirim laporan/i }));

    expect(
      await screen.findByText(/Gagal mengirim laporan: lat wajib diisi berupa angka/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Laporan Terkirim/i)).not.toBeInTheDocument();
  });

  it('menekan Enter pada input nama lokasi memicu geocoding (sama seperti tombol Cari Lokasi)', async () => {
    vi.stubGlobal('fetch', buildFetchMock({ postResponse: { ok: true, status: 201, json: async () => ({ id: 99 }) } }));

    const user = userEvent.setup();
    render(<ReportForm onSubmitted={vi.fn()} onClose={vi.fn()} />);
    await openForm(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /jenis infrastruktur/i }), 'jalan');
    await user.click(screen.getByRole('radio', { name: 'Ringan' }));
    await user.click(screen.getByRole('checkbox', { name: 'Akses Sekolah' }));
    const lokasiInput = screen.getByRole('textbox', { name: /nama lokasi/i });
    await user.type(lokasiInput, 'Jembatan Cibeureum, Garut');
    await user.keyboard('{Enter}'); // bukan klik tombol Cari Lokasi

    expect(await screen.findByText(/Lokasi ditemukan/i)).toBeInTheDocument();
  });

  it('saat geocoding tidak menemukan hasil, menampilkan pesan dan menolak submit sampai pin digeser', async () => {
    vi.stubGlobal('fetch', buildFetchMock({ postResponse: { ok: true, status: 201, json: async () => ({ id: 99 }) }, geoResult: [] }));

    const user = userEvent.setup();
    render(<ReportForm onSubmitted={vi.fn()} onClose={vi.fn()} />);
    await openForm(user);

    await user.selectOptions(screen.getByRole('combobox', { name: /jenis infrastruktur/i }), 'jalan');
    await user.click(screen.getByRole('radio', { name: 'Ringan' }));
    await user.click(screen.getByRole('checkbox', { name: 'Akses Sekolah' }));
    await user.type(screen.getByRole('textbox', { name: /nama lokasi/i }), 'Tempat Tak Dikenal');

    await user.click(screen.getByRole('button', { name: /cari lokasi/i }));
    expect(await screen.findByText(/Lokasi tidak ditemukan/i)).toBeInTheDocument();
    expect(screen.getByText(/Tempatkan pin secara manual/i)).toBeInTheDocument();

    // Pin belum digeser -> submit ditolak.
    await user.click(screen.getByRole('button', { name: /kirim laporan/i }));
    expect(await screen.findByText(/Tentukan lokasi dulu/i)).toBeInTheDocument();
    expect(screen.queryByText(/Laporan Terkirim/i)).not.toBeInTheDocument();
  });
});
