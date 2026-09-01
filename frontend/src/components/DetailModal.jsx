// frontend/src/components/DetailModal.jsx
// Modal detail laporan: seluruh field laporan dari database.
// Layout field menyesuaikan layar (mobile: label di atas nilai).
// Saat otoritas masuk (prop otoritas), modal menampilkan:
//   - tombol tindakan status BERIKUTNYA (approve/verifikasi lalu lanjut ke
//     perbaikan/selesai) — File 1 Bagian 6.2;
//   - fitur Dukungan warga (File 1 Bagian 6.3) yang memerlukan e.id.
//
// Dipakai bersama oleh ListView (klik baris), MapView (tombol "Lihat
// Detail" di popup marker), modal hasil pencarian header, dan halaman
// Admin — satu komponen detail untuk semua titik masuk.

import { useState, useEffect } from 'react';
import {
  SEVERITY_LABELS,
  INFRA_LABELS,
  AUTHORITY_LABELS,
  VITAL_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../lib/labels.js';
import VerificationFlow from './VerificationFlow.jsx';
import EidDesktopInfo from './EidDesktopInfo.jsx';
import useIsMobile from '../lib/useIsMobile.js';

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

// ---- Enrichment BMKG (File 1 Bagian 5.8 / File 2 Bagian 7.2) ----
// related_earthquake / related_weather disimpan sebagai string JSON di DB
// (backend mengembalikannya sebagai objek). Badge kontekstual di bawah
// WAJIB mencantumkan atribusi "Sumber: BMKG" (File 1 Bagian 10.4/11.4).

function parseEnrich(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_e) {
    return null;
  }
}

const BMKG_SOURCE = (
  <span
    style={{
      display: 'block',
      marginTop: 5,
      fontSize: 10.5,
      color: '#64748b',
    }}
  >
    Sumber:{' '}
    <a
      href="https://www.bmkg.go.id"
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#64748b', textDecoration: 'underline' }}
    >
      BMKG
    </a>
  </span>
);

