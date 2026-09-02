// frontend/src/components/FilterPanel.jsx
// Panel filter laporan (File 1 Bagian 9.1): sidebar di kiri peta yang
// mengubah data yang ditampilkan MapView secara real-time (tanpa submit
// maupun reload). Komponen ini controlled — seluruh state filter tinggal
// di App dan diteruskan lewat props.
//
// Isi sesuai File 1 Bagian 9.1:
//   - checkbox tingkat kerusakan (multi-select, 4 warna)
//   - checkbox kategori kewenangan (multi-select)
//   - checkbox status vital (multi-select)
//   - dropdown status verifikasi (nonaktif dulu; verifikasi e.id belum ada)
//   - search box nama lokasi
//   - dropdown sorting (enam opsi File 1 Bagian 6.8.10)
//   - tombol Reset Filter

import { SEVERITIES, BRIDGE_AUTHORITIES, VITAL_STATUSES } from '../lib/labels.js';

// Enam opsi sorting (File 1 Bagian 6.8.10), dipetakan ke pasangan
// sort/order yang dipahami backend GET /api/reports.
const SORT_OPTIONS = [
  { value: 'terbaru', label: 'Terbaru' },
  { value: 'terlama', label: 'Terlama' },
  { value: 'terparah', label: 'Kerusakan Terparah' },
  { value: 'teringan', label: 'Kerusakan Teringan' },
  { value: 'lokasi_az', label: 'Lokasi A–Z' },
  { value: 'lokasi_za', label: 'Lokasi Z–A' },
];

const sectionTitleStyle = {
  display: 'block',
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
  color: '#64748b',
  marginBottom: 3,
};

const inputStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 12.5,
  boxSizing: 'border-box',
  background: '#fff',
  color: '#1c1917',
};

