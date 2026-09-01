// frontend/src/components/MapView.test.jsx
// Tes perbaikan responsif (File 1 Bagian 9.7): kontrol zoom Leaflet
// bawaan menempel di pojok kiri-atas dan bertabrakan dengan tombol
// navigasi (← / ⟲) di semua ukuran layar. Fix: zoomControl dimatikan
// dari opsi peta dan kontrol zoom dipasang ulang di pojok kanan-atas
// (area yang tidak dipakai NavButtons maupun toggle Peta/Daftar).
// Leaflet di-mock global (lihat src/test/setup.js).

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import L from 'leaflet';
import MapView from './MapView.jsx';

describe('MapView: posisi kontrol zoom (tidak menabrak NavButtons)', () => {
  it('membuat peta tanpa zoomControl bawaan (kiri-atas) dan memasang ulang di topright', () => {
    render(<MapView reports={[]} />);

    // Peta diinisialisasi dengan zoomControl dimatikan.
    expect(L.map).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ zoomControl: false })
    );

    // Kontrol zoom dipasang ulang di pojok kanan-atas, ditambahkan ke peta.
    expect(L.control.zoom).toHaveBeenCalledWith({ position: 'topright' });
    const mapInstance = L.map.mock.results[0].value;
    const zoomControl = L.control.zoom.mock.results[0].value;
    expect(zoomControl.addTo).toHaveBeenCalledWith(mapInstance);
  });
});

describe('MapView: marker laporan approved menampilkan centang (poin Alur Inti 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Laporan approved (status terverifikasi) vs belum (dilaporkan).
  const REPORTS = [
    {
      id: 1,
      lat: -7.2075,
      lng: 107.8881,
      severity: 'berat', // oranye #f97316
      status: 'terverifikasi',
      location_name: 'Jembatan Cibeureum',
      infra_type: 'jembatan',
    },
    {
      id: 2,
      lat: -6.2,
      lng: 106.8,
      severity: 'ringan', // hijau #22c55e
      status: 'dilaporkan',
      location_name: 'Jalan Merdeka',
      infra_type: 'jalan',
    },
  ];

  it('laporan approved dirender sebagai marker divIcon: lingkaran warna severity + centang putih di dalam', () => {
    render(<MapView reports={REPORTS} />);

    // Marker terverifikasi memakai divIcon dengan centang dan warna severity
    // TETAP (berat = oranye) di dalam lingkaran.
    expect(L.divIcon).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('✓'),
      })
    );
    const iconHtml = L.divIcon.mock.calls[0][0].html;
    expect(iconHtml).toContain('#f97316'); // warna severity berat, bukan warna status
    expect(iconHtml).toContain('border-radius:50%');

    // Dibungkus L.marker di koordinat laporan.
    expect(L.marker).toHaveBeenCalledWith(
      [-7.2075, 107.8881],
      expect.objectContaining({ icon: expect.anything() })
    );

    // Laporan belum approved tetap circleMarker warna severity (tanpa centang).
    expect(L.circleMarker).toHaveBeenCalledWith(
      [-6.2, 106.8],
      expect.objectContaining({ fillColor: '#22c55e', radius: 9 })
    );
  });

  it('laporan dalam_perbaikan / selesai_diperbaiki juga dianggap approved (bercentang)', () => {
    render(
      <MapView
        reports={[
          { ...REPORTS[0], id: 3, status: 'dalam_perbaikan' },
          { ...REPORTS[0], id: 4, status: 'selesai_diperbaiki' },
        ]}
      />
    );

    // Keduanya memakai divIcon bercentang, bukan circleMarker.
    expect(L.divIcon).toHaveBeenCalledTimes(2);
    expect(L.marker).toHaveBeenCalledTimes(2);
    expect(L.circleMarker).not.toHaveBeenCalled();
  });
});

describe('MapView: glow severity (poin Alur Inti 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const base = { lat: -7.2, lng: 107.8, location_name: 'X', infra_type: 'jalan', status: 'dilaporkan' };

  it('ambruk (critical) berkedip/glow kuat, sedang & berat glow biasa, ringan (aman) TANPA glow', () => {
    render(
      <MapView
        reports={[
          { ...base, id: 1, severity: 'ambruk' },
          { ...base, id: 2, severity: 'berat' },
          { ...base, id: 3, severity: 'sedang' },
          { ...base, id: 4, severity: 'ringan' },
        ]}
      />
    );

    // Urutan pemanggilan circleMarker sama dengan urutan reports.
    const classes = L.circleMarker.mock.calls.map(([, options]) => options.className);
    expect(classes[0]).toBe('tk-marker-critical'); // ambruk -> berkedip/glow
    expect(classes[1]).toBe('tk-marker-soft'); // berat -> glow biasa
    expect(classes[2]).toBe('tk-marker-soft'); // sedang -> glow biasa
    expect(classes[3]).toBeUndefined(); // ringan -> aman, tidak glow
  });

  it('marker approved (divIcon) ambruk juga memakai glow critical di dalam HTML-nya', () => {
    render(
      <MapView
        reports={[{ ...base, id: 5, severity: 'ambruk', status: 'terverifikasi' }]}
      />
    );
    const iconHtml = L.divIcon.mock.calls[0][0].html;
    expect(iconHtml).toContain('tk-marker-critical');
  });
});

