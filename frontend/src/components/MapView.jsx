// frontend/src/components/MapView.jsx
// Peta utama titikrusak.id (File 2 Bagian 6.3 langkah ketiga).
// Leaflet.js + tile layer OpenStreetMap standar (File 1 Bagian 7.2).
// Pusat peta: -2.5, 118 dengan zoom menampilkan seluruh Indonesia
// (File 1 Bagian 5.1). Warna titik: ringan=biru muda, sedang=kuning,
// berat=oranye, ambruk=merah; HIJAU khusus laporan sudah diperbaiki
// (lihat reportMarkerColor di labels.js).
//
// Mode tampilan "Peta": data laporan TIDAK di-fetch di sini - diterima
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
  STATUS_COLORS,
  reportMarkerColor,
} from '../lib/labels.js';
import useIsMobile from '../lib/useIsMobile.js';
import { detectProvince } from '../lib/regions.js';
import EmptyResults from './EmptyResults.jsx';
import DetailModal from './DetailModal.jsx';

// Batas pandang peta (File 1 Bagian 9.1): seluruh Indonesia plus sedikit
// toleransi di tepi agar peta tidak bisa digeser jauh keluar wilayah.
const VIEW_LIMITS = L.latLngBounds([-12, 94], [7, 142]);

// Tampilan awal (File 1 Bagian 5.1) - dipakai kembali oleh tombol
// "Kembali ke Tampilan Awal". fitBounds dengan bounds PERSIS Indonesia
// (tanpa margin berlebih) agar peta terisi 100% layar - Sumatra & Papua
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
// jelas namun tidak mengganggu. zIndex 1150 - di atas popup Leaflet
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

