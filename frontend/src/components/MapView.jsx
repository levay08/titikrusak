// frontend/src/components/MapView.jsx
// Peta utama titikrusak.id (File 2 Bagian 6.3 langkah ketiga).
// Leaflet.js + tile layer OpenStreetMap standar (File 1 Bagian 7.2).
// Pusat peta: -2.5, 118 dengan zoom menampilkan seluruh Indonesia
// (File 1 Bagian 5.1). Marker berwarna sesuai severity (File 1 6.8.2):
// ringan=hijau, sedang=kuning, berat=oranye, ambruk=merah.
//
// Mode tampilan "Peta": data laporan TIDAK di-fetch di sini — diterima
// sebagai props dari App (satu sumber data yang sama dengan ListView,
// hasil filter/sorting aktif). Lihat ListView.jsx untuk mode "Daftar".

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// Plugin resmi Leaflet.markercluster (File 1 Bagian 9.4).
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  SEVERITY_DEFINITIONS,
  INFRA_LABELS,
  STATUS_LABELS,
} from '../lib/labels.js';
import useIsMobile from '../lib/useIsMobile.js';
import { detectProvince } from '../lib/regions.js';
import EmptyResults from './EmptyResults.jsx';
import DetailModal from './DetailModal.jsx';

// Batas pandang peta (File 1 Bagian 9.1): seluruh Indonesia plus sedikit
// toleransi di tepi agar peta tidak bisa digeser jauh keluar wilayah.
const VIEW_LIMITS = L.latLngBounds([-12, 94], [7, 142]);

// Tampilan awal (File 1 Bagian 5.1) — dipakai kembali oleh tombol
// "Kembali ke Tampilan Awal". fitBounds dengan bounds PERSIS Indonesia
// (tanpa margin berlebih) agar peta terisi 100% layar — Sumatra & Papua
// tetap utuh, space kosong di samping/atas-bawah diminimalkan.
const HOME_BOUNDS = L.latLngBounds([-11, 95], [6, 141]);
const HOME_PADDING = [6, 6];
const HOME_MAX_ZOOM = 7;

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

// Tombol navigasi peta (File 1 Bagian 9.1/9.4, poin Alur Inti 17):
// muncul hanya saat ADA riwayat navigasi (sudah masuk cluster/titik),
// diposisikan di TENGAH-ATAS (di bawah toggle Peta/Daftar) agar terlihat
// jelas namun tidak mengganggu. zIndex 1150 — di atas popup Leaflet
// (z ~700), sehingga tombol tetap terlihat & bisa diklik walau popup
// titik laporan sedang terbuka (tidak perlu menutup popup dulu).
function NavButtons({ canGoBack, onBack, onHome, isMobile }) {
  if (!canGoBack) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: isMobile ? 52 : 58,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1150,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
      }}
    >
      <button
        type="button"
        onClick={onBack}
        title="Kembali satu tingkat zoom"
        style={{
          padding: '8px 14px',
          borderRadius: 999,
          border: 'none',
          background: '#facc15',
          color: '#1c1917',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>←</span> Kembali
      </button>
      <button
        type="button"
        onClick={onHome}
        title="Kembali ke tampilan awal (seluruh Indonesia)"
        style={{
          padding: '8px 12px',
          borderRadius: 999,
          border: '1px solid #cbd5e1',
          background: 'rgba(255, 255, 255, 0.95)',
          color: '#1c1917',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>⟲</span> Awal
      </button>
    </div>
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
        color: '#1c1917',
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

// Slider zoom peta: diposisikan di TENGAH-BAWAH area peta (di atas area
// footer), bisa digeser untuk zoom in/out. Posisi default = zoom tampilan
// awal (fit-screen); saat digeser muncul bubble persentase (0% = zoom min,
// 100% = zoom max).
function ZoomSlider({ map }) {
  const [zoom, setZoom] = useState(() => (map ? map.getZoom() : 6));
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!map) return undefined;
    const sync = () => setZoom(map.getZoom());
    sync();
    map.on('zoomend', sync);
    map.on('zoom', sync);
    return () => {
      map.off('zoomend', sync);
      map.off('zoom', sync);
    };
  }, [map]);

  if (!map) return null;
  const min = typeof map.getMinZoom === 'function' ? map.getMinZoom() : 3;
  const max = typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : 18;
  const pct = Math.round(((zoom - min) / (max - min)) * 100);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 999,
        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.3)',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 13, color: '#475569', lineHeight: 1 }}>−</span>
      <input
        type="range"
        aria-label="Zoom peta"
        min={min}
        max={max}
        value={zoom}
        onChange={(e) => map.setZoom(Number(e.target.value))}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onPointerLeave={() => setDragging(false)}
        style={{ width: 180, accentColor: '#eab308', cursor: 'pointer', margin: 0 }}
      />
      <span style={{ fontSize: 13, color: '#475569', lineHeight: 1 }}>+</span>
      {dragging && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1c1917',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {pct}%
        </span>
      )}
    </div>
  );
}

