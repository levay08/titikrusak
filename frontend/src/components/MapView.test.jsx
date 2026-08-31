// frontend/src/components/MapView.test.jsx
// Tes perbaikan responsif (File 1 Bagian 9.7): kontrol zoom Leaflet
// bawaan menempel di pojok kiri-atas dan bertabrakan dengan tombol
// navigasi (← / ⟲) di semua ukuran layar. Fix: zoomControl dimatikan
// dari opsi peta dan kontrol zoom dipasang ulang di pojok kanan-atas
// (area yang tidak dipakai NavButtons maupun toggle Peta/Daftar).
// Leaflet di-mock global (lihat src/test/setup.js).

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
