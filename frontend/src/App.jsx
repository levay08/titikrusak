// frontend/src/App.jsx
// Halaman utama: header sederhana (File 1 Bagian 9.1) + FilterPanel
// (sidebar kiri) + MapView full screen, tombol floating "Lapor Kerusakan"
// (File 1 Bagian 5.2 langkah kedua), dan modal ReportForm (File 1 Bagian
// 9.6). Setelah laporan berhasil dikirim, refreshKey dinaikkan agar
// MapView me-refresh marker; saat filter berubah, state filter diteruskan
// ke MapView sehingga marker ikut tersaring real-time tanpa reload.

import { useState } from 'react';
import MapView from './components/MapView.jsx';
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

export default function App() {
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

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
        {/* Panel filter (File 1 Bagian 9.1) — mengubah peta real-time */}
        <FilterPanel filters={filters} onChange={handleFilterChange} onReset={handleResetFilters} />

        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <MapView
            refreshKey={refreshKey}
            filters={filters}
            onResetFilters={handleResetFilters}
          />

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
