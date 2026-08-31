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
  fontSize: 11.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: '#64748b',
  marginBottom: 6,
};

const inputStyle = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  boxSizing: 'border-box',
  background: '#fff',
  color: '#0f172a',
};

// Grup checkbox kecil dengan warna dot opsional (untuk severity).
function CheckboxGroup({ title, options, selected, onToggle }) {
  return (
    <div>
      <span style={sectionTitleStyle}>{title}</span>
      {options.map((o) => (
        <label
          key={o.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 13,
            padding: '3px 0',
            cursor: 'pointer',
            color: '#0f172a',
          }}
        >
          <input
            type="checkbox"
            checked={selected.includes(o.value)}
            onChange={onToggle(o.value)}
          />
          {o.color && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: o.color,
                border: '1px solid #1f2937',
                flexShrink: 0,
              }}
            />
          )}
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function FilterPanel({ filters, onChange, onReset, onClose }) {
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
        padding: '14px 14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 15,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
          Filter Laporan
        </h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset Filter
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panel filter"
              style={{
                padding: '5px 9px',
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
        <select id="sort" value={filters.sort} onChange={setSort} style={{ ...inputStyle, height: 34 }}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tingkat kerusakan */}
      <CheckboxGroup
        title="Tingkat Kerusakan"
        options={SEVERITIES}
        selected={filters.severity}
        onToggle={toggle('severity')}
      />

      {/* Kategori kewenangan */}
      <CheckboxGroup
        title="Kategori Kewenangan"
        options={BRIDGE_AUTHORITIES}
        selected={filters.bridge_authority}
        onToggle={toggle('bridge_authority')}
      />

      {/* Status vital */}
      <CheckboxGroup
        title="Status Vital"
        options={VITAL_STATUSES}
        selected={filters.vital_status}
        onToggle={toggle('vital_status')}
      />

      {/* Status verifikasi — nonaktif sampai verifikasi e.id ada (File 2 Bagian 7.1) */}
      <div>
        <span style={sectionTitleStyle}>Status Verifikasi</span>
        <select
          disabled
          value=""
          style={{ ...inputStyle, height: 34, color: '#94a3b8', background: '#f1f5f9' }}
          aria-label="Status Verifikasi"
        >
          <option value="">Semua Status</option>
          <option value="dilaporkan">Dilaporkan</option>
          <option value="terverifikasi">Terverifikasi</option>
          <option value="dalam_perbaikan">Dalam Perbaikan</option>
          <option value="selesai_diperbaiki">Selesai Diperbaiki</option>
        </select>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>
          Menyusul setelah verifikasi e.id aktif.
        </p>
      </div>
    </aside>
  );
}