// Legend warna titik di peta (File 1 Bagian 9.3) - koreksi user:
// - RINGAN = biru muda (hijau tidak lagi dipakai tingkat kerusakan);
// - HIJAU khusus untuk laporan yang SUDAH DIPERBAIKI;
// - centang ✓ = laporan sudah diverifikasi otoritas;
// - latar 80% transparan (sama dengan slider zoom) & bisa di-hide.
// Kotak kecil di pojok kanan bawah; klik/hover ikon info menampilkan
// definisi singkat tiap kategori kerusakan.
function SeverityLegend({ onHide }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((v) => !v);

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        bottom: 40, // di atas kontrol attribution Leaflet (kanan bawah)
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.8)',
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
        <button
          type="button"
          onClick={onHide}
          aria-label="Sembunyikan legenda"
          title="Sembunyikan legenda"
          style={{
            border: '1px solid #cbd5e1',
            background: '#fff',
            cursor: 'pointer',
            fontSize: 11,
            lineHeight: 1,
            color: '#334155',
            padding: '3px 6px',
            borderRadius: 5,
          }}
        >
          ✕
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

      {/* Hijau KHUSUS laporan yang sudah diperbaiki (bukan severity) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: STATUS_COLORS.selesai_diperbaiki,
            border: '3px solid #fff',
            boxShadow: '0 0 0 1px #1f2937',
            color: '#fff',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ✓
        </span>
        <span>Selesai Diperbaiki</span>
      </div>

      {/* ✓ / ✗ - dua baris pendek tanpa wrap (koreksi user) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, whiteSpace: 'nowrap' }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#2563eb',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px #1f2937',
            color: '#fff',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ✓
        </span>
        <span>Sudah diverifikasi otoritas</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, whiteSpace: 'nowrap' }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#b91c1c',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px #1f2937',
            color: '#fff',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ✗
        </span>
        <span>Ditolak otoritas</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, whiteSpace: 'nowrap' }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#22c55e',
            border: '2px solid #fff',
            boxShadow: '0 0 0 1px #1f2937',
            flexShrink: 0,
            display: 'inline-block',
          }}
        />
        <span>Perbaikan menurut media (butuh validasi)</span>
      </div>

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

// Tombol kecil untuk memunculkan kembali legenda yang sudah di-hide user.
function LegendToggle({ onShow }) {
  return (
    <button
      type="button"
      onClick={onShow}
      title="Tampilkan legenda"
      style={{
        position: 'absolute',
        right: 12,
        bottom: 40,
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.8)',
        border: '1px solid #cbd5e1',
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        color: '#1c1917',
        cursor: 'pointer',
        boxShadow: '0 1px 6px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>ℹ️</span> Legenda
    </button>
  );
}

// Slider zoom peta: diposisikan di TENGAH-BAWAH area peta (di atas area
// footer), bisa digeser untuk zoom in/out. Posisi default = zoom tampilan
// awal (fit-screen); saat digeser muncul bubble persentase (0% = zoom min,
// 100% = zoom max). Dilengkapi tombol − / + (zoom step) dan "⛶ Fit Layar"
// (kembali ke tampilan seluruh Indonesia).
function ZoomSlider({ map }) {
  const [zoom, setZoom] = useState(() => (map ? map.getZoom() : 6));
  const [dragging, setDragging] = useState(false);
  // Toggle sembunyikan/tampilkan kontrol zoom (mobile) agar tidak
  // menghalangi pandangan saat zoom in ke titik di peta.
  const [hidden, setHidden] = useState(false);
  const isMobile = useIsMobile();

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

  const btnStyle = {
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    width: isMobile ? 24 : 26,
    height: isMobile ? 24 : 26,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    color: '#1c1917',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  };

  const toggleBtnStyle = {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid #cbd5e1',
    background: 'rgba(255, 255, 255, 0.95)',
    color: '#1c1917',
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    boxShadow: '0 1px 6px rgba(0, 0, 0, 0.3)',
  };

  // Mobile + slider disembunyikan: cukup satu tombol kecil untuk tampilkan
  // kembali kontrol zoom di posisi yang sama (di atas area tombol Lapor).
  if (isMobile && hidden) {
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 78,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1100,
        }}
      >
        <button
          type="button"
          onClick={() => setHidden(false)}
          aria-label="Tampilkan kontrol zoom"
          title="Tampilkan kontrol zoom"
          style={toggleBtnStyle}
        >
          ▲
        </button>
      </div>
    );
  }

  // Wheel mouse/touchpad di atas kontrol: teruskan ke peta agar zoom jalan
  // & slider ikut bergeser (4 Sep 2026).
  const forwardWheel = (e) => {
    if (!map) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      const cont = typeof map.getContainer === 'function' ? map.getContainer() : null;
      if (cont && typeof WheelEvent !== 'undefined') {
        cont.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: e.deltaY,
            clientX: e.clientX,
            clientY: e.clientY,
            bubbles: true,
            cancelable: true,
          })
        );
      }
    } catch (_err) {
      // abaikan (browser tanpa WheelEvent)
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        // Kanan peta (3 Sep 2026): tombol + / −, lalu slider VERTIKAL di
        // bawahnya, lalu ikon ⛶ (reset Indonesia) & ▼ (mobile).
        // Latar 60% transparan (4 Sep 2026) agar peta tetap terlihat.
        top: isMobile ? 74 : 64,
        right: 10,
        zIndex: 1100,
        background: 'transparent',
        borderRadius: 10,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 4 : 6,
      }}
      onWheel={forwardWheel}
    >
      {/* Zoom: + dan - vertikal, lalu slider VERTIKAL di bawahnya
          (3 Sep 2026). */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isMobile ? 4 : 6,
          background: 'rgba(255, 255, 255, 0.4)', // 60% transparan
          borderRadius: 8,
          padding: isMobile ? 4 : 5,
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.2)',
        }}
      >
        <button
          type="button"
          aria-label="Zoom masuk"
          title="Zoom masuk"
          onClick={() => map.zoomIn()}
          style={btnStyle}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom keluar"
          title="Zoom keluar"
          onClick={() => map.zoomOut()}
          style={btnStyle}
        >
          −
        </button>
        <div
          style={{
            height: 1,
            width: '70%',
            background: '#e2e8f0',
            margin: isMobile ? '1px 0' : '2px 0',
          }}
        />
        {/* Slider vertikal: zoom halus (pengganti slider horizontal lama).
            Bisa digeser atas-bawah; garis kecil di tengah = klik untuk
            kembali ke tampilan seluruh Indonesia (fit screen). */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 4px',
          }}
        >
          <input
            type="range"
            aria-label="Zoom peta"
            min={min}
            max={max}
            value={zoom}
            onChange={(e) => map.setZoom(Number(e.target.value))}
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              height: isMobile ? 72 : 96,
              accentColor: '#eab308',
              cursor: 'grab',
              margin: 0,
            }}
          />
          <button
            type="button"
            aria-label="Tampilan seluruh Indonesia (garis tengah slider)"
            title="Klik garis tengah: tampilan seluruh Indonesia"
            onClick={() =>
              map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, maxZoom: HOME_MAX_ZOOM })
            }
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 24,
              height: 5,
              borderRadius: 3,
              background: '#334155',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.9)',
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, maxZoom: HOME_MAX_ZOOM })}
          aria-label="Tampilan seluruh Indonesia"
          title="Tampilan seluruh Indonesia (reset)"
          style={btnStyle}
        >
          <span style={{ fontSize: isMobile ? 12 : 13, lineHeight: 1 }}>⛶</span>
        </button>
        {isMobile && (
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="Sembunyikan kontrol zoom"
            title="Sembunyikan kontrol zoom"
            style={{ ...btnStyle, fontSize: 10 }}
          >
            ▼
          </button>
        )}
      </div>
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
  homeResetKey = 0, // berubah -> reset peta ke tampilan awal (judul header diklik)
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const clusterGroupRef = useRef(null);
  const isMobile = useIsMobile();
  // Laporan yang sedang dibuka detailnya (fallback internal MapView).
  const [selected, setSelected] = useState(null);
  // Peta sudah diinisialisasi (untuk merender kontrol yang butuh instance).
  const [mapReady, setMapReady] = useState(false);
  // Referensi data/aksi terkini untuk delegasi klik tombol "Lihat Detail"
  // di container peta (anti stale-closure; dipasang sekali saat init).
  const reportsRef = useRef(reports);
  reportsRef.current = reports;
  const onOpenDetailRef = useRef(onOpenDetail);
  onOpenDetailRef.current = onOpenDetail;
  // Zoom aktif - legend disembunyikan saat zoom in (mengganggu pandangan
  // titik); tampil lagi di tampilan negara/region (<= LEGEND_MAX_ZOOM).
  const [zoomLevel, setZoomLevel] = useState(6);
  const LEGEND_MAX_ZOOM = 7;
  // Legenda juga bisa di-hide manual oleh user (tombol ✕); tersimpan per
  // sesi komponen - tombol "ℹ️ Legenda" memunculkannya kembali.
  const [legendHidden, setLegendHidden] = useState(false);
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

  // Judul header "titikrusak.id" diklik -> App menaikkan homeResetKey;
  // reset peta ke tampilan awal (seluruh Indonesia). Skip nilai awal agar
  // fitBounds bawaan saat mount tidak terpanggil dua kali.
  const homeResetKeyRef = useRef(homeResetKey);
  useEffect(() => {
    if (homeResetKey === homeResetKeyRef.current) return;
    homeResetKeyRef.current = homeResetKey;
    goHome();
  }, [homeResetKey]);

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
      // Kontrol zoom default Leaflet dimatikan total - zoom dikelola kontrol
      // vertikal kustom (+/− + slider) di kanan peta (3 Sep 2026), sehingga
      // tidak ada +/− bawaan yang dobel.
      zoomControl: false,
      // Wheel mouse/touchpad tetap zoom peta; event wheel yang jatuh di
      // atas kontrol zoom diteruskan ke peta (4 Sep 2026) agar slider ikut
      // bergeser - tidak harus klik/geser manual.
      scrollWheelZoom: true,
      maxBounds: VIEW_LIMITS,        // batas geser: Indonesia + toleransi (9.1)
      maxBoundsViscosity: 1.0,       // "memantul" halus, tidak berhenti kaku
    });
    mapRef.current = map;
    setMapReady(true);

    // Sinkronkan zoom aktif untuk kontrol berbasis zoom (legend dll).
    const syncZoom = () => setZoomLevel(map.getZoom());
    map.on('zoomend', syncZoom);
    map.on('zoom', syncZoom);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Tampilan awal: seluruh Indonesia utuh (Sumatera–Papua) - fitBounds,
    // bukan setView zoom tetap, agar tidak terpotong di layar sempit.
    map.fitBounds(HOME_BOUNDS, { padding: HOME_PADDING, maxZoom: HOME_MAX_ZOOM });

    // Delegasi klik DOM di container peta untuk tombol "Lihat Detail" di
    // popup. Dipasang SEKALI di init (bukan via event popupopen Leaflet
    // yang tidak andal - event klik DOM selalu sampai ke container, apapun
    // cara popup dibuka). Buka DetailModal penuh untuk laporan itu.
    const onPopupDetailClick = (ev) => {
      const target = ev.target;
      const btn =
        target && typeof target.closest === 'function'
          ? target.closest('.tk-popup-detail-btn')
          : null;
      if (!btn) return;
      map.closePopup();
      const id = Number(btn.dataset.id);
      const report = reportsRef.current.find((r) => r.id === id);
      if (!report) return;
      if (onOpenDetailRef.current) {
        onOpenDetailRef.current(report);
      } else {
        setSelected(report);
      }
    };
    el.addEventListener('click', onPopupDetailClick);

    return () => {
      el.removeEventListener('click', onPopupDetailClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render marker dari props reports (satu sumber data dengan ListView).
  // Effect berjalan ulang setiap data baru (filter berubah, laporan baru,
  // dll.) - tanpa reload manual.
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
    const clusterGroup = L.markerClusterGroup({
      zoomToBoundsOnClick: true,
      // Warna cluster BIRU TUA - sengaja BUKAN warna severity di legend
      // (hijau/kuning/oranye/merah) agar titik cluster tidak tertukar dengan
      // marker tingkat kerusakan.
      iconCreateFunction: (cluster) => {
        // Jika cluster berisi titik critical (ambruk/merah), tandai dengan
        // badge "!" + ring merah berdenyut agar menonjol & menarik perhatian
        // ke hal yang urgent (File 1 6.8.2).
        const children = cluster.getAllChildMarkers ? cluster.getAllChildMarkers() : [];
        const hasCritical = children.some(
          (m) => m.options && m.options.severity === 'ambruk'
        );
        const count = cluster.getChildCount();
        return L.divIcon({
          html: hasCritical
            ? `<div class="tk-cluster-critical" style="box-sizing:border-box;width:44px;height:44px;border-radius:50%;background:#1e3a8a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);line-height:1">${count}<span class="tk-cluster-alert">!</span></div>`
            : `<div style="box-sizing:border-box;width:40px;height:40px;border-radius:50%;background:#1e3a8a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);line-height:1">${count}</div>`,
          className: '',
          iconSize: hasCritical ? [48, 48] : [40, 40],
          iconAnchor: hasCritical ? [24, 24] : [20, 20],
        });
      },
    });
    clusterGroupRef.current = clusterGroup;

    // Klik cluster: catat posisi peta SEBELUM zoom ke riwayat navigasi,
    // sehingga tombol "Kembali" bisa memulihkan satu langkah.
    clusterGroup.on('clusterclick', () => {
      const map = mapRef.current;
      if (map) pushNav(map.getCenter(), map.getZoom());
    });

    // Hover cluster -> tooltip: jumlah titik rusak + provinsi di area itu.
    // Manual openTooltip (bindTooltip pada clusterGroup TIDAK memicu untuk
    // ikon cluster). Ditutup otomatis saat kursor keluar / zoom berubah.
    clusterGroup.on('clustermouseover', (e) => {
      const map = mapRef.current;
      if (!map || !e.layer || typeof e.layer.getChildCount !== 'function') return;
      const count = e.layer.getChildCount();
      const ll = e.layer.getLatLng();
      const prov = detectProvince(ll.lat, ll.lng);
      map.openTooltip(
        `<b>${count} titik rusak</b>${prov ? ` - ${prov}` : ''}`,
        ll,
        { direction: 'top', offset: [0, -10], opacity: 0.95 }
      );
    });
    const closeClusterTip = () => mapRef.current?.closeTooltip();
    clusterGroup.on('clustermouseout', closeClusterTip);
    // Pengaman: tooltip ikut hilang saat zoom berubah (scroll/petik).
    map.on('zoomstart', closeClusterTip);

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

    // Jaga-jaga runtime: dua laporan di koordinat PERSIS sama (mis. sisa
    // data lama) membuat marker di atas menutupi yang bawah sehingga titik
    // bercentang/merah terlihat "tidak bisa diklik". Geser marker duplikat
    // sedikit (≈100 m) agar SEMUA titik tetap bisa diklik & popup terbuka.
    const usedCoords = new Set();
    const resolveCoords = (lat, lng) => {
      let outLat = lat;
      let outLng = lng;
      let key = `${outLat.toFixed(5)},${outLng.toFixed(5)}`;
      while (usedCoords.has(key)) {
        outLat += 0.0012;
        outLng += 0.0012;
        key = `${outLat.toFixed(5)},${outLng.toFixed(5)}`;
      }
      usedCoords.add(key);
      return { lat: outLat, lng: outLng };
    };

    reports.forEach((report) => {
      // Warna titik: HIJAU khusus laporan selesai_diperbaiki; selain itu
      // warna tingkat kerusakan (ringan = biru muda) - reportMarkerColor.
      // Hijau TANPA ✓ = perbaikan menurut berita/media, masih menunggu
      // verifikasi otoritas (media_repair_url terisi, status masih dilaporkan).
      const approved = APPROVED_STATUSES.includes(report.status);
      const mediaRepairPending = !approved && !report.unverifiable && Boolean(report.media_repair_url);
      const color = mediaRepairPending ? '#22c55e' : reportMarkerColor(report);
      const glowClass = GLOW_CLASS[report.severity] || '';
      const pos = resolveCoords(report.lat, report.lng);
      const lat = pos.lat;
      const lng = pos.lng;

      let marker;
      if (report.unverifiable) {
        // Titik yang ditandai otoritas "tidak dapat diverifikasi keasliannya"
        // (indikasi laporan palsu/meyakinkan): marker ✗ putih di lingkaran
        // merah marun - otoritas bisa langsung mengenali dari peta.
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;border-radius:50%;background:#b91c1c;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#fff;line-height:1">✗</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          popupAnchor: [0, -30],
        });
        marker = L.marker([lat, lng], { icon, severity: report.severity });
      } else if (approved) {
        // Marker terverifikasi: lingkaran warna severity + centang putih di
        // tengah. divIcon dipakai karena karakter ✓ tidak bisa dirender di
        // dalam path circleMarker (SVG).
        const icon = L.divIcon({
          className: '',
          html: `<div class="${glowClass}" style="width:26px;height:26px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;line-height:1">✓</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          // Tanpa popupAnchor, popup menempel di titik tengah marker (default
          // [0,0]) sehingga terlihat seperti tidak muncul saat diklik. Anchor
          // di atas marker agar popup tampil jelas seperti marker circle.
          popupAnchor: [0, -30],
        });
        marker = L.marker([lat, lng], { icon, severity: report.severity });
      } else {
        marker = L.circleMarker([lat, lng], {
          radius: 9,
          fillColor: color,
          fillOpacity: 0.85,
          // Outline putih tebal agar warna severity tetap kontras di atas
          // tile peta berwarna serupa (hijau vegetasi, kuning/krem area
          // terbangun) - File 1 Bagian 9.3.
          color: '#ffffff',
          weight: 3,
          // Glow severity via CSS class pada path SVG (Leaflet Path option).
          className: glowClass || undefined,
          // Simpan severity pada marker agar cluster bisa mendeteksi titik
          // critical (ambruk) untuk badge urgent.
          severity: report.severity,
        });
      }

      // Klik marker individual: catat posisi sebelum zoom, lalu zoom in
      // BERTAHAP - naik 2 level dari zoom saat ini (minimal level jalan
      // 14, maksimal 16) agar lokasi persis titik terlihat bersama konteks
      // area sekitarnya, tanpa lompatan zoom yang terasa "terpental".
      marker.on('click', () => {
        const map = mapRef.current;
        if (!map) return;
        pushNav(map.getCenter(), map.getZoom());
        const targetZoom = Math.min(Math.max(map.getZoom() + 2, 14), 16);
        map.setView([lat, lng], targetZoom, { animate: true });
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
      const prov = detectProvince(lat, lng);
      marker.bindTooltip(
        `<b>1 titik rusak</b>${prov ? ` - ${prov}` : ''}`,
        { direction: 'top', offset: [0, -8], opacity: 0.95, sticky: true }
      );

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
      {/* Legend hanya di tampilan negara/region - saat zoom in ke titik
          disembunyikan agar tidak mengganggu view; DI MOBILE TIDAK
          DITAMPILKAN sama sekali (menghindari tumpukan dengan tombol
          Lapor & slider zoom; informasinya ada di menu Dokumentasi).
          Bisa di-hide user (✕) lalu dimunculkan lagi lewat tombol
          "ℹ️ Legenda". */}
      {!isMobile && zoomLevel <= LEGEND_MAX_ZOOM && !legendHidden && (
        <SeverityLegend onHide={() => setLegendHidden(true)} />
      )}
      {!isMobile && zoomLevel <= LEGEND_MAX_ZOOM && legendHidden && (
        <LegendToggle onShow={() => setLegendHidden(false)} />
      )}
      {mapReady && <ZoomSlider map={mapRef.current} />}

      {/* Kondisi hasil kosong (File 1 Bagian 9.1/9.2) - sama dengan
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
          origin="map"
          onOriginClick={() => setSelected(null)}
        />
      )}
    </div>
  );
}
