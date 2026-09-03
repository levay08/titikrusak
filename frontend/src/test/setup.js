// frontend/src/test/setup.js
// Setup global untuk tes vitest: mock modul Leaflet agar MapView dan
// mini-map di ReportForm bisa dirender di jsdom (Leaflet asli butuh
// layout DOM nyata), dan stub CSS.

import { vi } from 'vitest';

// Modal selamat datang hanya untuk kunjungan pertama per tab - preset flag
// sessionStorage di test agar App.test dkk tidak terganggu overlay welcome.
try {
  sessionStorage.setItem('titikrusak_welcome_seen', '1');
} catch (_e) {
  // abaikan bila sessionStorage tidak tersedia
}

// matchMedia tidak ada di jsdom - stub agar komponen yang memakai
// useIsMobile bisa dirender (default desktop: matches=false).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('leaflet', () => {
  const latLngBounds = () => ({
    getEast: () => 142,
    getWest: () => 94,
    getSouth: () => -12,
    getNorth: () => 7,
    contains: () => true,
  });

  return {
    default: {
      latLngBounds,
      map: vi.fn(() => ({
        fitBounds: vi.fn(),
        setView: vi.fn(),
        remove: vi.fn(),
        addLayer: vi.fn(),
        removeLayer: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        getZoom: vi.fn(() => 5),
        getMinZoom: vi.fn(() => 3),
        getMaxZoom: vi.fn(() => 18),
        setZoom: vi.fn(),
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        getCenter: vi.fn(() => ({ lat: -2.5, lng: 118 })),
        closePopup: vi.fn(),
        openTooltip: vi.fn(),
        closeTooltip: vi.fn(),
      })),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      // Kontrol zoom dipasang ulang di pojok kanan-atas (MapView);
      // addTo chainable seperti Leaflet asli.
      control: {
        zoom: vi.fn(() => ({ addTo: vi.fn() })),
      },
      // Marker draggable pada mini-map pemilih lokasi (ReportForm).
      // addTo chainable (Leaflet asli mengembalikan `this`). bindPopup
      // juga dipakai marker terverifikasi di MapView (divIcon + centang).
      marker: vi.fn(function () {
        return {
          addTo: vi.fn(function () {
            return this;
          }),
          on: vi.fn(),
          getLatLng: vi.fn(() => ({ lat: -2.5, lng: 118 })),
          setLatLng: vi.fn(),
          bindPopup: vi.fn(),
          bindTooltip: vi.fn(),
          openPopup: vi.fn(),
        };
      }),
      divIcon: vi.fn((opts) => opts ?? {}),
      circleMarker: vi.fn(() => ({
        bindPopup: vi.fn(),
        bindTooltip: vi.fn(),
        on: vi.fn(),
        openPopup: vi.fn(),
      })),
      markerClusterGroup: vi.fn(() => ({
        addLayer: vi.fn(),
        addTo: vi.fn(),
        remove: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        bindTooltip: vi.fn(),
      })),
    },
  };
});

vi.mock('leaflet.markercluster', () => ({}));
