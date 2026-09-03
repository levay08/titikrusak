// frontend/src/components/ActiveOtoritas.jsx
// Kartu transparansi publik (3 Sep 2026): menampilkan INSTANSI otoritas yang
// benar-benar bekerja dalam 24 jam terakhir (aksi terotorisasi, bukan sekadar
// login). Tanpa nama pribadi - hanya label instansi/asal + waktu terakhir
// bertindak. Muat ulang tiap 60 detik.

import { useEffect, useState } from 'react';

const label = { padding: '6px 10px', borderRadius: 8, fontSize: 11.5, color: '#334155', display: 'block' };

function relativeTime(isoLike) {
  // DB CURRENT_TIMESTAMP: "YYYY-MM-DD HH:MM:SS" (UTC)
  const t = String(isoLike || '').replace(' ', 'T') + 'Z';
  const then = new Date(t).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const h = Math.floor(mins / 60);
  return `${h} jam lalu`;
}

export default function ActiveOtoritas() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let on = true;
    const load = () =>
      fetch('/api/otoritas/active')
        .then((r) => (r.ok ? r.json() : { active: [] }))
        .then((d) => {
          if (on) {
            setRows(Array.isArray(d.active) ? d.active : []);
            setLoaded(true);
          }
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div
      style={{
        marginTop: 10,
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '10px 12px',
        background: '#fff',
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: '#64748b',
          marginBottom: 8,
        }}
      >
        Status Otoritas
      </span>
      {loaded && rows.length === 0 ? (
        <span style={{ ...label, background: '#f8fafc', color: '#64748b' }}>
          Belum ada otoritas yang melakukan verifikasi.
        </span>
      ) : (
        rows.map((r) => (
          <span key={r.label} style={{ ...label, background: '#f0fdf4', marginBottom: 6 }}>
            🛠 {r.label}
            <span style={{ display: 'block', fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
              terakhir bertindak {relativeTime(r.last_active_at)}
            </span>
          </span>
        ))
      )}
    </div>
  );
}
