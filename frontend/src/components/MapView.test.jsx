// frontend/src/components/MapView.test.jsx
// Tes perbaikan responsif (File 1 Bagian 9.7): kontrol zoom Leaflet
// bawaan menempel di pojok kiri-atas dan bertabrakan dengan tombol
// navigasi (← / ⟲) di semua ukuran layar. Fix: zoomControl dimatikan
// dari opsi peta dan kontrol zoom dipasang ulang di pojok kanan-atas
// (area yang tidak dipakai NavButtons maupun toggle Peta/Daftar).
// Leaflet di-mock global (lihat src/test/setup.js).

import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
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

  it('tombol Awal: fitBounds seluruh Indonesia (Sumatera–Papua utuh) + bersihkan riwayat', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<MapView reports={[REPORT]} />);

    const marker = L.circleMarker.mock.results[0].value;
    const clickHandler = marker.on.mock.calls.find(([evt]) => evt === 'click')[1];
    await act(async () => clickHandler()); // dorong riwayat

    await user.click(screen.getByRole('button', { name: /awal/i }));

    const map = L.map.mock.results[0].value;
    // Tampilan awal = fitBounds (bukan setView) agar Indonesia utuh.
    expect(map.fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ maxZoom: 7 })
    );
    // Riwayat navigasi dibersihkan -> tombol Kembali hilang.
    expect(screen.queryByRole('button', { name: /kembali/i })).not.toBeInTheDocument();
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

  it('klik "Lihat Detail" di popup membuka DetailModal via delegasi klik di container peta', () => {
    const onOpenDetail = vi.fn();
    const { container: wrap } = render(
      <MapView reports={[REPORT]} onOpenDetail={onOpenDetail} />
    );

    // Simulasikan tombol popup yang benar-benar ada di DOM container peta.
    const mapContainer = wrap.firstChild.firstChild; // div ref={containerRef}
    const btn = document.createElement('button');
    btn.className = 'tk-popup-detail-btn';
    btn.dataset.id = String(REPORT.id);
    mapContainer.appendChild(btn);

    fireEvent.click(btn);

    const map = L.map.mock.results[0].value;
    expect(map.closePopup).toHaveBeenCalled();
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
    expect(onOpenDetail).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
  });
});

describe('MapView: hover tooltip jumlah titik + provinsi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const REPORT = {
    id: 9,
    lat: -7.2075,
    lng: 107.8881, // Jawa Barat
    severity: 'berat',
    status: 'dilaporkan',
    location_name: 'Jembatan Cibeureum',
    infra_type: 'jembatan',
  };

  it('marker diberi tooltip "1 titik rusak — {provinsi}"', () => {
    render(<MapView reports={[REPORT]} />);

    const marker = L.circleMarker.mock.results[0].value;
    expect(marker.bindTooltip).toHaveBeenCalledWith(
      expect.stringContaining('1 titik rusak'),
      expect.objectContaining({ direction: 'top' })
    );
    expect(marker.bindTooltip.mock.calls[0][0]).toContain('Jawa Barat');
  });

  it('hover cluster membuka tooltip jumlah titik + provinsi dan menutup saat keluar', () => {
    render(<MapView reports={[REPORT]} />);

    const clusterGroup = L.markerClusterGroup.mock.results[0].value;
    const over = clusterGroup.on.mock.calls.find(([evt]) => evt === 'clustermouseover')[1];
    const out = clusterGroup.on.mock.calls.find(([evt]) => evt === 'clustermouseout')[1];
    expect(over).toBeTypeOf('function');
    expect(out).toBeTypeOf('function');

    act(() =>
      over({ layer: { getChildCount: () => 5, getLatLng: () => ({ lat: -7.2, lng: 107.8 }) } })
    );

    const map = L.map.mock.results[0].value;
    expect(map.openTooltip).toHaveBeenCalledWith(
      expect.stringContaining('5 titik rusak'),
      { lat: -7.2, lng: 107.8 },
      expect.objectContaining({ direction: 'top' })
    );
    expect(map.openTooltip.mock.calls[0][0]).toContain('Jawa Barat');

    act(() => out());
    expect(map.closeTooltip).toHaveBeenCalled();
  });

  it('cluster memakai warna biru tua, bukan warna severity di legend', () => {
    render(<MapView reports={[REPORT]} />);

    const opts = L.markerClusterGroup.mock.calls[0][0];
    expect(opts.iconCreateFunction).toBeTypeOf('function');

    const icon = opts.iconCreateFunction({ getChildCount: () => 12 });
    expect(icon.html).toContain('#1e3a8a');
    expect(icon.html).toContain('>12<');
    // Tidak memakai warna severity (legend Tingkat Kerusakan).
    expect(icon.html).not.toContain('#22c55e');
    expect(icon.html).not.toContain('#eab308');
    expect(icon.html).not.toContain('#f97316');
    expect(icon.html).not.toContain('#ef4444');
  });
});

describe('MapView: slider zoom (tengah-bawah, geser untuk zoom in/out)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('menampilkan slider zoom (default = zoom awal) dan geser memanggil setZoom', () => {
    render(<MapView reports={[]} />);

    const slider = screen.getByRole('slider', { name: /zoom peta/i });
    expect(slider).toBeInTheDocument();
    // Default = zoom peta saat ini (mock getZoom -> 5).
    expect(slider).toHaveValue('5');

    fireEvent.change(slider, { target: { value: '10' } });
    expect(L.map.mock.results[0].value.setZoom).toHaveBeenCalledWith(10);
  });

  it('persentase zoom tampil saat slider digeser', () => {
    render(<MapView reports={[]} />);
    const slider = screen.getByRole('slider', { name: /zoom peta/i });

    fireEvent.pointerDown(slider);
    // zoom 5 dari rentang 3-18 -> 13%.
    expect(screen.getByText('13%')).toBeInTheDocument();
    fireEvent.pointerUp(slider);
    expect(screen.queryByText('13%')).not.toBeInTheDocument();
  });
});
