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
import {
  PRIORITY_TIERS,
  priorityTier,
  priorityScore,
  completenessLevel,
} from '../lib/priority.js';
import VerificationFlow from './VerificationFlow.jsx';
import EidDesktopInfo from './EidDesktopInfo.jsx';
import useIsMobile from '../lib/useIsMobile.js';
import EmptyResults from './EmptyResults.jsx';

// Alur status laporan (File 1 Bagian 6.2): satu arah maju. Tombol tindakan
// otoritas selalu menawarkan STATUS BERIKUTNYA dalam alur ini.
const STATUS_FLOW = ['dilaporkan', 'terverifikasi', 'dalam_perbaikan', 'selesai_diperbaiki'];

// Kunci localStorage untuk status terverifikasi e.id (diisi ReportForm saat
// warga selesai verifikasi; dipakai fitur Dukungan agar tidak scan ulang).
const EID_STORAGE_KEY = 'titikrusak_eid';

// Baca status verifikasi e.id yang tersimpan secara lokal (jika ada).
function getStoredEidVerification() {
  try {
    const raw = localStorage.getItem(EID_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.isVerified ? parsed : null;
  } catch (_e) {
    return null;
  }
}

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
// Saat mode otoritas (otoritasMode), ditambah chip validasi e.id dan
// tingkat kelengkapan — bahan penilaian prioritas (File 1 Bagian 6.2/6.3).
function ReportRow({ report, onClick, otoritasMode = false }) {
  const sev = SEVERITIES.find((s) => s.value === report.severity);
  const severityColor = sev?.color || '#64748b';
  const statusColor = STATUS_COLORS[report.status] || '#64748b';
  const completeness = completenessLevel(report);

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
          {INFRA_LABELS[report.infra_type] || report.infra_type} ·{' '}
          {SEVERITY_LABELS[report.severity] || report.severity}
        </span>
      </span>

      {/* Chip mode otoritas: validasi e.id + kelengkapan laporan */}
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
          <span
            title="Kelengkapan laporan"
            style={{
              padding: '3px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: `${completeness.color}1a`,
              color: completeness.color,
              whiteSpace: 'nowrap',
            }}
          >
            {completeness.label}
          </span>
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

// Modal detail sederhana: seluruh field laporan dari database.
// Layout field menyesuaikan layar (mobile: label di atas nilai).
// Saat otoritas masuk (prop otoritas), modal menampilkan:
//   - tombol tindakan status BERIKUTNYA (approve/verifikasi lalu lanjut ke
//     perbaikan/selesai) — File 1 Bagian 6.2;
//   - fitur Dukungan warga (File 1 Bagian 6.3) yang memerlukan e.id.
function DetailModal({ report, onClose, otoritas = null, onReportUpdated }) {
  const isMobile = useIsMobile();
  const [statusAction, setStatusAction] = useState('idle'); // idle | busy
  const [statusError, setStatusError] = useState('');
  const [voteState, setVoteState] = useState('idle'); // idle | prompt | verifying | busy | done
  const [voteError, setVoteError] = useState('');
  const [voteCount, setVoteCount] = useState(Number(report.vote_count) || 0);
  const [eidVerified, setEidVerified] = useState(() => Boolean(getStoredEidVerification()));

  // Status berikutnya dalam alur (null bila sudah di status akhir).
  const flowIndex = STATUS_FLOW.indexOf(report.status);
  const nextStatus = flowIndex >= 0 && flowIndex < STATUS_FLOW.length - 1
    ? STATUS_FLOW[flowIndex + 1]
    : null;

  const handleStatusAction = async () => {
    if (!nextStatus) return;
    setStatusAction('busy');
    setStatusError('');
    try {
      const res = await fetch(`/api/reports/${report.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          changed_by_display_name: otoritas?.displayName || null,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const d = await res.json();
          if (d.error) msg = d.error;
        } catch (_e) {
          // body bukan JSON
        }
        throw new Error(msg);
      }
      await res.json();
      onReportUpdated(); // peta + daftar me-refresh (marker dapat centang)
      onClose(); // modal menampilkan data lama — tutup agar tidak basi
    } catch (err) {
      setStatusAction('idle');
      setStatusError(err.message);
    }
  };

  const castVote = async (displayName) => {
    setVoteState('busy');
    setVoteError('');
    try {
      const res = await fetch(`/api/reports/${report.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voter_display_name: displayName || null,
          voter_is_verified: true,
        }),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const d = await res.json();
          if (d.error) msg = d.error;
        } catch (_e) {
          // body bukan JSON
        }
        throw new Error(msg);
      }
      const updated = await res.json();
      setVoteCount(Number(updated.vote_count) || voteCount + 1);
      setVoteState('done');
    } catch (err) {
      // 409 (sudah didukung identitas yang sama) juga dianggap selesai —
      // tombol dinonaktifkan agar tidak berulang.
      if (String(err.message).includes('sudah didukung')) {
        setVoteState('done');
        setVoteError('Laporan ini sudah Anda dukung.');
      } else {
        setVoteState('idle');
        setVoteError(err.message);
      }
    }
  };

  const handleVoteClick = () => {
    if (eidVerified) {
      castVote(getStoredEidVerification()?.displayName || null);
    } else {
      setVoteState('prompt');
    }
  };

  const handleVoteVerified = (result) => {
    try {
      localStorage.setItem(EID_STORAGE_KEY, JSON.stringify(result));
    } catch (_e) {
      // abaikan bila localStorage tidak tersedia
    }
    setEidVerified(true);
    setVoteState('busy');
    castVote(result.displayName || null);
  };

  return (
    <div
      className="tk-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        // Mobile: bottom sheet (File 1 Bagian 9.7) — sama dengan modal
        // ReportForm & otoritas; desktop: kartu di tengah.
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
      }}
      onClick={onClose}
    >
      <div
        className="tk-modal-panel"
        style={{
          background: '#fff',
          borderRadius: isMobile ? '14px 14px 0 0' : 12,
          width: '100%',
          maxWidth: 560,
          maxHeight: isMobile ? '92dvh' : '85vh',
          overflowY: 'auto',
          padding: isMobile ? '18px 18px 24px' : '20px 24px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, color: '#1c1917' }}>
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
            {report.status === 'terverifikasi' && report.validated_by_display_name && (
              <span
                style={{
                  display: 'block',
                  marginTop: 4,
                  fontSize: 11.5,
                  color: '#64748b',
                }}
              >
                ✓ Divalidasi oleh {report.validated_by_display_name}
                {report.validated_at ? ` (${report.validated_at})` : ''}
              </span>
            )}
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
                gap: isMobile ? 2 : 10,
                padding: '7px 0',
                borderBottom: '1px solid #f1f5f9',
                alignItems: isMobile ? 'flex-start' : 'center',
                flexDirection: isMobile ? 'column' : 'row',
              }}
            >
              <span
                style={{
                  width: isMobile ? 'auto' : 150,
                  flexShrink: 0,
                  fontSize: isMobile ? 11 : 12,
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
                  color: '#1c1917',
                  wordBreak: 'break-word',
                }}
              >
                {key === 'photo_urls' && Array.isArray(report[key]) && report[key].length > 0 ? (
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {report[key].map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" title={u}>
                        <img
                          src={u}
                          alt="Foto laporan"
                          style={{
                            height: 84,
                            maxWidth: 180,
                            borderRadius: 8,
                            objectFit: 'cover',
                            border: '1px solid #e2e8f0',
                            display: 'block',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </a>
                    ))}
                  </span>
                ) : (
                  formatValue(key, report[key])
                )}
              </span>
            </div>
          ))}
        </div>

        {/* ---- Tindakan otoritas: status berikutnya (File 1 Bagian 6.2) ---- */}
        {otoritas && nextStatus && (
          <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
              Tindakan Otoritas
            </div>
            {statusError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: 8,
                  padding: '8px 10px',
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                {statusError}
              </div>
            )}
            <button
              type="button"
              onClick={handleStatusAction}
              disabled={statusAction === 'busy'}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#f97316',
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: statusAction === 'busy' ? 'wait' : 'pointer',
              }}
            >
              {statusAction === 'busy'
                ? 'Menyimpan…'
                : nextStatus === 'terverifikasi'
                  ? `✓ Tandai ${STATUS_LABELS[nextStatus]} (Approve)`
                  : `Tandai ${STATUS_LABELS[nextStatus]}`}
            </button>
          </div>
        )}

        {/* ---- Dukungan warga (File 1 Bagian 6.3): butuh e.id ---- */}
        <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          {voteState === 'idle' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>
                🤝 Dukungan warga: <strong>{voteCount}</strong>
              </span>
              <button
                type="button"
                onClick={handleVoteClick}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #f97316',
                  background: '#fff',
                  color: '#f97316',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {eidVerified ? 'Dukung laporan' : 'Dukung laporan (e.id)'}
              </button>
            </div>
          )}

          {voteState === 'prompt' && (
            <div
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 8,
                padding: '12px',
              }}
            >
              <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: '#9a3412' }}>
                Fitur Dukungan tersedia untuk warga terverifikasi e.id. Dukungan warga
                menjadi sinyal prioritas bagi otoritas.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {isMobile ? (
                  <EidDesktopInfo
                    title="Verifikasi e.id untuk Dukungan"
                    actionLabel="Kembali"
                    onAction={() => setVoteState('idle')}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setVoteState('verifying')}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#f97316',
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Verifikasi dengan e.id
                  </button>
                )}
                {!isMobile && (
                  <button
                    type="button"
                    onClick={() => setVoteState('idle')}
                    style={{
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
                    Batal
                  </button>
                )}
              </div>
            </div>
          )}

          {voteState === 'verifying' && (
            <VerificationFlow
              role="warga"
              onComplete={handleVoteVerified}
              onCancel={() => setVoteState('prompt')}
            />
          )}

          {(voteState === 'busy' || voteState === 'done') && (
            <div style={{ fontSize: 13, color: '#334155' }}>
              {voteState === 'busy' && <span>Mencatat dukungan…</span>}
              {voteState === 'done' && (
                <span style={{ color: '#15803d', fontWeight: 600 }}>
                  ✓ {voteError || `Terima kasih! Dukungan Anda tercatat (${voteCount}).`}
                </span>
              )}
            </div>
          )}
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
  otoritas = null, // sesi otoritas aktif (null = warga biasa)
  onReportUpdated = () => {},
}) {
  const [selected, setSelected] = useState(null);
  const otoritasMode = Boolean(otoritas);

  // Mode otoritas (File 1 Bagian 6.2/6.3): laporan dikelompokkan berdasarkan
  // prioritas — gabungan severity + validasi e.id + kelengkapan laporan
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

      {reports.length > 0 && !otoritasMode && (
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        />
      )}
    </div>
  );
}
