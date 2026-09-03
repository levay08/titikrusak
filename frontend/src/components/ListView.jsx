// frontend/src/components/ListView.jsx
// Mode tampilan kedua "Daftar" (File 1 Bagian 9.2), alternatif MapView.
// ListView dan MapView menampilkan data yang SAMA - keduanya menerima
// props `reports` dari App (satu fetch, hasil filter/sorting aktif yang
// sama; lihat App.jsx). FilterPanel di sidebar tetap dipakai bersama.
//
// Setiap baris: badge warna severity, nama/lokasi singkat, jenis
// infrastruktur, status laporan. Klik baris membuka modal detail berisi
// seluruh field laporan dari database (DetailModal.jsx - dipakai juga oleh
// MapView, modal pencarian, dan halaman Admin).

import Breadcrumb, { homeCrumb } from './Breadcrumb.jsx';
import { useState } from 'react';
import {
  SEVERITIES,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  INFRA_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../lib/labels.js';
import {
  PRIORITY_TIERS,
  priorityTier,
  priorityScore,
} from '../lib/priority.js';
import useIsMobile from '../lib/useIsMobile.js';
import EmptyResults from './EmptyResults.jsx';
import DetailModal from './DetailModal.jsx';

// Satu baris ringkas laporan: severity badge, nama lokasi, jenis, status.
// Saat mode otoritas (otoritasMode), ditambah chip validasi e.id dan
// tingkat kelengkapan - bahan penilaian prioritas (File 1 Bagian 6.2/6.3).
// Diexport untuk dipakai bersama halaman Admin (AdminView.jsx).
export function ReportRow({ report, onClick, otoritasMode = false }) {
  const sev = SEVERITIES.find((s) => s.value === report.severity);
  const severityColor = sev?.color || '#64748b';
  const statusColor = STATUS_COLORS[report.status] || '#64748b';

  return (
    <button
      type="button"
      className="tk-row-hover"
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
            color: '#1c1917',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {report.location_name}
        </span>
        <span style={{ display: 'block', fontSize: 12, color: '#64748b', marginTop: 2 }}>
          Kategori {INFRA_LABELS[report.infra_type] || report.infra_type} - Kerusakan{' '}
          {SEVERITY_LABELS[report.severity] || report.severity}
        </span>
      </span>

      {/* Chip mode otoritas: validasi e.id pelapor */}
      {otoritasMode && (
        <span style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {report.reporter_is_verified ? (
            <span
              title="Pelapor terverifikasi e.id"
              style={{
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: '#dcfce7',
                color: '#15803d',
                whiteSpace: 'nowrap',
              }}
            >
              ✓ e.id
            </span>
          ) : (
            <span
              title="Pelapor tidak terverifikasi e.id"
              style={{
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: '#f1f5f9',
                color: '#64748b',
                whiteSpace: 'nowrap',
              }}
            >
              Tanpa e.id
            </span>
          )}
        </span>
      )}

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

export default function ListView({
  reports = [],
  error = null,
  onResetFilters,
  hasAnyData = null, // null = total belum diketahui (jangan render empty state)
  onOpenReportForm,
  otoritas = null, // sesi otoritas aktif (null = warga biasa)
  onReportUpdated = () => {},
}) {
  const [selected, setSelected] = useState(null);
  const otoritasMode = Boolean(otoritas);

  // Mode otoritas (File 1 Bagian 6.2/6.3): laporan dikelompokkan berdasarkan
  // prioritas - gabungan severity + validasi e.id + kelengkapan laporan
  // (lihat src/lib/priority.js). Grup diurutkan tier tertinggi dulu;
  // di dalam grup, skor prioritas turun lalu created_at terbaru.
  const groups = otoritasMode
    ? PRIORITY_TIERS.map((tier) => ({
        tier,
        reports: reports
          .filter((r) => priorityTier(r).value === tier.value)
          .sort((a, b) => {
            const sa = priorityScore(a).score;
            const sb = priorityScore(b).score;
            if (sb !== sa) return sb - sa;
            return String(b.created_at).localeCompare(String(a.created_at));
          }),
      })).filter((g) => g.reports.length > 0)
    : [];

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
      {/* Kondisi hasil kosong (File 1 Bagian 9.1/9.2) - sama dengan
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

      {reports.length > 0 && !otoritasMode && (
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Breadcrumb items={[homeCrumb(), { label: 'Daftar Laporan' }]} />
          <div style={{ fontSize: 12, color: '#64748b', padding: '0 4px' }}>
            {reports.length} laporan
          </div>
          {reports.map((report) => (
            <ReportRow key={report.id} report={report} onClick={() => setSelected(report)} />
          ))}
        </div>
      )}

      {/* Mode otoritas: daftar dikelompokkan per tier prioritas */}
      {reports.length > 0 && otoritasMode && (
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Breadcrumb items={[homeCrumb(), { label: 'Daftar Laporan' }]} />
          <div style={{ fontSize: 12, color: '#64748b', padding: '0 4px' }}>
            {reports.length} laporan · dikelompokkan berdasarkan prioritas (severity + e.id + kelengkapan)
          </div>
          {groups.map(({ tier, reports: tierReports }) => (
            <div key={tier.value}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  borderRadius: 8,
                  background: `${tier.color}14`,
                  border: `1px solid ${tier.color}55`,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: tier.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1917' }}>
                  Prioritas {tier.label}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {tierReports.length} laporan
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tierReports.map((report) => (
                  <ReportRow
                    key={report.id}
                    report={report}
                    onClick={() => setSelected(report)}
                    otoritasMode
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <DetailModal
          report={selected}
          onClose={() => setSelected(null)}
          otoritas={otoritas}
          onReportUpdated={onReportUpdated}
          origin="list"
          onOriginClick={() => setSelected(null)}
        />
      )}
    </div>
  );
}
