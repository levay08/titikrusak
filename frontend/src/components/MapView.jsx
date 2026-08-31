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
// Plugin resmi Leaflet.markercluster (File 1 Bagian 9.4).
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

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

// Urutan tampil legend (File 1 Bagian 9.3).
const SEVERITY_ORDER = ['ringan', 'sedang', 'berat', 'ambruk'];

// Enam opsi sorting FilterPanel (File 1 Bagian 6.8.10) -> pasangan
// sort/order yang dipahami backend GET /api/reports (File 1 Bagian 7.4).
const SORT_PARAMS = {
  terbaru: ['created_at', 'desc'],
  terlama: ['created_at', 'asc'],
  terparah: ['severity', 'desc'],
  teringan: ['severity', 'asc'],
  lokasi_az: ['location_name', 'asc'],
  lokasi_za: ['location_name', 'desc'],
};

const EMPTY_FILTERS = {
  severity: [],
  infra_type: [],
  bridge_authority: [],
  vital_status: [],
  q: '',
  sort: 'terbaru',
};

// Bangun query string GET /api/reports dari state filter.
function buildQuery(filters) {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const p = new URLSearchParams();
  ['severity', 'infra_type', 'bridge_authority', 'vital_status'].forEach((key) => {
    (f[key] || []).forEach((v) => p.append(key, v));
  });
  if (f.q && f.q.trim()) p.set('q', f.q.trim());
  const [sort, order] = SORT_PARAMS[f.sort] || SORT_PARAMS.terbaru;
  p.set('sort', sort);
  p.set('order', order);
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Definisi singkat tiap tingkat kerusakan, diringkas dari tabel lengkap
// File 1 Bagian 6.8.2 (yang dirujuk oleh Bagian 9.3).
const SEVERITY_DEFINITIONS = {
  ringan:
    'Kerusakan kosmetik atau kecil; infrastruktur masih aman dilalui atau dipakai tanpa risiko berarti terhadap keselamatan.',
  sedang:
    'Kerusakan struktural ringan yang mulai mengganggu fungsi; masih dapat dipakai dengan kehati-hatian, belum mengancam jiwa secara langsung.',
  berat:
    'Kerusakan struktural signifikan yang mengarah ke bahaya nyata bagi keselamatan; sangat berisiko, sebaiknya dihindari kecuali darurat.',
  ambruk:
    'Mengancam jiwa secara aktif; infrastruktur putus total, roboh, atau akses terputus — tidak boleh didekati atau dilalui sama sekali.',
};

// Batas pandang peta (File 1 Bagian 9.1): seluruh Indonesia plus sedikit
// toleransi di tepi agar peta tidak bisa digeser jauh keluar wilayah.
const INDONESIA_BOUNDS = L.latLngBounds([-11, 95], [6, 141]);
const VIEW_LIMITS = L.latLngBounds([-12, 94], [7, 142]);

// Tampilan awal (File 1 Bagian 5.1) — dipakai kembali oleh tombol
// "Kembali ke Tampilan Awal".
const HOME_CENTER = [-2.5, 118];
const HOME_ZOOM = 5;

// Rentang vertikal Mercator (dalam "derajat ekuator") antara dua lintang.
function mercatorYSpan(south, north) {
  const toMerc = (lat) =>
    (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return toMerc(north) - toMerc(south);
}

// Zoom terbesar yang masih memuat seluruh bounds di dalam viewport
// berukuran size dengan padding; dipakai menghitung minZoom agar Indonesia
// tidak pernah tampak terlalu kecil saat di-zoom out.
function zoomToFit(size, bounds, paddingPx) {
  const availW = size.x - 2 * paddingPx;
  const availH = size.y - 2 * paddingPx;
  if (availW <= 0 || availH <= 0) return 1;
  const zLon = Math.log2((availW * 360) / (256 * (bounds.getEast() - bounds.getWest())));
  const zLat = Math.log2((availH * 360) / (256 * mercatorYSpan(bounds.getSouth(), bounds.getNorth())));
  return Math.min(zLon, zLat);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Kotak kecil di pojok kiri atas peta: kembali ke tampilan awal seluruh
// Indonesia (center [-2.5, 118], zoom 5) setelah pengguna zoom ke
// cluster/marker tertentu (File 1 Bagian 9.1).
function ResetViewButton({ onReset }) {
  return (
    <button
      type="button"
      onClick={onReset}
      title="Kembali ke tampilan awal (seluruh Indonesia)"
      style={{
        position: 'absolute',
        left: 12,
        top: 12,
        zIndex: 1000,
        background: '#fff',
        border: '1px solid #cbd5e1',
        borderRadius: 6,
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
        padding: '6px 10px',
        fontSize: 12.5,
        fontWeight: 600,
        color: '#0f172a',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1 }}>⟲</span>
      Kembali ke Tampilan Awal
    </button>
  );
}

// Legend warna tingkat kerusakan + ikon info definisi (File 1 Bagian 9.3).
// Kotak kecil di pojok kanan bawah; klik atau hover ikon info menampilkan
// definisi singkat tiap kategori.
function SeverityLegend() {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 40, // di atas kontrol attribution Leaflet (kanan bawah)
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 8,
        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.35)',
        padding: '10px 12px',
        fontSize: 13,
        color: '#0f172a',
        maxWidth: 300,
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1 }}>Tingkat Kerusakan</strong>
        <button
          type="button"
          onClick={toggle}
          aria-label="Tampilkan definisi tingkat kerusakan"
          title="Definisi tingkat kerusakan"
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            color: '#334155',
            padding: 2,
          }}
        >
          ⓘ
        </button>
      </div>

      {SEVERITY_ORDER.map((sev) => (
        <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              background: SEVERITY_COLORS[sev],
              border: '1px solid #1f2937',
              flexShrink: 0,
            }}
          />
          <span>{SEVERITY_LABELS[sev]}</span>
        </div>
      ))}

      {open && (
        <div style={{ marginTop: 8, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
          {SEVERITY_ORDER.map((sev) => (
            <div key={sev} style={{ marginBottom: 6, lineHeight: 1.35 }}>
              <strong>{SEVERITY_LABELS[sev]}:</strong> {SEVERITY_DEFINITIONS[sev]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapView({ refreshKey = 0, filters, onResetFilters }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const [error, setError] = useState(null);
  const [reports, setReports] = useState([]);

  // Inisialisasi peta sekali.
  useEffect(() => {
    if (mapRef.current) return undefined;

    const el = containerRef.current;
    const size =
      el.clientWidth > 0 && el.clientHeight > 0
        ? { x: el.clientWidth, y: el.clientHeight }
        : null;

    // minZoom dihitung dari ukuran viewport: zoom terendah yang masih
    // memuat batas pandang (Indonesia + toleransi) secara proporsional,
    // sehingga Indonesia tidak pernah tampak sebagai titik kecil.
    const minZoom = size
      ? Math.max(3, Math.floor(zoomToFit(size, VIEW_LIMITS, 32)))
      : 4;

    const map = L.map(el, {
      center: [-2.5, 118], // pusat Indonesia (File 1 Bagian 5.1)
      zoom: 5,             // sementara; disesuaikan fitBounds di bawah
      minZoom,
      maxZoom: 18,
      zoomControl: true,   // kontrol zoom in/out standar
      maxBounds: VIEW_LIMITS,        // batas geser: Indonesia + toleransi (9.1)
      maxBoundsViscosity: 1.0,       // "memantul" halus, tidak berhenti kaku
    });
    mapRef.current = map;

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Tampilan awal: wilayah Indonesia memenuhi area pandang dengan
    // proporsi yang pas, berapa pun ukuran layar.
    if (size) {
      map.fitBounds(INDONESIA_BOUNDS, { padding: [24, 24] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Ambil laporan dan render marker. Di-refresh otomatis saat refreshKey
  // berubah (setelah submit laporan baru) atau saat filter berubah
  // (real-time, tanpa reload).
  useEffect(() => {
    let cancelled = false;

    const query = buildQuery(filters);
    fetch(`/api/reports${query}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setReports(data); // dipakai untuk kondisi hasil kosong
        const map = mapRef.current;
        if (!map) return;

        // Buang group marker lama (jika ada) sebelum render ulang —
        // dipakai saat refreshKey berubah setelah laporan baru terkirim.
        if (clusterGroupRef.current) {
          map.removeLayer(clusterGroupRef.current);
          clusterGroupRef.current = null;
        }

        // Marker cluster group dari plugin resmi (File 1 Bagian 9.4).
        const clusterGroup = L.markerClusterGroup();
        clusterGroupRef.current = clusterGroup;

        data.forEach((report) => {
          const color = SEVERITY_COLORS[report.severity] || '#64748b';
          const marker = L.circleMarker([report.lat, report.lng], {
            radius: 9,
            fillColor: color,
            fillOpacity: 0.85,
            // Outline putih tebal agar warna severity tetap kontras di atas
            // tile peta berwarna serupa (hijau vegetasi, kuning/krem area
            // terbangun) — File 1 Bagian 9.3.
            color: '#ffffff',
            weight: 3,
          });

          const popupHtml = `
            <strong>${escapeHtml(report.location_name)}</strong><br/>
            Jenis: ${escapeHtml(INFRA_LABELS[report.infra_type] || report.infra_type)}<br/>
            Kerusakan: ${escapeHtml(SEVERITY_LABELS[report.severity] || report.severity)}<br/>
            Status: ${escapeHtml(STATUS_LABELS[report.status] || report.status)}
            ${report.description ? `<br/>${escapeHtml(report.description)}` : ''}
          `;
          marker.bindPopup(popupHtml);

          // Semua marker masuk ke markerClusterGroup (File 1 Bagian 9.4):
          // saat zoom-out, marker berdekatan menyatu jadi cluster dengan
          // angka jumlah laporan; saat zoom-in atau cluster diklik, cluster
          // pecah kembali menjadi marker individual (perilaku default plugin).
          clusterGroup.addLayer(marker);
        });

        clusterGroup.addTo(map);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, filters]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      <ResetViewButton onReset={() => mapRef.current?.setView(HOME_CENTER, HOME_ZOOM)} />
      <SeverityLegend />

      {/* Kondisi hasil kosong (File 1 Bagian 9.1): filter tidak menemukan
          laporan -> kartu pesan + tombol Reset Filter. */}
      {!error && reports.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.97)',
            borderRadius: 10,
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.25)',
            padding: '18px 22px',
            textAlign: 'center',
            maxWidth: 340,
          }}
        >
          <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            Tidak ada laporan yang sesuai dengan filter ini
          </p>
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reset Filter
            </button>
          )}
        </div>
      )}

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
