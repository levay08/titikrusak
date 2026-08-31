// frontend/src/components/MapView.test.jsx
// Tes perbaikan responsif (File 1 Bagian 9.7): kontrol zoom Leaflet
// bawaan menempel di pojok kiri-atas dan bertabrakan dengan tombol
// navigasi (← / ⟲) di semua ukuran layar. Fix: zoomControl dimatikan
// dari opsi peta dan kontrol zoom dipasang ulang di pojok kanan-atas
// (area yang tidak dipakai NavButtons maupun toggle Peta/Daftar).
// Leaflet di-mock global (lihat src/test/setup.js).

import { describe, it, expect, vi } from 'vitest';
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
