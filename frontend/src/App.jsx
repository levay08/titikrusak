// frontend/src/App.jsx
// Halaman utama: header sederhana (File 1 Bagian 9.1) + FilterPanel
// (sidebar kiri) + area tampilan yang bisa ditukar antara MapView dan
// ListView (File 1 Bagian 9.2), tombol floating "Lapor Kerusakan"
// (File 1 Bagian 5.2 langkah kedua), dan modal ReportForm (File 1
// Bagian 9.6).
//
// Data laporan di-fetch DI SINI (satu-satunya sumber data) berdasarkan
// state filter + sorting aktif, lalu diteruskan sebagai props yang sama
// ke MapView dan ListView — dua mode tampilan dari data yang sama,
// bukan dua fetch terpisah. FilterPanel dipakai bersama di kedua mode.

import { useEffect, useState } from 'react';
import MapView from './components/MapView.jsx';
import ListView from './components/ListView.jsx';
import ReportForm from './components/ReportForm.jsx';
import FilterPanel from './components/FilterPanel.jsx';

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

  // Satu-satunya fetch data: ulang saat filter berubah (real-time) atau
  // setelah laporan baru dikirim (refreshKey). Hasilnya dibagikan ke
  // MapView dan ListView sebagai props yang sama.
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

  const handleSubmitted = () => setRefreshKey((k) => k + 1);
  const handleFilterChange = (next) => setFilters(next);
  const handleResetFilters = () => setFilters(EMPTY_FILTERS);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          padding: '10px 16px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>titikrusak.id</h1>
        <span style={{ fontSize: 13, opacity: 0.8 }}>
          Laporkan dan pantau infrastruktur publik yang rusak
        </span>
      </header>

      <main style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Panel filter (File 1 Bagian 9.1) — dipakai bersama di mode Peta & Daftar */}
        <FilterPanel filters={filters} onChange={handleFilterChange} onReset={handleResetFilters} />

        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          {/* Toggle mode tampilan (File 1 Bagian 9.2) */}
          <ViewToggle view={view} onChange={setView} />

          {view === 'map' ? (
            <MapView reports={reports} error={dataError} onResetFilters={handleResetFilters} />
          ) : (
            <ListView reports={reports} error={dataError} onResetFilters={handleResetFilters} />
          )}

          {/* Tombol floating Lapor Kerusakan (File 1 Bagian 9.1) */}
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            style={{
              position: 'absolute',
              left: 20,
              bottom: 20,
              zIndex: 1100,
              background: '#7c3aed',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '12px 22px',
              fontSize: 15,
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
              cursor: 'pointer',
            }}
          >
            + Lapor Kerusakan
          </button>

          {/* Modal formulir laporan */}
          {formOpen && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1200,
                background: 'rgba(15, 23, 42, 0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
              }}
              onClick={() => setFormOpen(false)}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  width: '100%',
                  maxWidth: 520,
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  padding: '20px 24px',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <ReportForm onSubmitted={handleSubmitted} onClose={() => setFormOpen(false)} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
