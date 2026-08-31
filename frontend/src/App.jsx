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
import useIsMobile from './lib/useIsMobile.js';

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
  // Sesi otoritas lokal (File 1 Bagian 5.2): null = belum masuk.
  const [otoritas, setOtoritas] = useState(null); // { displayName }
  const [otoritasOpen, setOtoritasOpen] = useState(false);
  // Drawer filter di mobile (File 1 Bagian 9.7).
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);

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
        setTotalCount(Array.isArray(data) ? data.length : 0);
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

  const openReportForm = () => setFormOpen(true);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>titikrusak.id</h1>
        {!isMobile && (
          <span style={{ fontSize: 13, opacity: 0.8, flex: 1 }}>
            Laporkan dan pantau infrastruktur publik yang rusak
          </span>
        )}

        <div style={{ marginLeft: isMobile ? 'auto' : 0, display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Tombol buka drawer filter — hanya di mobile (File 1 9.7) */}
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

          {/* Sesi otoritas lokal (File 1 Bagian 5.2). Di mobile saat sudah
              masuk, badge + tombol Keluar pindah ke baris header kedua
              (lebar penuh) agar baris pertama tidak sesak/terpotong di
              layar sempit (320-414px). */}
          {isMobile && otoritas ? null : otoritas ? (
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
            <button
              type="button"
              onClick={() => setOtoritasOpen(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                borderRadius: 8,
                padding: isMobile ? '9px 14px' : '7px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {isMobile ? 'Otoritas' : 'Masuk sebagai Otoritas Lokal'}
            </button>
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
              sudah menampilkan satu tombol ajakan beranimasi. */}
          {totalCount !== 0 && (
            <button
              type="button"
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

          {/* Modal formulir laporan */}
          {formOpen && (
            <div
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
        </div>
      </main>
    </div>
  );
}
