// frontend/src/App.jsx
// Halaman utama: header sederhana (File 1 Bagian 9.1) + FilterPanel
// (sidebar di desktop, drawer di mobile — File 1 Bagian 9.7) + area
// tampilan yang bisa ditukar antara MapView dan ListView (File 1 Bagian
// 9.2), tombol floating "Lapor Kerusakan" (File 1 Bagian 5.2 langkah
// kedua), dan modal ReportForm (File 1 Bagian 9.6).
//
// Data laporan di-fetch DI SINI (satu-satunya sumber data) berdasarkan
// state filter + sorting aktif, lalu diteruskan sebagai props yang sama
// ke MapView dan ListView — dua mode tampilan dari data yang sama.
// Fetch kedua tanpa filter menghitung total laporan di database untuk
// membedakan kondisi hasil kosong (DB kosong vs filter tak cocok).

import { useEffect, useRef, useState } from 'react';
import MapView from './components/MapView.jsx';
import ListView from './components/ListView.jsx';
import ReportForm from './components/ReportForm.jsx';
import FilterPanel from './components/FilterPanel.jsx';
import VerificationFlow from './components/VerificationFlow.jsx';
import EidDesktopInfo from './components/EidDesktopInfo.jsx';
import Logo from './components/Logo.jsx';
import {
  AboutModal,
  StatistikModal,
  PantauModal,
  NotifikasiModal,
} from './components/HeaderModals.jsx';
import useIsMobile from './lib/useIsMobile.js';
import SearchModal from './components/SearchModal.jsx';
import AdminView from './components/AdminView.jsx';
import DetailModal from './components/DetailModal.jsx';
import WelcomeModal from './components/WelcomeModal.jsx';
import { DocModal, TermsModal } from './components/FooterModals.jsx';

// Logo sponsor di footer (poin Alur Inti: "supported by"):
// PANDI, e.id, dan IDCloudHost. Setiap logo punya URL: hover menampilkan
// bubble berisi URL, klik membuka situs sponsor di tab baru. Bila gambar
// gagal dimuat (mis. CDN tidak terjangkau), fallback ke teks nama sponsor.
const SPONSORS = [
  { name: 'PANDI', src: 'https://pandi.id/public/images/2022/9/ppnd-new-1663309705.png', url: 'https://pandi.id' },
  { name: 'e.id', src: 'https://e.id/eid-logo.png', url: 'https://e.id' },
  { name: 'IDCloudHost', src: 'https://cdn.theorg.com/00338df6-fc27-4b80-8835-e54ad48378ad_medium.jpg', url: 'https://idcloudhost.com' },
];