export default function MapView({
  reports = [],
  error = null,
  onResetFilters,
  hasAnyData = null, // null = total belum diketahui (jangan render empty state)
  onOpenReportForm,
  // Detail laporan (poin: "modal pada titik bisa dilihat detail"): saat
  // prop onOpenDetail diberikan (dari App), MapView menyerahkan pembukaan
  // modal ke App agar hanya SATU modal terbuka; tanpa prop, MapView
  // membuka DetailModal internal (fallback mandiri).
  onOpenDetail = null,
  otoritas = null, // sesi otoritas aktif (untuk tindakan status di detail)
  onReportUpdated = () => {},
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const isMobile = useIsMobile();
  // Laporan yang sedang dibuka detailnya (fallback internal MapView).
  const [selected, setSelected] = useState(null);
  // Peta sudah diinisialisasi (untuk merender kontrol yang butuh instance).
  const [mapReady, setMapReady] = useState(false);
  // Riwayat navigasi zoom (File 1 Bagian 9.1): array {center, zoom} yang
  // didorong setiap kali pengguna zoom in ke cluster/marker; tombol
  // "Kembali" mem-pop satu langkah.
  const [navHistory, setNavHistory] = useState([]);
  const navHistoryRef = useRef([]);

  const pushNav = (center, zoom) => {
    const next = [...navHistoryRef.current, { center, zoom }];
    if (next.length > 20) next.shift(); // batasi riwayat
    navHistoryRef.current = next;
    setNavHistory(next);
  };

  const goBack = () => {
    const history = navHistoryRef.current;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    navHistoryRef.current = history.slice(0, -1);
    setNavHistory(navHistoryRef.current);
    mapRef.current?.setView(prev.center, prev.zoom, { animate: true });
    // Popup titik laporan ikut ditutup agar tidak menghalangi navigasi.
    mapRef.current?.closePopup();
  };

  const goHome = () => {
    navHistoryRef.current = [];
    setNavHistory([]);
    mapRef.current?.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, maxZoom: HOME_MAX_ZOOM });
  };

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
      // Kontrol zoom default Leaflet menempel di pojok KIRI-ATAS — tepat di
      // bawah/sekitar tombol navigasi NavButtons (File 1 Bagian 9.1), sehingga
      // di layar sempit tombol +/− terlihat "tumpang tindih" dengan ← dan ⟲.
      // Matikan bawaan lalu pasang ulang di pojok kanan-atas (area kosong).
      zoomControl: false,
      maxBounds: VIEW_LIMITS,        // batas geser: Indonesia + toleransi (9.1)
      maxBoundsViscosity: 1.0,       // "memantul" halus, tidak berhenti kaku
    });
    mapRef.current = map;
    setMapReady(true);

    // Kontrol zoom in/out standar — dipindah ke kanan-atas agar tidak pernah
    // bertabrakan dengan NavButtons (kiri-atas) maupun toggle Peta/Daftar
    // (tengah-atas) di semua ukuran layar.
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Tampilan awal: seluruh Indonesia utuh (Sumatera–Papua) — fitBounds,
    // bukan setView zoom tetap, agar tidak terpotong di layar sempit.
    map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, maxZoom: HOME_MAX_ZOOM });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render marker dari props reports (satu sumber data dengan ListView).
  // Effect berjalan ulang setiap data baru (filter berubah, laporan baru,
  // dll.) — tanpa reload manual.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Buang group marker lama (jika ada) sebelum render ulang.
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
      clusterGroupRef.current = null;
    }

    // Marker cluster group dari plugin resmi (File 1 Bagian 9.4).
    // zoomToBoundsOnClick (default true, dibuat eksplisit): klik cluster
    // -> zoom in halus (animated) ke area cluster tersebut.
    const clusterGroup = L.markerClusterGroup({ zoomToBoundsOnClick: true });
    clusterGroupRef.current = clusterGroup;

    // Klik cluster: catat posisi peta SEBELUM zoom ke riwayat navigasi,
    // sehingga tombol "Kembali" bisa memulihkan satu langkah.
    clusterGroup.on('clusterclick', () => {
      const map = mapRef.current;
      if (map) pushNav(map.getCenter(), map.getZoom());
    });

    // Hover cluster -> tooltip: jumlah titik rusak + provinsi di area itu.
    clusterGroup.on('clustermouseover', (e) => {
      const map = mapRef.current;
      if (!map || !e.layer || typeof e.layer.getChildCount !== 'function') return;
      const count = e.layer.getChildCount();
      const ll = e.layer.getLatLng();
      const prov = detectProvince(ll.lat, ll.lng);
      map.openTooltip(
        `<b>${count} titik rusak</b>${prov ? ` — ${prov}` : ''}`,
        ll,
        { direction: 'top', offset: [0, -10], opacity: 0.95 }
      );
    });
    clusterGroup.on('clustermouseout', () => {
      mapRef.current?.closeTooltip();
    });

    // Status yang berarti laporan sudah di-approve/verified oleh otoritas
    // (File 1 Bagian 6.2): marker menampilkan centang DI DALAM lingkaran,
    // sementara warna titik TETAP mengikuti tingkat kerusakan (6.8.2).
    const APPROVED_STATUSES = ['terverifikasi', 'dalam_perbaikan', 'selesai_diperbaiki'];

    // Glow severity (poin Alur Inti 8): ambruk (critical) berkedip/glow
    // kuat menandakan urgensi; sedang & berat glow biasa; ringan (aman)
    // TANPA glow. Kelas CSS di index.css.
    const GLOW_CLASS = {
      ambruk: 'tk-marker-critical',
      berat: 'tk-marker-soft',
      sedang: 'tk-marker-soft',
      ringan: '',
    };

    reports.forEach((report) => {
      const color = SEVERITY_COLORS[report.severity] || '#64748b';
      const approved = APPROVED_STATUSES.includes(report.status);
      const glowClass = GLOW_CLASS[report.severity] || '';

      let marker;
      if (approved) {
        // Marker terverifikasi: lingkaran warna severity + centang putih di
        // tengah. divIcon dipakai karena karakter ✓ tidak bisa dirender di
        // dalam path circleMarker (SVG).
        const icon = L.divIcon({
          className: '',
          html: `<div class="${glowClass}" style="width:26px;height:26px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;line-height:1">✓</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        marker = L.marker([report.lat, report.lng], { icon });
      } else {
        marker = L.circleMarker([report.lat, report.lng], {
          radius: 9,
          fillColor: color,
          fillOpacity: 0.85,
          // Outline putih tebal agar warna severity tetap kontras di atas
          // tile peta berwarna serupa (hijau vegetasi, kuning/krem area
          // terbangun) — File 1 Bagian 9.3.
          color: '#ffffff',
          weight: 3,
          // Glow severity via CSS class pada path SVG (Leaflet Path option).
          className: glowClass || undefined,
        });
      }

      // Klik marker individual: catat posisi sebelum zoom, lalu zoom in
      // BERTAHAP — naik 2 level dari zoom saat ini (minimal level jalan
      // 14, maksimal 16) agar lokasi persis titik terlihat bersama konteks
      // area sekitarnya, tanpa lompatan zoom yang terasa "terpental".
      marker.on('click', () => {
        const map = mapRef.current;
        if (!map) return;
        pushNav(map.getCenter(), map.getZoom());
        const targetZoom = Math.min(Math.max(map.getZoom() + 2, 14), 16);
        map.setView([report.lat, report.lng], targetZoom, { animate: true });
        marker.openPopup();
      });

      const popupHtml = `
        <strong>${escapeHtml(report.location_name)}</strong><br/>
        Jenis: ${escapeHtml(INFRA_LABELS[report.infra_type] || report.infra_type)}<br/>
        Kerusakan: ${escapeHtml(SEVERITY_LABELS[report.severity] || report.severity)}<br/>
        Status: ${escapeHtml(STATUS_LABELS[report.status] || report.status)}
        ${report.description ? `<br/>${escapeHtml(report.description)}` : ''}
        <br/>
        <button type="button" class="tk-popup-detail-btn" data-id="${report.id}"
          style="margin-top:8px;padding:7px 14px;border-radius:8px;border:none;
                 background:#facc15;color:#1c1917;font-size:13px;font-weight:700;
                 cursor:pointer;width:100%">Lihat Detail</button>
      `;
      marker.bindPopup(popupHtml, { maxWidth: 260 });

      // Hover marker -> tooltip: jumlah titik + provinsi (poin: tiap titik
      // punya hover bubble berisi berapa titik rusak di provinsi mana).
      // sticky: tooltip mengikuti kursor dan HILANG saat kursor keluar
      // dari marker (perbaikan: sebelumnya tooltip "stay" setelah un-hover).
      const prov = detectProvince(report.lat, report.lng);
      marker.bindTooltip(
        `<b>1 titik rusak</b>${prov ? ` — ${prov}` : ''}`,
        { direction: 'top', offset: [0, -8], opacity: 0.95, sticky: true }
      );

      // Tombol "Lihat Detail" di popup -> DetailModal penuh (semua info +
      // foto + tindakan otoritas). Listener dipasang tiap popup terbuka
      // (popup dirender ulang setiap kali dibuka).
      marker.on('popupopen', () => {
        const btn = document.querySelector(`.tk-popup-detail-btn[data-id="${report.id}"]`);
        if (btn && !btn.dataset.bound) {
          btn.dataset.bound = '1';
          btn.addEventListener('click', () => {
            const map = mapRef.current;
            if (map) map.closePopup();
            if (onOpenDetail) {
              onOpenDetail(report);
            } else {
              setSelected(report);
            }
          });
        }
      });

      // Semua marker masuk ke markerClusterGroup (File 1 Bagian 9.4):
      // saat zoom-out, marker berdekatan menyatu jadi cluster dengan
      // angka jumlah laporan; saat zoom-in atau cluster diklik, cluster
      // pecah kembali menjadi marker individual (perilaku default plugin).
      clusterGroup.addLayer(marker);
    });

    clusterGroup.addTo(map);
  }, [reports]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      <NavButtons canGoBack={navHistory.length > 0} onBack={goBack} onHome={goHome} isMobile={isMobile} />
      <SeverityLegend />
      {mapReady && <ZoomSlider map={mapRef.current} />}

      {/* Kondisi hasil kosong (File 1 Bagian 9.1/9.2) — sama dengan
          ListView; hasAnyData membedakan DB kosong vs filter tak cocok */}
      {!error && reports.length === 0 && hasAnyData !== null && (
        <EmptyResults
          hasAnyData={hasAnyData}
          onResetFilters={onResetFilters}
          onLapor={onOpenReportForm}
        />
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

      {/* Detail laporan penuh (fallback internal MapView; saat App memberi
          onOpenDetail, modal dibuka dari App agar hanya satu modal aktif) */}
      {selected && (
        <DetailModal
          report={selected}
          onClose={() => setSelected(null)}
          otoritas={otoritas}
          onReportUpdated={onReportUpdated}
        />
      )}
    </div>
  );
}