// Badge gempa terdekat: M{magnitude} · {lokasi} · {tanggal} (≈{jarak} km).
function EarthquakeBadge({ value }) {
  const d = parseEnrich(value);
  if (!d) return '—';
  return (
    <span
      style={{
        display: 'inline-block',
        background: '#fef3c7',
        border: '1px solid #fcd34d',
        color: '#78350f',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      Gempa terdekat: M{d.magnitude} — {d.location} ({d.date}, ±{d.distance_km} km)
      {BMKG_SOURCE}
    </span>
  );
}

// Badge cuaca: {kondisi} · {rentang suhu} — berlaku {tanggal}.
function WeatherBadge({ value }) {
  const d = parseEnrich(value);
  if (!d) return '—';
  return (
    <span
      style={{
        display: 'inline-block',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        color: '#1e3a8a',
        borderRadius: 8,
        padding: '6px 10px',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      Cuaca: {d.condition} · {d.temp_range} — berlaku {d.valid_date}
      {BMKG_SOURCE}
    </span>
  );
}

export default function DetailModal({ report, onClose, otoritas = null, onReportUpdated }) {
  const isMobile = useIsMobile();
  const [statusAction, setStatusAction] = useState('idle'); // idle | busy
  const [statusError, setStatusError] = useState('');
  const [voteState, setVoteState] = useState('idle'); // idle | prompt | verifying | busy | done
  const [voteError, setVoteError] = useState('');
  const [voteCount, setVoteCount] = useState(Number(report.vote_count) || 0);
  const [eidVerified, setEidVerified] = useState(() => Boolean(getStoredEidVerification()));
  // Foto yang sedang dibuka dalam frame (lightbox dalam situs — tidak
  // membuka tab baru / tidak menutup layar; bisa ditutup).
  const [photoView, setPhotoView] = useState(null);

  // Enrichment BMKG yang dimuat ulang untuk laporan lama yang belum punya
  // data (File 2 Bagian 7.2): dipanggil saat detail dibuka, best-effort.
  // Endpoint: GET /api/enrichment/disaster & /weather (File 1 Bagian 7.4).
  const [liveEnrich, setLiveEnrich] = useState({ earthquake: null, weather: null });

  useEffect(() => {
    const hasLatLng = Number.isFinite(Number(report.lat)) && Number.isFinite(Number(report.lng));
    if (!hasLatLng) return undefined;
    let cancelled = false;
    const fetchEnrichment = async (kind) => {
      try {
        const res = await fetch(
          `/api/enrichment/${kind}?lat=${encodeURIComponent(report.lat)}&lng=${encodeURIComponent(report.lng)}`
        );
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body && body.data) {
          setLiveEnrich((prev) => ({
            ...prev,
            [kind === 'disaster' ? 'earthquake' : 'weather']: body.data,
          }));
        }
      } catch (_e) {
        // best-effort: gagal/tidak ada data -> dibiarkan tanpa badge.
      }
    };
    if (!report.related_earthquake) fetchEnrichment('disaster');
    if (!report.related_weather) fetchEnrichment('weather');
    return () => {
      cancelled = true;
    };
  }, [report.id, report.lat, report.lng, report.related_earthquake, report.related_weather]);

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
                      <button
                        key={u}
                        type="button"
                        onClick={() => setPhotoView(u)}
                        title="Klik untuk melihat foto lebih besar"
                        aria-label="Lihat foto laporan lebih besar"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'zoom-in',
                          display: 'block',
                        }}
                      >
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
                      </button>
                    ))}
                  </span>
                ) : key === 'related_earthquake' ? (
                  <EarthquakeBadge value={report[key] ?? liveEnrich.earthquake} />
                ) : key === 'related_weather' ? (
                  <WeatherBadge value={report[key] ?? liveEnrich.weather} />
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
                background: '#facc15',
                color: '#1c1917',
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

        {/* ---- Dukungan warga (File 1 Bagian 6.3): butuh e.id ----
            Otoritas TIDAK bisa mendukung laporan — hanya warga yang
            memberikan dukungan; saat sesi otoritas aktif tampil jumlahnya
            saja tanpa tombol. */}
        <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          {otoritas ? (
            <div style={{ fontSize: 13, color: '#334155' }}>
              🤝 Dukungan warga: <strong>{voteCount}</strong>
              <span style={{ display: 'block', fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                Dukungan diberikan oleh warga terverifikasi e.id — otoritas tidak
                memberikan dukungan.
              </span>
            </div>
          ) : voteState === 'idle' ? (
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
                  border: '1px solid #eab308',
                  background: '#fff',
                  color: '#eab308',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {eidVerified ? 'Dukung laporan' : 'Dukung laporan (e.id)'}
              </button>
            </div>
          ) : null}

          {!otoritas && voteState === 'prompt' && (
            <div
              style={{
                background: '#fefce8',
                border: '1px solid #fef08a',
                borderRadius: 8,
                padding: '12px',
              }}
            >
              <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: '#854d0e' }}>
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
                      background: '#facc15',
                      color: '#1c1917',
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

      {/* ---- Foto dalam frame (lightbox dalam situs): tidak membuka tab
          baru, tidak menutup layar penuh; bisa ditutup via ✕ / klik
          backdrop ---- */}
      {photoView && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400, // di atas modal detail (1200)
            background: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setPhotoView(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 10,
              maxWidth: '92vw',
              maxHeight: '88vh',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPhotoView(null)}
              aria-label="Tutup foto"
              title="Tutup foto"
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
            <img
              src={photoView}
              alt="Foto laporan (besar)"
              style={{
                maxWidth: '88vw',
                maxHeight: '72vh',
                objectFit: 'contain',
                borderRadius: 8,
                display: 'block',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