// Satu chip logo sponsor: tinggi seragam agar sejajar & rapi. Seluruh chip
// adalah link ke situs sponsor; hover memunculkan bubble berisi URL.
function SponsorLogo({ name, src, url }) {
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState(false);
  const isMobile = useIsMobile();
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Kunjungi ${name} (${url})`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        borderRadius: 8,
        // Mobile: chip lebih ramping agar baris sponsor tidak berantakan.
        height: isMobile ? 32 : 40,
        padding: isMobile ? '0 10px' : '0 12px',
        minWidth: isMobile ? 52 : 64,
        textDecoration: 'none',
      }}
    >
      {hover && (
        <div
          style={{
            position: 'absolute',
            // Rata kanan (right:0): chip sponsor berada di pojok kanan footer
            // — bubble tengah sebelumnya bisa terpotong tepi layar.
            bottom: 'calc(100% + 8px)',
            right: 0,
            background: '#1c1917',
            color: '#fff',
            fontSize: 11.5,
            padding: '6px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
            // zIndex tinggi: bubble memanjang ke area peta yang pane-nya
            // ber-z-index hingga 700+ — tanpa ini bubble "terhalang line".
            zIndex: 2000,
            pointerEvents: 'none',
          }}
        >
          {name} — {url}
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              border: '5px solid transparent',
              borderTopColor: '#1c1917',
            }}
          />
        </div>
      )}
      {failed ? (
        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1c1917' }}>{name}</span>
      ) : (
        <img
          src={src}
          alt={`Logo ${name}`}
          onError={() => setFailed(true)}
          style={{
            height: isMobile ? 22 : 28,
            maxWidth: isMobile ? 110 : 150,
            objectFit: 'contain',
          }}
        />
      )}
    </a>
  );
}

// Baca status verifikasi e.id yang tersimpan lokal (dipakai status
// verifikasi di sidebar FilterPanel — poin Alur Inti 5).
function getStoredEidVerification() {
  try {
    const raw = localStorage.getItem('titikrusak_eid');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.isVerified ? parsed : null;
  } catch (_e) {
    return null;
  }
}

// State filter kosong (semua laporan tampil, urut terbaru).
const EMPTY_FILTERS = {
  severity: [],
  infra_type: [],
  bridge_authority: [],
  vital_status: [],
  q: '',
  sort: 'terbaru',
};

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

// Item menu header (desktop): tombol teks ringkas dengan hover halus.
function HeaderNavItem({ label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'rgba(255, 255, 255, 0.15)' : 'none',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.88)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        padding: '7px 9px',
        borderRadius: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// Tombol Login ringkas (poin Alur Inti 4): teks "Login" + ikon gembok;
// saat hover berubah warna dan muncul bubble "Login sebagai Otoritas".
function LoginButton({ onLogin, isMobile }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label="Login sebagai Otoritas"
        onClick={onLogin}
        style={{
          background: hover ? '#facc15' : 'rgba(255, 255, 255, 0.12)',
          border: hover ? '1px solid #facc15' : '1px solid rgba(255, 255, 255, 0.3)',
          color: hover ? '#1c1917' : '#fff',
          borderRadius: 8,
          padding: isMobile ? '9px 14px' : '7px 12px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        🔒 Login
      </button>
      {hover && (
        <div
          style={{
            position: 'absolute',
            // Bubble tampil DI BAWAH tombol, RATA KANAN (right:0) agar tidak
            // terpotong tepi kanan layar (posisi tengah sebelumnya memotong
            // teks "Otoritas"). zIndex tinggi menang atas pane Leaflet (700+).
            top: 'calc(100% + 7px)',
            right: 0,
            background: '#1c1917',
            color: '#fff',
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
            zIndex: 2000,
          }}
        >
          Login sebagai Otoritas
          <span
            style={{
              position: 'absolute',
              bottom: '100%',
              right: 10,
              border: '5px solid transparent',
              borderBottomColor: '#1c1917',
            }}
          />
        </div>
      )}
    </span>
  );
}

// Item menu footer (Dokumentasi / Status / Syarat & Ketentuan / Kontak):
// link teks dengan hover halus; variant `disabled` untuk menu yang belum
// aktif (Status & Kontak — "Segera hadir", tidak bisa diklik).
function FooterLink({ label, onClick, disabled = false }) {
  const [hover, setHover] = useState(false);
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title="Segera hadir"
        style={{
          color: '#64748b',
          fontSize: 12,
          fontWeight: 600,
          padding: '4px 8px',
          cursor: 'not-allowed',
          opacity: 0.55,
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'none',
        border: 'none',
        color: hover ? '#fff' : '#cbd5e1',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 6,
        textDecoration: hover ? 'underline' : 'none',
      }}
    >
      {label}
    </button>
  );
}

// Toggle kecil di bagian atas area tampilan: tukar MapView <-> ListView
// (File 1 Bagian 9.2). FilterPanel tetap terlihat di kedua mode.
function ViewToggle({ view, onChange }) {
  const baseStyle = {
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid #cbd5e1',
    background: '#fff',
    color: '#475569',
  };
  const activeStyle = { background: '#facc15', color: '#1c1917', borderColor: '#facc15' };
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        display: 'flex',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange('map')}
        style={{ ...baseStyle, ...(view === 'map' ? activeStyle : {}) }}
      >
        Peta
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        style={{ ...baseStyle, ...(view === 'list' ? activeStyle : {}) }}
      >
        Daftar
      </button>
    </div>
  );
}

export default function App() {
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [activeView, setActiveView] = useState('map'); // 'map' | 'list' | 'admin'
  // Sinyal reset peta ke tampilan awal (seluruh Indonesia) saat judul
  // header "titikrusak.id" diklik — berfungsi juga saat sudah di mode Peta.
  const [homeResetKey, setHomeResetKey] = useState(0);
  const [reports, setReports] = useState([]);
  const [dataError, setDataError] = useState(null);
  // Total laporan di database (fetch tanpa filter) untuk membedakan
  // kondisi hasil kosong (File 1 9.1/9.2): null = belum diketahui.
  const [totalCount, setTotalCount] = useState(null);
  // Seluruh laporan TANPA filter — sumber data menu header (Statistik,
  // Pantau, Notifikasi) yang tidak boleh terpengaruh filter aktif.
  const [allReports, setAllReports] = useState([]);
  // Sesi otoritas lokal (File 1 Bagian 5.2): null = belum masuk.
  const [otoritas, setOtoritas] = useState(null); // { displayName }
  const [otoritasOpen, setOtoritasOpen] = useState(false);
  // Modal menu header (File 1 Bagian 9.1 / poin Alur Inti 9).
  const [aboutOpen, setAboutOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [pantauOpen, setPantauOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // Status verifikasi e.id pengguna (poin Alur Inti 5) + modal verifikasi
  // warga dari sidebar FilterPanel.
  const [eidVerified, setEidVerified] = useState(() => Boolean(getStoredEidVerification()));
  const [eidFlowOpen, setEidFlowOpen] = useState(false);
  // Modal selamat datang: SESI per tab — muncul saat kunjungan pertama
  // tab/window (tab baru setelah tab ditutup => muncul lagi). Selama tab
  // masih terbuka, flag sessionStorage membuat modal tidak muncul kembali
  // walau kembali ke halaman pertama.
  const [welcomeOpen, setWelcomeOpen] = useState(() => {
    try {
      return !sessionStorage.getItem('titikrusak_welcome_seen');
    } catch (_e) {
      return true;
    }
  });
  const handleWelcomeClose = () => {
    try {
      sessionStorage.setItem('titikrusak_welcome_seen', '1');
    } catch (_e) {
      // abaikan bila sessionStorage tidak tersedia
    }
    setWelcomeOpen(false);
  };
  // Drawer filter di mobile (File 1 Bagian 9.7) + drawer menu header.
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Sidebar filter desktop bisa disembunyikan (poin: sidebar bisa di-hide).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Pencarian header (poin: tagline -> search bar): modal hasil pencarian
  // + kata kunci awal dari input header.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Detail laporan dibuka dari tingkat App: hasil pencarian atau tombol
  // "Lihat Detail" di popup peta — satu modal detail di level App.
  const [detailReport, setDetailReport] = useState(null);
  // Modal menu footer (Dokumentasi + Syarat & Ketentuan; Status & Kontak
  // masih disable).
  const [docOpen, setDocOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  // Satu-satunya fetch data hasil-filter: ulang saat filter berubah
  // (real-time) atau setelah laporan baru dikirim (refreshKey).
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
        setReports(data);
        setDataError(null);
      })
      .catch((err) => {
        if (!cancelled) setDataError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, filters]);

  // Hitung total laporan di database (TANPA filter apa pun) — hanya
  // berubah saat mount dan setelah laporan baru dikirim (refreshKey),
  // tidak bergantung pada filter.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/reports')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setAllReports(list);
        setTotalCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setTotalCount(null); // tidak tahu -> jangan tampilkan empty state
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleSubmitted = () => {
    setRefreshKey((k) => k + 1);
    // Setelah submit (bisa lewat alur verifikasi e.id), segarkan status
    // verifikasi di sidebar agar selalu sinkron dengan localStorage.
    setEidVerified(Boolean(getStoredEidVerification()));
  };
  const handleFilterChange = (next) => setFilters(next);
  const handleResetFilters = () => setFilters(EMPTY_FILTERS);

  // Jumlah filter yang sedang aktif (untuk badge tombol Filter di mobile).
  const activeFilterCount =
    filters.severity.length +
    filters.bridge_authority.length +
    filters.vital_status.length +
    (filters.q.trim() ? 1 : 0);

  const openReportForm = () => {
    closeAllModals();
    setFormOpen(true);
  };

  // Pastikan HANYA SATU modal terbuka dalam satu waktu (poin Alur Inti 18):
  // membuka modal apa pun menutup modal lain yang mungkin masih terbuka.
  const closeAllModals = () => {
    setFormOpen(false);
    setOtoritasOpen(false);
    setAboutOpen(false);
    setStatsOpen(false);
    setPantauOpen(false);
    setNotifOpen(false);
    setEidFlowOpen(false);
    setSearchOpen(false);
    setDetailReport(null);
    setDocOpen(false);
    setTermsOpen(false);
  };

  // Buka modal pencarian header (dari search bar desktop atau tombol 🔍
  // mobile). Kata kunci dari input header dibawa sebagai query awal.
  const openSearch = (initialQuery = '') => {
    closeAllModals();
    setSearchQuery(initialQuery);
    setSearchOpen(true);
  };

  // Buka halaman Administrator (menu tampil sebelum login; isi digate).
  const openAdmin = () => {
    closeAllModals();
    setActiveView('admin');
  };

  // Buka detail laporan dari popup peta — lewat App agar hanya satu modal
  // aktif (MapView menyerahkan ke sini via prop onOpenDetail).
  const openReportDetail = (report) => {
    closeAllModals();
    setDetailReport(report);
  };

  // Klik logo/judul titikrusak.id di header: kembali ke halaman utama
  // (peta) dan tutup semua modal.
  const goHomeView = () => {
    closeAllModals();
    setActiveView('map');
    // Reset peta ke tampilan awal (seluruh Indonesia) — berlaku juga saat
    // sudah berada di mode Peta (mis. sudah zoom ke titik tertentu).
    setHomeResetKey((k) => k + 1);
  };

  // Dengarkan event 'tk:go-home' dari Breadcrumb (klik "Beranda") — kembali
  // ke peta utama. Ref agar listener tidak menangkap goHomeView yang basi.
  const goHomeViewRef = useRef(goHomeView);
  goHomeViewRef.current = goHomeView;
  useEffect(() => {
    const handler = () => goHomeViewRef.current();
    window.addEventListener('tk:go-home', handler);
    return () => window.removeEventListener('tk:go-home', handler);
  }, []);

  const openEidFlow = () => {
    closeAllModals();
    setEidFlowOpen(true);
  };

  // Keluar dari verifikasi e.id (poin: opsi logout verifikasi).
  const handleLogoutEid = () => {
    try {
      localStorage.removeItem('titikrusak_eid');
    } catch (_e) {
      // abaikan bila localStorage tidak tersedia
    }
    setEidVerified(false);
  };
  const storedEid = getStoredEidVerification();

  const openHeaderModal = (setter) => () => {
    closeAllModals();
    setter(true);
  };

  // Tombol floating disembunyikan saat kondisi hasil kosong Kondisi A
  // (database kosong) menampilkan tombol ajakannya sendiri — dan selama
  // pemuatan awal — sehingga hanya ada SATU tombol "Lapor Kerusakan"
  // (poin Alur Inti 14). Saat fetch total gagal (dataError) tombol tetap
  // muncul agar pengguna tidak kehilangan akses melapor.
  const showFloatingLapor =
    totalCount !== 0 &&
    !(totalCount === null && reports.length === 0 && !dataError);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Pita merah-putih tipis — aksen tema Indonesia (poin 15) */}
      <div className="tk-flag-ribbon" />
      <header
        style={{
          padding: '10px 12px',
          background: '#1c1917',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* Logo + judul = tombol kembali ke halaman utama/peta */}
          <button
            type="button"
            onClick={goHomeView}
            aria-label="titikrusak.id — kembali ke peta utama"
            title="Kembali ke peta utama"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            <Logo size={30} />
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>
              titikrusak.id
            </h1>
          </button>
        </div>
        {/* Search bar header (poin: tagline dihapus -> search bar): cari
            kata kunci apa pun; Enter membuka modal hasil pencarian. */}
        {!isMobile && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.searchq;
              openSearch(input.value);
              input.value = '';
            }}
            style={{ flex: 1, display: 'flex', maxWidth: 340, minWidth: 170, marginLeft: 4 }}
          >
            <input
              name="searchq"
              type="search"
              placeholder="Cari dengan kata kunci"
              aria-label="Cari titik rusak"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 12px',
                borderRadius: '8px 0 0 8px',
                border: 'none',
                fontSize: 13,
                outline: 'none',
                color: '#1c1917',
                background: '#fff',
              }}
            />
            <button
              type="submit"
              aria-label="Cari"
              title="Cari titik rusak"
              style={{
                background: '#facc15',
                color: '#1c1917',
                border: 'none',
                borderRadius: '0 8px 8px 0',
                padding: '0 12px',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              🔍
            </button>
          </form>
        )}

        {/* Menu header (poin Alur Inti 9) — desktop: langsung di header;
            mobile: lewat drawer "Menu". Semua membuka MODAL, bukan halaman. */}
        {!isMobile && (
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
            <HeaderNavItem label="Tentang" onClick={openHeaderModal(setAboutOpen)} />
            <HeaderNavItem label="Statistik" onClick={openHeaderModal(setStatsOpen)} />
            <HeaderNavItem label="Pantau" onClick={openHeaderModal(setPantauOpen)} />
            <button
              type="button"
              aria-label="Notifikasi aktivitas laporan"
              title="Notifikasi aktivitas laporan"
              onClick={openHeaderModal(setNotifOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.88)',
                fontSize: 16,
                lineHeight: 1,
                cursor: 'pointer',
                padding: '7px 9px',
                borderRadius: 6,
              }}
            >
              🔔
            </button>
            {/* Halaman Admin: menu tampil SEBELUM login (isi digate otoritas) */}
            <HeaderNavItem label="Admin" onClick={openAdmin} />
          </nav>
        )}

        <div style={{ marginLeft: isMobile ? 'auto' : 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Mobile: tombol Cari + Filter + Menu (login ada di dalam drawer Menu) */}
          {isMobile && (
            <button
              type="button"
              aria-label="Cari titik rusak"
              title="Cari titik rusak"
              onClick={() => openSearch('')}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 14,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              🔍
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : 'Filter'}
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              aria-label="Buka menu"
              onClick={() => setMenuOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ☰ Menu
            </button>
          )}

          {/* Sesi otoritas lokal (File 1 Bagian 5.2). Desktop: badge +
              Keluar; saat belum masuk tombol Login ringkas (poin 4).
              Mobile: login ada di drawer Menu; saat sudah masuk badge
              pindah ke baris header kedua. */}
          {isMobile ? null : otoritas ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: 999,
                  padding: '5px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  maxWidth: 220,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                🏛 {otoritas.displayName}
              </span>
              <button
                type="button"
                onClick={() => setOtoritas(null)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  color: '#fff',
                  borderRadius: 6,
                  padding: '5px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Keluar
              </button>
            </div>
          ) : (
            <LoginButton
              onLogin={() => {
                closeAllModals();
                setOtoritasOpen(true);
              }}
              isMobile={isMobile}
            />
          )}
        </div>
      </header>

      {/* Baris kedua header (khusus mobile, saat sesi otoritas aktif):
          badge nama + tombol Keluar selebar layar, agar tidak menumpuk
          dengan judul dan tombol Filter di baris pertama. */}
      {isMobile && otoritas && (
        <div
          style={{
            background: '#1c1917',
            color: '#fff',
            padding: '0 12px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <span
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: 999,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            🏛 {otoritas.displayName}
          </span>
          <button
            type="button"
            onClick={() => setOtoritas(null)}
            style={{
              background: 'none',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              color: '#fff',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Keluar
          </button>
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Panel filter desktop: sidebar permanen yang BISA disembunyikan */}
        {!isMobile && !sidebarCollapsed && (
          <FilterPanel
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            onCollapse={() => setSidebarCollapsed(true)}
            eidVerified={eidVerified}
            eidDisplayName={storedEid?.displayName || null}
            onRequestVerify={openEidFlow}
            onLogoutEid={handleLogoutEid}
            otoritas={otoritas}
            onLogoutOtoritas={() => setOtoritas(null)}
            onRequestLogin={() => {
              closeAllModals();
              setOtoritasOpen(true);
            }}
          />
        )}
        {/* Tab tipis untuk memunculkan kembali sidebar yang disembunyikan */}
        {!isMobile && sidebarCollapsed && (
          <button
            type="button"
            aria-label="Tampilkan panel filter"
            title="Tampilkan panel filter"
            onClick={() => setSidebarCollapsed(false)}
            style={{
              flexShrink: 0,
              width: 38,
              background: '#fff',
              border: 'none',
              borderRight: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 14, color: '#eab308', fontWeight: 800, lineHeight: 1 }}>
              ⏵
            </span>
            <span
              style={{
                writingMode: 'vertical-rl',
                fontSize: 9.5,
                fontWeight: 700,
                color: '#64748b',
                letterSpacing: 1.5,
              }}
            >
              FILTER
            </span>
          </button>
        )}

        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          {/* Toggle mode tampilan (File 1 Bagian 9.2) — disembunyikan di
              halaman Admin (tampilan khusus otoritas) */}
          {activeView !== 'admin' && <ViewToggle view={activeView} onChange={setActiveView} />}

          {activeView === 'admin' ? (
            <AdminView
              reports={allReports}
              otoritas={otoritas}
              onRequestLogin={() => {
                closeAllModals();
                setOtoritasOpen(true);
              }}
              onReportUpdated={handleSubmitted}
              onBack={() => setActiveView('map')}
            />
          ) : activeView === 'map' ? (
            <MapView
              reports={reports}
              error={dataError}
              onResetFilters={handleResetFilters}
              hasAnyData={totalCount === null ? null : totalCount > 0}
              onOpenReportForm={openReportForm}
              onOpenDetail={openReportDetail}
              otoritas={otoritas}
              onReportUpdated={handleSubmitted}
              homeResetKey={homeResetKey}
            />
          ) : (
            <ListView
              reports={reports}
              error={dataError}
              onResetFilters={handleResetFilters}
              hasAnyData={totalCount === null ? null : totalCount > 0}
              onOpenReportForm={openReportForm}
              otoritas={otoritas}
              onReportUpdated={handleSubmitted}
            />
          )}

          {/* Tombol floating Lapor Kerusakan (File 1 Bagian 9.1). Di
              Kondisi A (database kosong) disembunyikan — EmptyResults
              sudah menampilkan satu tombol ajakan beranimasi, sehingga
              tidak ada dua tombol "Lapor" sekaligus (poin Alur Inti 14). */}
          {showFloatingLapor && (
            <button
              type="button"
              className="tk-fab"
              onClick={openReportForm}
              style={{
                position: 'absolute',
                left: isMobile ? 16 : 20,
                bottom: isMobile ? 16 : 20,
                zIndex: 1100,
                background: '#facc15',
                color: '#1c1917',
                border: 'none',
                borderRadius: 999,
                padding: isMobile ? '13px 20px' : '12px 22px',
                fontSize: 15,
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                cursor: 'pointer',
              }}
            >
              + Lapor Kerusakan
            </button>
          )}

          {/* Drawer filter mobile (File 1 Bagian 9.7) */}
          {isMobile && filtersOpen && (
            <>
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1290,
                  background: 'rgba(15, 23, 42, 0.45)',
                }}
                onClick={() => setFiltersOpen(false)}
              />
              <div
                className="tk-drawer-left"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  zIndex: 1300,
                  background: '#fff',
                  boxShadow: '2px 0 16px rgba(0, 0, 0, 0.3)',
                  width: 288,
                  maxWidth: '85vw',
                  overflowY: 'auto',
                }}
              >
                <FilterPanel
                  filters={filters}
                  onChange={handleFilterChange}
                  onReset={handleResetFilters}
                  onClose={() => setFiltersOpen(false)}
                  eidVerified={eidVerified}
                  eidDisplayName={storedEid?.displayName || null}
                  onRequestVerify={() => {
                    setFiltersOpen(false);
                    openEidFlow();
                  }}
                  onLogoutEid={() => {
                    setFiltersOpen(false);
                    handleLogoutEid();
                  }}
                  otoritas={otoritas}
                  onLogoutOtoritas={() => {
                    setFiltersOpen(false);
                    setOtoritas(null);
                  }}
                  onRequestLogin={() => {
                    setFiltersOpen(false);
                    closeAllModals();
                    setOtoritasOpen(true);
                  }}
                />
              </div>
            </>
          )}

          {/* Drawer menu header mobile (poin Alur Inti 9): Tentang,
              Statistik, Pantau, Notifikasi, dan Login otoritas — semuanya
              membuka modal. */}
          {isMobile && menuOpen && (
            <>
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1290,
                  background: 'rgba(15, 23, 42, 0.45)',
                }}
                onClick={() => setMenuOpen(false)}
              />
              <div
                className="tk-drawer-right"
                style={{
                  position: 'fixed',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1300,
                  background: '#fff',
                  boxShadow: '-2px 0 16px rgba(0, 0, 0, 0.3)',
                  width: 280,
                  maxWidth: '85vw',
                  overflowY: 'auto',
                  padding: '16px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#1c1917' }}>
                    Menu
                  </span>
                  <button
                    type="button"
                    aria-label="Tutup menu"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      borderRadius: 6,
                      width: 30,
                      height: 30,
                      fontSize: 16,
                      lineHeight: 1,
                      cursor: 'pointer',
                      color: '#475569',
                    }}
                  >
                    ✕
                  </button>
                </div>
                {[
                  { icon: 'ℹ️', label: 'Tentang', open: openHeaderModal(setAboutOpen) },
                  { icon: '📊', label: 'Statistik', open: openHeaderModal(setStatsOpen) },
                  { icon: '🚧', label: 'Pantau', open: openHeaderModal(setPantauOpen) },
                  { icon: '🔔', label: 'Notifikasi', open: openHeaderModal(setNotifOpen) },
                  { icon: '🛠️', label: 'Admin', open: openAdmin },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      item.open();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      padding: '13px 6px',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#1c1917',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 16 }} aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                ))}
                <div
                  style={{
                    borderTop: '1px solid #e2e8f0',
                    marginTop: 8,
                    paddingTop: 10,
                  }}
                >
                  {otoritas ? (
                    <>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#64748b',
                          marginBottom: 8,
                          padding: '0 6px',
                        }}
                      >
                        Masuk sebagai <strong>{otoritas.displayName}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setOtoritas(null);
                        }}
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#1c1917',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Keluar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        closeAllModals();
                        setOtoritasOpen(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '11px 14px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#facc15',
                        color: '#1c1917',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      🔒 Login sebagai Otoritas
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Modal formulir laporan */}
          {formOpen && (
            <div
              className="tk-modal-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1200,
                background: 'rgba(15, 23, 42, 0.55)',
                display: 'flex',
                alignItems: isMobile ? 'flex-end' : 'center',
                justifyContent: 'center',
                padding: isMobile ? 0 : 16,
              }}
              onClick={() => setFormOpen(false)}
            >
              <div
                className="tk-modal-panel"
                style={{
                  background: '#fff',
                  borderTopLeftRadius: 14,
                  borderTopRightRadius: 14,
                  borderRadius: isMobile ? '14px 14px 0 0' : 12,
                  width: '100%',
                  maxWidth: 520,
                  maxHeight: isMobile ? '92dvh' : '90vh',
                  overflowY: 'auto',
                  padding: isMobile ? '18px 18px 24px' : '20px 24px',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ReportForm onSubmitted={handleSubmitted} onClose={() => setFormOpen(false)} />
              </div>
            </div>
          )}

          {/* Modal masuk otoritas lokal: alur verifikasi e.id role otoritas */}
          {otoritasOpen && (
            <div
              className="tk-modal-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1200,
                background: 'rgba(15, 23, 42, 0.55)',
                display: 'flex',
                alignItems: isMobile ? 'flex-end' : 'center',
                justifyContent: 'center',
                padding: isMobile ? 0 : 16,
              }}
              onClick={() => setOtoritasOpen(false)}
            >
              <div
                className="tk-modal-panel"
                style={{
                  background: '#fff',
                  borderRadius: isMobile ? '14px 14px 0 0' : 12,
                  width: '100%',
                  maxWidth: 440,
                  maxHeight: isMobile ? '92dvh' : '90vh',
                  overflowY: 'auto',
                  padding: isMobile ? '18px 18px 24px' : '20px 24px',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {isMobile ? (
                  /* Mobile: alur e.id butuh scan QR di perangkat lain —
                     tampilkan info (pesan SAMA dengan form warga), bukan QR
                     (File 1 Bagian 9.7). */
                  <EidDesktopInfo
                    title="Masuk sebagai Otoritas Lokal"
                    actionLabel="Tutup"
                    onAction={() => setOtoritasOpen(false)}
                  />
                ) : (
                  <VerificationFlow
                    role="otoritas"
                    onComplete={(result) => {
                      setOtoritas({ displayName: result.displayName });
                      setOtoritasOpen(false);
                    }}
                    onCancel={() => setOtoritasOpen(false)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Modal selamat datang (kunjungan pertama saja) */}
          {welcomeOpen && <WelcomeModal onClose={handleWelcomeClose} />}

          {/* Modal verifikasi e.id WARGA dari sidebar (poin Alur Inti 5):
              Member level 1 (email/nama/alamat/no. telp, tanpa KTP) —
              desktop alur QR penuh, mobile info scan QR. */}
          {eidFlowOpen && (
            <div
              className="tk-modal-backdrop"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1200,
                background: 'rgba(15, 23, 42, 0.55)',
                display: 'flex',
                alignItems: isMobile ? 'flex-end' : 'center',
                justifyContent: 'center',
                padding: isMobile ? 0 : 16,
              }}
              onClick={() => setEidFlowOpen(false)}
            >
              <div
                className="tk-modal-panel"
                style={{
                  background: '#fff',
                  borderRadius: isMobile ? '14px 14px 0 0' : 12,
                  width: '100%',
                  maxWidth: 440,
                  maxHeight: isMobile ? '92dvh' : '90vh',
                  overflowY: 'auto',
                  padding: isMobile ? '18px 18px 24px' : '20px 24px',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {isMobile ? (
                  <EidDesktopInfo
                    title="Verifikasi e.id"
                    actionLabel="Tutup"
                    onAction={() => setEidFlowOpen(false)}
                  />
                ) : (
                  <VerificationFlow
                    role="warga"
                    onComplete={(result) => {
                      try {
                        localStorage.setItem('titikrusak_eid', JSON.stringify(result));
                      } catch (_e) {
                        // abaikan bila localStorage tidak tersedia
                      }
                      setEidVerified(true);
                      setEidFlowOpen(false);
                    }}
                    onCancel={() => setEidFlowOpen(false)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Modal pencarian header (poin: tagline -> search bar) */}
          {searchOpen && (
            <SearchModal
              reports={allReports}
              initialQuery={searchQuery}
              onClose={() => setSearchOpen(false)}
              onOpenReport={(r) => {
                setSearchOpen(false);
                setDetailReport(r);
              }}
            />
          )}

          {/* Detail laporan level App: hasil pencarian atau tombol
              "Lihat Detail" di popup peta (satu modal detail, poin 18) */}
          {detailReport && (
            <DetailModal
              report={detailReport}
              onClose={() => setDetailReport(null)}
              otoritas={otoritas}
              onReportUpdated={handleSubmitted}
              origin={activeView === 'list' ? 'list' : 'map'}
              onOriginClick={() => {
                setDetailReport(null);
                setActiveView(activeView === 'list' ? 'list' : 'map');
              }}
            />
          )}

          {/* Modal menu header (poin Alur Inti 9) — semuanya modal, bukan
              halaman baru. Data statistik/pantau/notif dari allReports
              (seluruh laporan TANPA filter). */}
          {docOpen && <DocModal onClose={() => setDocOpen(false)} />}
          {termsOpen && <TermsModal onClose={() => setTermsOpen(false)} />}
          {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
          {statsOpen && (
            <StatistikModal reports={allReports} onClose={() => setStatsOpen(false)} />
          )}
          {pantauOpen && (
            <PantauModal reports={allReports} onClose={() => setPantauOpen(false)} />
          )}
          {notifOpen && (
            <NotifikasiModal onClose={() => setNotifOpen(false)} />
          )}
        </div>
      </main>

      {/* Footer: logo + tagline + sponsor (PANDI, e.id, IDCloudHost) —
          logo sponsor disejajarkan dalam chip putih berukuran sama. */}
      <footer
        style={{
          background: '#1c1917',
          color: '#cbd5e1',
          borderTop: '4px solid #facc15', // aksen kuning tema maintenance
          padding: '14px 20px',
          fontSize: 12.5,
          flexShrink: 0,
        }}
      >
        {/* Menu footer: Dokumentasi & Syarat & Ketentuan (modal); Status &
            Kontak masih disable. */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2,
            marginBottom: 12,
          }}
        >
          <FooterLink
            label="Dokumentasi"
            onClick={() => {
              closeAllModals();
              setDocOpen(true);
            }}
          />
          <FooterLink label="Status" disabled />
          <FooterLink
            label="Syarat & Ketentuan"
            onClick={() => {
              closeAllModals();
              setTermsOpen(true);
            }}
          />
          <FooterLink label="Kontak" disabled />
        </div>

        <div
          style={{
            width: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: isMobile ? 10 : 14,
            // Mobile: ditumpuk vertikal (judul di atas, sponsor di bawah)
            // agar tidak berantakan di layar sempit.
            justifyContent: isMobile ? 'flex-start' : 'space-between',
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: isMobile ? '100%' : 'auto' }}>
            <Logo size={26} />
            <div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 13 }}>
                titikrusak.id
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.75 }}>
                Laporkan &amp; pantau infrastruktur publik yang rusak
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 8 : 10,
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'flex-start' : 'flex-end', // logo sponsor rata kanan (poin 7)
              width: isMobile ? '100%' : 'auto',
            }}
          >
            <span style={{ fontSize: 11.5, opacity: 0.75 }}>Didukung oleh:</span>
            {SPONSORS.map((s) => (
              <SponsorLogo key={s.name} name={s.name} src={s.src} url={s.url} />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
