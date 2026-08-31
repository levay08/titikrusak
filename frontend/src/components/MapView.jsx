// frontend/src/components/MapView.jsx
// Peta utama titikrusak.id (File 2 Bagian 6.3 langkah ketiga).
// Leaflet.js + tile layer OpenStreetMap standar (File 1 Bagian 7.2).
// Pusat peta: -2.5, 118 dengan zoom menampilkan seluruh Indonesia
// (File 1 Bagian 5.1). Marker berwarna sesuai severity (File 1 6.8.2):
// ringan=hijau, sedang=kuning, berat=oranye, ambruk=merah.
// Data dari GET /api/reports (via proxy Vite ke backend port 3000).

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Warna marker sesuai File 1 Bagian 6.8.2.
const SEVERITY_COLORS = {
  ringan: '#22c55e', // hijau
  sedang: '#eab308', // kuning
  berat: '#f97316',  // oranye
  ambruk: '#ef4444', // merah
};

const SEVERITY_LABELS = {
  ringan: 'Ringan',
  sedang: 'Sedang',
  berat: 'Berat',
  ambruk: 'Ambruk',
};

const INFRA_LABELS = {
  jembatan: 'Jembatan',
  jalan: 'Jalan',
  sekolah: 'Sekolah',
  prasarana_publik: 'Prasarana Publik',
  utilitas: 'Utilitas',
  lainnya: 'Lainnya',
};

const STATUS_LABELS = {
  dilaporkan: 'Dilaporkan',
  terverifikasi: 'Terverifikasi',
  dalam_perbaikan: 'Dalam Perbaikan',
  selesai_diperbaiki: 'Selesai Diperbaiki',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default function MapView() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [error, setError] = useState(null);

  // Inisialisasi peta sekali.
  useEffect(() => {
    if (mapRef.current) return undefined;

    const map = L.map(containerRef.current, {
      center: [-2.5, 118], // pusat Indonesia (File 1 Bagian 5.1)
      zoom: 5,             // menampilkan seluruh Indonesia
      minZoom: 3,
      maxZoom: 18,
      zoomControl: true,   // kontrol zoom in/out standar
    });
    mapRef.current = map;

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Ambil laporan dan render marker.
  useEffect(() => {
    let cancelled = false;

    fetch('/api/reports')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((reports) => {
        if (cancelled) return;
        const map = mapRef.current;
        if (!map) return;

        reports.forEach((report) => {
          const color = SEVERITY_COLORS[report.severity] || '#64748b';
          const marker = L.circleMarker([report.lat, report.lng], {
            radius: 9,
            fillColor: color,
            fillOpacity: 0.85,
            color: '#1f2937', // outline gelap agar kontras di peta
            weight: 1.5,
          }).addTo(map);

          const popupHtml = `
            <strong>${escapeHtml(report.location_name)}</strong><br/>
            Jenis: ${escapeHtml(INFRA_LABELS[report.infra_type] || report.infra_type)}<br/>
            Kerusakan: ${escapeHtml(SEVERITY_LABELS[report.severity] || report.severity)}<br/>
            Status: ${escapeHtml(STATUS_LABELS[report.status] || report.status)}
            ${report.description ? `<br/>${escapeHtml(report.description)}` : ''}
          `;
          marker.bindPopup(popupHtml);
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: '#dc2626',
            color: '#fff',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          Gagal memuat laporan: {error}
        </div>
      )}
    </div>
  );
}
