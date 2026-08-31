// frontend/src/components/ListView.jsx
// Mode tampilan kedua "Daftar" (File 1 Bagian 9.2), alternatif MapView.
// ListView dan MapView menampilkan data yang SAMA — keduanya menerima
// props `reports` dari App (satu fetch, hasil filter/sorting aktif yang
// sama; lihat App.jsx). FilterPanel di sidebar tetap dipakai bersama.
//
// Setiap baris: badge warna severity, nama/lokasi singkat, jenis
// infrastruktur, status laporan. Klik baris membuka modal detail berisi
// seluruh field laporan dari database (komponen detail lengkap sesuai
// File 1 Bagian 9.5 menyusul di langkah terpisah).

import { useState } from 'react';
import {
  SEVERITIES,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  INFRA_LABELS,
  AUTHORITY_LABELS,
  VITAL_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../lib/labels.js';
import EmptyResults from './EmptyResults.jsx';

// Urutan + label seluruh field laporan untuk modal detail.
// Field DID (reporter_verified_did, validated_by_did) memang tidak ada di
// response publik backend (aturan "field DID tidak boleh muncul").
const FIELD_ORDER = [
  ['id', 'ID'],
  ['status', 'Status'],
  ['infra_type', 'Jenis Infrastruktur'],
  ['severity', 'Tingkat Kerusakan'],
  ['bridge_authority', 'Kategori Kewenangan'],
  ['location_name', 'Nama Lokasi'],
  ['lat', 'Latitude'],
  ['lng', 'Longitude'],
  ['description', 'Deskripsi'],
  ['vital_status', 'Status Vital'],
  ['vital_status_note', 'Catatan Status Vital'],
  ['created_at', 'Dilaporkan pada'],
  ['updated_at', 'Diperbarui pada'],
  ['reporter_display_name', 'Nama Pelapor'],
  ['reporter_is_verified', 'Pelapor Terverifikasi'],
  ['validated_by_display_name', 'Divalidasi oleh'],
  ['validated_at', 'Waktu Validasi'],
  ['photo_urls', 'Foto'],
  ['source_type', 'Sumber Laporan'],
  ['source_media_name', 'Nama Media'],
  ['source_media_url', 'URL Media'],
  ['source_media_date', 'Tanggal Media'],
  ['related_earthquake', 'Gempa Terkait'],
  ['related_weather', 'Cuaca Terkait'],
  ['vote_count', 'Jumlah Vote'],
];

// Format nilai enum/array/boolean untuk ditampilkan di detail.
function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'severity') return SEVERITY_LABELS[value] || value;
  if (key === 'infra_type') return INFRA_LABELS[value] || value;
  if (key === 'bridge_authority') return AUTHORITY_LABELS[value] || value;
  if (key === 'status') return STATUS_LABELS[value] || value;
  if (key === 'vital_status') {
    return Array.isArray(value) ? value.map((v) => VITAL_LABELS[v] || v).join(', ') : value;
  }
  if (key === 'reporter_is_verified') return value ? 'Ya' : 'Tidak';
  if (key === 'lat' || key === 'lng') return Number(value).toFixed(5);
  if (key === 'photo_urls') {
    return Array.isArray(value) && value.length > 0 ? value.join(', ') : '—';
  }
  return String(value);
}

// Satu baris ringkas laporan: severity badge, nama lokasi, jenis, status.
function ReportRow({ report, onClick }) {
  const sev = SEVERITIES.find((s) => s.value === report.severity);
  const severityColor = sev?.color || '#64748b';
  const statusColor = STATUS_COLORS[report.status] || '#64748b';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Badge warna severity */}
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: severityColor,
          border: '3px solid #fff',
          boxShadow: `0 0 0 2px ${severityColor}`,
          flexShrink: 0,
        }}
        title={`Kerusakan: ${SEVERITY_LABELS[report.severity] || report.severity}`}
      />
      {/* Nama lokasi singkat + sub-info */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontWeight: 600,
            fontSize: 14,
            color: '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {report.location_name}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {INFRA_LABELS[report.infra_type] || report.infra_type} ·{' '}
          {SEVERITY_LABELS[report.severity] || report.severity}
        </span>
      </span>
      {/* Status laporan saat ini */}
      <span
        style={{
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          background: `${statusColor}1a`,
          color: statusColor,
          flexShrink: 0,
        }}
      >
        {STATUS_LABELS[report.status] || report.status}
      </span>
    </button>
  );
}

// Modal detail sederhana: seluruh field laporan dari database.
function DetailModal({ report, onClose }) {
  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 560,
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '20px 24px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, color: '#0f172a' }}>
              {report.location_name}
            </h2>
            <span
              style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: `${(STATUS_COLORS[report.status] || '#64748b')}1a`,
                color: STATUS_COLORS[report.status] || '#64748b',
              }}
            >
              {STATUS_LABELS[report.status] || report.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail laporan"
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
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div>
          {FIELD_ORDER.filter(([key]) => report[key] !== undefined).map(([key, label]) => (
            <div
              key={key}
              style={{
                display: 'flex',
                gap: 10,
                padding: '7px 0',
                borderBottom: '1px solid #f1f5f9',
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  width: 150,
                  flexShrink: 0,
                  fontSize: 12,
                  color: '#64748b',
                  paddingTop: 1,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: '#0f172a',
                  wordBreak: 'break-word',
                }}
              >
                {formatValue(key, report[key])}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ListView({
  reports = [],
  error = null,
  onResetFilters,
  hasAnyData = null, // null = total belum diketahui (jangan render empty state)
  onOpenReportForm,
}) {
  const [selected, setSelected] = useState(null);

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        background: '#f8fafc',
        overflowY: 'auto',
        // Ruang di atas agar baris pertama tidak tertutup toggle Peta/Daftar.
        padding: '54px 16px 24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Kondisi hasil kosong (File 1 Bagian 9.1/9.2) — sama dengan
          MapView; hasAnyData membedakan DB kosong vs filter tak cocok */}
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
            top: 46,
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

      {reports.length > 0 && (
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#64748b', padding: '0 4px' }}>
            {reports.length} laporan
          </div>
          {reports.map((report) => (
            <ReportRow key={report.id} report={report} onClick={() => setSelected(report)} />
          ))}
        </div>
      )}

      {selected && <DetailModal report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