// Grup checkbox kecil dengan warna dot opsional (untuk severity).
// `cols > 1` = susun dua kolom (hemat tinggi sidebar agar tidak perlu
// scroll — koreksi user). `showTitle=false` untuk grup yang judulnya
// dirender sendiri (mis. Status Vital yang bisa dilipat).
function CheckboxGroup({ title, options, selected, onToggle, cols = 1, showTitle = true }) {
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12.5,
    padding: '2px 0',
    cursor: 'pointer',
    color: '#1c1917',
    minWidth: 0,
  };
  return (
    <div>
      {showTitle && <span style={sectionTitleStyle}>{title}</span>}
      <div
        style={
          cols > 1
            ? {
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                columnGap: 8,
                alignItems: 'start',
              }
            : undefined
        }
      >
        {options.map((o) => (
          <label key={o.value} style={rowStyle}>
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={onToggle(o.value)}
              style={{ margin: 0, flexShrink: 0 }}
            />
            {o.color && (
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: o.color,
                  border: '1px solid #1f2937',
                  flexShrink: 0,
                }}
              />
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function FilterPanel({
  filters,
  onChange,
  onReset,
  onClose,
  onCollapse, // sembunyikan sidebar (desktop)
  eidVerified = false, // status verifikasi e.id pengguna (poin Alur Inti 5)
  eidDisplayName = null, // nama pengguna terverifikasi (untuk ditampilkan)
  onRequestVerify = () => {},
  onLogoutEid = () => {},
  otoritas = null, // sesi otoritas aktif (null = belum masuk) — kartu e.id
  // menampilkan status OTORITAS (KYC) dengan tombol keluar, sejalan dengan
  // login otoritas di header/admin.
  onLogoutOtoritas = () => {},
  onRequestLogin = () => {}, // masuk sebagai OTORITAS (KYC e-KTP)
}) {
  // Toggle nilai multi-select (severity/authority/vital) -> onChange.
  const toggle = (key) => (value) => (e) => {
    const checked = e.target.checked;
    onChange({
      ...filters,
      [key]: checked
        ? [...filters[key], value]
        : filters[key].filter((v) => v !== value),
    });
  };

  const setQ = (e) => onChange({ ...filters, q: e.target.value });
  const setSort = (e) => onChange({ ...filters, sort: e.target.value });

  return (
    <aside
      style={{
        width: 252,
        flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid #e2e8f0',
        overflowY: 'auto',
        padding: '9px 12px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1c1917' }}>
          Filter Laporan
        </h2>
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#1c1917',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset Filter
          </button>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="Sembunyikan panel filter"
              title="Sembunyikan panel filter"
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⏴
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panel filter"
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Search nama lokasi */}
      <div>
        <span style={sectionTitleStyle}>Nama Lokasi</span>
        <input
          type="text"
          value={filters.q}
          onChange={setQ}
          placeholder="Cari nama lokasi…"
          aria-label="Cari Nama Lokasi"
          style={inputStyle}
        />
      </div>

      {/* Sorting (File 1 Bagian 6.8.10) */}
      <div>
        <label htmlFor="sort" style={sectionTitleStyle}>
          Urutkan
        </label>
        <select id="sort" value={filters.sort} onChange={setSort} style={{ ...inputStyle, height: 30 }}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tingkat kerusakan — 2 kolom agar hemat tinggi (tanpa scroll) */}
      <CheckboxGroup
        title="Tingkat Kerusakan"
        options={SEVERITIES}
        selected={filters.severity}
        onToggle={toggle('severity')}
        cols={2}
      />

      {/* Kategori kewenangan */}
      <CheckboxGroup
        title="Kategori Kewenangan"
        options={BRIDGE_AUTHORITIES}
        selected={filters.bridge_authority}
        onToggle={toggle('bridge_authority')}
      />

      {/* Status vital — tetap tampil polos tanpa opsi lipat (koreksi user) */}
      <CheckboxGroup
        title="Status Vital"
        options={VITAL_STATUSES}
        selected={filters.vital_status}
        onToggle={toggle('vital_status')}
      />

      {/* Filter verifikasi titik oleh otoritas (File 1 6.2): tampilkan
          hanya titik yang SUDAH diverifikasi (bercentang ✓ di peta:
          terverifikasi/dalam perbaikan/selesai) atau yang belum. */}
      <div>
        <label htmlFor="verified" style={sectionTitleStyle}>
          Verifikasi Titik
        </label>
        <select
          id="verified"
          value={filters.verified || 'semua'}
          onChange={(e) => onChange({ ...filters, verified: e.target.value })}
          style={{ ...inputStyle, height: 30 }}
        >
          <option value="semua">Semua titik</option>
          <option value="verified">✓ Sudah diverifikasi otoritas</option>
          <option value="belum">Belum diverifikasi</option>
        </select>
        <p style={{ margin: '3px 0 0', fontSize: 10.5, lineHeight: 1.4, color: '#64748b', textAlign: 'justify' }}>
          ✓ = sudah diverifikasi/ditindak otoritas (hijau = selesai diperbaiki).
        </p>
      </div>

      {/* Status verifikasi e.id (poin Alur Inti 5): AKTIF — menampilkan
          ROLE yang terverifikasi. Prioritas: sesi OTORITAS (KYC e-KTP, nama
          sesuai KTP) > warga (Member Lv1). Saat belum: abu-abu + tombol
          verifikasi BIRU MUDA. */}
      <div>
        <span style={sectionTitleStyle}>Status Verifikasi e.id</span>
        {otoritas ? (
          <div
            style={{
              // Warna biru MUDA brand e.id (permintaan user: biru muda).
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#60a5fa',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                ✓
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#2563eb' }}>
                  Terverifikasi e.id
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                  Role: <strong>Otoritas</strong> (KYC e-KTP — nama sesuai KTP)
                </div>
                {otoritas.displayName && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: '#2563eb',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    sebagai {otoritas.displayName}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogoutOtoritas}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Keluar / Logout e.id
            </button>
            <button
              type="button"
              onClick={onRequestVerify}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '7px 10px',
                borderRadius: 6,
                border: 'none',
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Verifikasi sebagai Warga
            </button>
          </div>
        ) : eidVerified ? (
          <div
            style={{
              // Warna biru MUDA brand e.id (permintaan user: biru muda).
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: '#60a5fa',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                ✓
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#2563eb' }}>
                  Terverifikasi e.id
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', marginTop: 2 }}>
                  Role: <strong>Warga</strong> (Member Lv1 — email, nama, alamat, no. telepon)
                </div>
                {eidDisplayName && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: '#2563eb',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    sebagai {eidDisplayName}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onLogoutEid}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '7px 10px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Keluar / Logout e.id
            </button>
            <button
              type="button"
              onClick={onRequestLogin}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '7px 10px',
                borderRadius: 6,
                border: 'none',
                background: '#facc15',
                color: '#1c1917',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Login sebagai Otoritas
            </button>
          </div>
        ) : (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                color: '#475569',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#cbd5e1',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                !
              </span>
              Belum terverifikasi e.id
            </div>
            <button
              type="button"
              onClick={onRequestVerify}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: 'none',
                // Biru MUDA (bukan kuning) — warna brand e.id.
                background: '#60a5fa',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Verifikasi e.id Warga
            </button>
            <button
              type="button"
              onClick={onRequestLogin}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #facc15',
                background: '#fffef5',
                color: '#854d0e',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Login sebagai Otoritas
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
