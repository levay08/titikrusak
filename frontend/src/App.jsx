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

import { useEffect, useState } from 'react';
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

// Logo sponsor di footer (poin Alur Inti: "supported by"):
// PANDI, e.id, dan IDCloudHost. Bila gambar gagal dimuat (mis. CDN
// tidak terjangkau), fallback ke teks nama sponsor.
const SPONSORS = [
  { name: 'PANDI', src: 'https://pandi.id/public/images/2022/9/ppnd-new-1663309705.png' },
  { name: 'e.id', src: 'https://e.id/eid-logo.png' },
  { name: 'IDCloudHost', src: 'https://cdn.theorg.com/00338df6-fc27-4b80-8835-e54ad48378ad_medium.jpg' },
];

// Satu chip logo sponsor: tinggi seragam agar sejajar & rapi.
function SponsorLogo({ name, src }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      title={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        borderRadius: 8,
        height: 36,
        padding: '0 12px',
        minWidth: 64,
      }}
    >
      {failed ? (
        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>{name}</span>
      ) : (
        <img
          src={src}
          alt={`Logo ${name}`}
          onError={() => setFailed(true)}
          style={{ height: 24, maxWidth: 130, objectFit: 'contain' }}
        />
      )}
    </span>
  );
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
          background: hover ? '#7c3aed' : 'rgba(255, 255, 255, 0.12)',
          border: hover ? '1px solid #7c3aed' : '1px solid rgba(255, 255, 255, 0.3)',
          color: '#fff',
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
            bottom: 'calc(100% + 7px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#fff',
            fontSize: 12,
            padding: '6px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
            zIndex: 20,
          }}
        >
          Login sebagai Otoritas
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              border: '5px solid transparent',
              borderTopColor: '#0f172a',
            }}
          />
        </div>
      )}
    </span>
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
  const activeStyle = { background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' };
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
  const [view, setView] = useState('map'); // 'map' | 'list'
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
  // Drawer filter di mobile (File 1 Bagian 9.7) + drawer menu header.
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const handleSubmitted = () => setRefreshKey((k) => k + 1);
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
  };

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
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Logo size={30} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>
            titikrusak.id
          </h1>
        </div>
        {!isMobile && (
          <span style={{ fontSize: 13, opacity: 0.8, flex: 1 }}>
            Laporkan dan pantau infrastruktur publik yang rusak
          </span>
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
          </nav>
        )}

        <div style={{ marginLeft: isMobile ? 'auto' : 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Mobile: tombol Filter + Menu (login ada di dalam drawer Menu) */}
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
            background: '#0f172a',
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
        {/* Panel filter desktop: sidebar permanen */}
        {!isMobile && (
          <FilterPanel
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
          />
        )}

        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          {/* Toggle mode tampilan (File 1 Bagian 9.2) */}
          <ViewToggle view={view} onChange={setView} />

          {view === 'map' ? (
            <MapView
              reports={reports}
              error={dataError}
              onResetFilters={handleResetFilters}
              hasAnyData={totalCount === null ? null : totalCount > 0}
              onOpenReportForm={openReportForm}
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
                background: '#7c3aed',
                color: '#fff',
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
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
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
                      color: '#0f172a',
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
                          color: '#0f172a',
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
                        background: '#7c3aed',
                        color: '#fff',
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

          {/* Modal menu header (poin Alur Inti 9) — semuanya modal, bukan
              halaman baru. Data statistik/pantau/notif dari allReports
              (seluruh laporan TANPA filter). */}
          {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
          {statsOpen && (
            <StatistikModal reports={allReports} onClose={() => setStatsOpen(false)} />
          )}
          {pantauOpen && (
            <PantauModal reports={allReports} onClose={() => setPantauOpen(false)} />
          )}
          {notifOpen && (
            <NotifikasiModal reports={allReports} onClose={() => setNotifOpen(false)} />
          )}
        </div>
      </main>

      {/* Footer: logo + tagline + sponsor (PANDI, e.id, IDCloudHost) —
          logo sponsor disejajarkan dalam chip putih berukuran sama. */}
      <footer
        style={{
          background: '#0f172a',
          color: '#cbd5e1',
          borderTop: '4px solid #dc2626', // aksen merah tema Indonesia
          padding: '14px 20px',
          fontSize: 12.5,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              gap: 10,
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginLeft: 'auto',
            }}
          >
            <span style={{ fontSize: 11.5, opacity: 0.75 }}>Didukung oleh:</span>
            {SPONSORS.map((s) => (
              <SponsorLogo key={s.name} name={s.name} src={s.src} />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
