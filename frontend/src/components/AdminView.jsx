// frontend/src/components/AdminView.jsx
// Halaman Administrator (poin: "page administrator yang juga ada menunya
// sebelum login") — untuk otoritas mengorganize laporan, memverifikasi, dan
// mengeset tracking status tiap laporan yang masuk.
//
// Menu Admin tampil untuk SEMUA pengguna (sebelum login). Saat belum masuk
// sebagai otoritas, halaman menampilkan gerbang masuk (gate) dengan tombol
// login otoritas. Setelah masuk, otoritas melihat seluruh laporan (tidak
// terpengaruh filter sidebar) dikelompokkan berdasarkan prioritas, dengan
// tab filter status, dan bisa membuka DetailModal untuk verifikasi
// (approve) serta memajukan status perbaikan.

import { useMemo, useState } from 'react';
import {
  SEVERITIES,
  SEVERITY_LABELS,
  INFRA_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../lib/labels.js';
import { PRIORITY_TIERS, priorityTier, priorityScore } from '../lib/priority.js';
import { ReportRow } from './ListView.jsx';
import DetailModal from './DetailModal.jsx';
import useIsMobile from '../lib/useIsMobile.js';

const STATUS_TABS = [
  { value: 'semua', label: 'Semua' },
  { value: 'dilaporkan', label: 'Dilaporkan' },
  { value: 'terverifikasi', label: 'Terverifikasi' },
  { value: 'dalam_perbaikan', label: 'Dalam Perbaikan' },
  { value: 'selesai_diperbaiki', label: 'Selesai' },
];

export default function AdminView({
  reports = [],
  otoritas = null,
  onRequestLogin = () => {},
  onReportUpdated = () => {},
  onBack = () => {},
}) {
  const isMobile = useIsMobile();
  const [statusTab, setStatusTab] = useState('semua');
  const [selected, setSelected] = useState(null);
  const otoritasMode = Boolean(otoritas);

  const filtered = useMemo(
    () =>
      statusTab === 'semua'
        ? reports
        : reports.filter((r) => r.status === statusTab),
    [reports, statusTab]
  );

  // Kelompokkan berdasarkan prioritas (sama dengan ListView mode otoritas):
  // severity + validasi e.id + kelengkapan + dukungan warga.
  const groups = useMemo(
    () =>
      PRIORITY_TIERS.map((tier) => ({
        tier,
        reports: filtered
          .filter((r) => priorityTier(r).value === tier.value)
          .sort((a, b) => {
            const sa = priorityScore(a).score;
            const sb = priorityScore(b).score;
            if (sb !== sa) return sb - sa;
            return String(b.created_at).localeCompare(String(a.created_at));
          }),
      })).filter((g) => g.reports.length > 0),
    [filtered]
  );

  const countByStatus = (value) =>
    value === 'semua' ? reports.length : reports.filter((r) => r.status === value).length;

  // ---- Gerbang: belum masuk sebagai otoritas ----
  if (!otoritasMode) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            maxWidth: 420,
            width: '100%',
            padding: '28px 24px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          }}
        >
          <div style={{ fontSize: 38, marginBottom: 10 }}>🛠️</div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#1c1917' }}>
            Panel Administrator
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: '#475569' }}>
            Halaman ini khusus <strong>Otoritas</strong> — untuk mengorganize
            laporan, memverifikasi laporan, dan mengeset tracking status tiap
            laporan yang masuk. Masuk terlebih dahulu dengan e.id Anda.
          </p>
          <button
            type="button"
            onClick={onRequestLogin}
            style={{
              marginTop: 18,
              width: '100%',
              padding: '12px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#facc15',
              color: '#1c1917',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔒 Masuk sebagai Otoritas
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
              marginTop: 8,
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#1c1917',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← Kembali ke Peta
          </button>
        </div>
      </div>
    );
  }

  // ---- Panel otoritas ----
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        background: '#f8fafc',
        overflowY: 'auto',
        padding: isMobile ? '16px 12px 24px' : '20px 20px 28px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ margin: 0, fontSize: 19, color: '#1c1917' }}>
              🛠️ Panel Administrator
            </h2>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 3 }}>
              Masuk sebagai <strong>{otoritas.displayName}</strong> ·{' '}
              {reports.length} laporan total
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#1c1917',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Kembali ke Peta
          </button>
        </div>

        {/* Tab filter status + jumlah */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {STATUS_TABS.map((tab) => {
            const active = statusTab === tab.value;
            const color = tab.value === 'semua' ? '#1c1917' : STATUS_COLORS[tab.value];
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusTab(tab.value)}
                style={{
                  padding: '7px 13px',
                  borderRadius: 999,
                  border: active ? '1px solid #1c1917' : '1px solid #cbd5e1',
                  background: active ? '#1c1917' : '#fff',
                  color: active ? '#fff' : '#334155',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tab.label} ({countByStatus(tab.value)})
              </button>
            );
          })}
        </div>

        {groups.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '30px 12px',
              background: '#fff',
              border: '1px dashed #cbd5e1',
              borderRadius: 10,
              fontSize: 13.5,
              color: '#64748b',
            }}
          >
            Tidak ada laporan dengan status ini.
          </div>
        )}

        {groups.map(({ tier, reports: tierReports }) => (
          <div key={tier.value} style={{ marginBottom: 16 }}>
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

        <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
          Tip: buka laporan untuk memverifikasi (approve) atau memajukan status
          perbaikan. Laporan dari media (berita) ditandai sumbernya di detail.
        </div>
      </div>

      {selected && (
        <DetailModal
          report={selected}
          onClose={() => setSelected(null)}
          otoritas={otoritas}
          onReportUpdated={onReportUpdated}
        />
      )}
    </div>
  );
}