describe('MapView: navigasi bertahap (poin Alur Inti 17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const REPORT = {
    id: 1,
    lat: -7.2075,
    lng: 107.8881,
    severity: 'berat',
    status: 'dilaporkan', // belum approved -> circleMarker
    location_name: 'Jembatan Cibeureum',
    infra_type: 'jembatan',
  };

  it('tanpa riwayat navigasi, tombol Kembali/Awal tidak tampil (tidak mengganggu)', () => {
    render(<MapView reports={[REPORT]} />);
    expect(screen.queryByRole('button', { name: /kembali/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /awal/i })).not.toBeInTheDocument();
  });

  it('klik marker: zoom bertahap (naik dari 5 -> 14, tanpa lompatan) + popup + tombol Kembali muncul di tengah-atas', async () => {
    render(<MapView reports={[REPORT]} />);

    // Ambil handler klik marker yang didaftarkan MapView.
    const marker = L.circleMarker.mock.results[0].value;
    const clickHandler = marker.on.mock.calls.find(([evt]) => evt === 'click')[1];

    await act(async () => clickHandler());

    // Zoom bertahap: dari zoom 5 -> max(5+2,14)=14 -> min(14,16)=14,
    // bukan melompat langsung jauh.
    const map = L.map.mock.results[0].value;
    expect(map.setView).toHaveBeenCalledWith([-7.2075, 107.8881], 14, { animate: true });
    expect(marker.openPopup).toHaveBeenCalled();

    // Tombol navigasi muncul (ada riwayat), di tengah-atas (z-index 1150,
    // di atas popup Leaflet ~700).
    const backBtn = screen.getByRole('button', { name: /kembali/i });
    expect(backBtn).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /awal/i })).toBeInTheDocument();
    const nav = backBtn.closest('div');
    expect(nav.style.zIndex).toBe('1150');
    expect(nav.style.position).toBe('absolute');
  });

  it('tombol Kembali: pop satu tingkat zoom + menutup popup titik laporan', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MapView reports={[REPORT]} />);

    const marker = L.circleMarker.mock.results[0].value;
    const clickHandler = marker.on.mock.calls.find(([evt]) => evt === 'click')[1];
    await act(async () => clickHandler()); // dorong riwayat {center, zoom 5}

    await user.click(screen.getByRole('button', { name: /kembali/i }));

    const map = L.map.mock.results[0].value;
    // Kembali ke posisi sebelum klik marker (pusat awal + zoom 5).
    expect(map.setView).toHaveBeenLastCalledWith({ lat: -2.5, lng: 118 }, 5, { animate: true });
    // Popup laporan ikut ditutup — tidak perlu close manual dulu.
    expect(map.closePopup).toHaveBeenCalled();
  });
});

describe('MapView: tombol "Lihat Detail" di popup marker (modal pada titik)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const REPORT = {
    id: 7,
    lat: -7.2075,
    lng: 107.8881,
    severity: 'ambruk',
    status: 'dilaporkan',
    location_name: 'Jembatan Cibeureum, Garut',
    description: 'Jembatan putus total.',
    infra_type: 'jembatan',
  };

  it('popup marker memuat tombol "Lihat Detail" yang menunjuk id laporan', () => {
    render(<MapView reports={[REPORT]} />);

    const marker = L.circleMarker.mock.results[0].value;
    const popupHtml = marker.bindPopup.mock.calls[0][0];
    expect(popupHtml).toContain('Lihat Detail');
    expect(popupHtml).toContain(`data-id="${REPORT.id}"`);
  });

  it('klik "Lihat Detail" di popup memanggil onOpenDetail dengan laporan lengkap', () => {
    const onOpenDetail = vi.fn();
    render(<MapView reports={[REPORT]} onOpenDetail={onOpenDetail} />);

    // Stub document.querySelector: tombol popup "nyata" di DOM.
    const fakeBtn = { dataset: {}, addEventListener: vi.fn((evt, fn) => (fakeBtn._click = fn)) };
    const qs = vi.spyOn(document, 'querySelector').mockReturnValue(fakeBtn);

    // Picu popupopen -> MapView memasang listener klik pada tombol.
    const marker = L.circleMarker.mock.results[0].value;
    const popupOpenHandler = marker.on.mock.calls.find(([evt]) => evt === 'popupopen')[1];
    act(() => popupOpenHandler());

    expect(fakeBtn.dataset.bound).toBe('1');
    expect(fakeBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

    // Simulasikan klik tombol.
    act(() => fakeBtn._click());

    expect(qs).toHaveBeenCalledWith(`.tk-popup-detail-btn[data-id="${REPORT.id}"]`);
    expect(L.map.mock.results[0].value.closePopup).toHaveBeenCalled();
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});
