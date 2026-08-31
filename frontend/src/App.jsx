// frontend/src/App.jsx
// Halaman utama: header sederhana (File 1 Bagian 9.1) + MapView
// full screen sebagai elemen utama.

import MapView from './components/MapView.jsx';

export default function App() {
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
      <main style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <MapView />
      </main>
    </div>
  );
}
