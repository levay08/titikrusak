// frontend/src/test/setup.js
// Setup global untuk tes vitest: mock modul Leaflet agar MapView dan
// mini-map di ReportForm bisa dirender di jsdom (Leaflet asli butuh
// layout DOM nyata), dan stub CSS.

import { vi } from 'vitest';

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
      })),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      // Marker draggable pada mini-map pemilih lokasi (ReportForm).
      // addTo chainable (Leaflet asli mengembalikan `this`).
      marker: vi.fn(function () {
        return {
          addTo: vi.fn(function () {
            return this;
          }),
          on: vi.fn(),
          getLatLng: vi.fn(() => ({ lat: -2.5, lng: 118 })),
          setLatLng: vi.fn(),
        };
      }),
      divIcon: vi.fn(() => ({})),
      circleMarker: vi.fn(() => ({ bindPopup: vi.fn() })),
      markerClusterGroup: vi.fn(() => ({
        addLayer: vi.fn(),
        addTo: vi.fn(),
        remove: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      })),
    },
  };
});

vi.mock('leaflet.markercluster', () => ({}));
