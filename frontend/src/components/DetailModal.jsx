// frontend/src/components/DetailModal.jsx
// Modal detail laporan: seluruh field laporan dari database.
// Layout field menyesuaikan layar (mobile: label di atas nilai).
// Saat otoritas masuk (prop otoritas), modal menampilkan:
//   - tombol tindakan status BERIKUTNYA (approve/verifikasi lalu lanjut ke
//     perbaikan/selesai) - File 1 Bagian 6.2;
//   - fitur Dukungan warga (File 1 Bagian 6.3) yang memerlukan e.id.
//
// Dipakai bersama oleh ListView (klik baris), MapView (tombol "Lihat
// Detail" di popup marker), modal hasil pencarian header, dan halaman
// Admin - satu komponen detail untuk semua titik masuk.

import { useState, useEffect } from 'react';
import Breadcrumb, { homeCrumb } from './Breadcrumb.jsx';
import {
  SEVERITY_LABELS,
  INFRA_LABELS,
  AUTHORITY_LABELS,
  VITAL_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../lib/labels.js';
import VerificationFlow from './VerificationFlow.jsx';
import ReportManagePanel from './ReportManagePanel.jsx';
import ShareButtons from './ShareButtons.jsx';
import Discussion from './Discussion.jsx';
import { setEidSession, eidSessionHeaders } from '../lib/eidSession.js';
import { beacon } from '../lib/interest.js';
import useIsMobile from '../lib/useIsMobile.js';
import useIsTouchDevice from '../lib/useIsTouchDevice.js';

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
];

// Ledakan bintang saat dukungan berhasil: [dx, dy, delayMs]
const LIKE_STARS = [
  [-54, -34, 0], [54, -30, 60], [-38, 6, 120], [42, 14, 180],
  [-70, -10, 40], [64, -48, 90], [-14, -58, 20], [10, -64, 210],
];

function ThumbIcon({ active = false, size = 26 }) {
  // Ikon jempol gaya solid klasik (Font Awesome), lebih tegas & enak
  // dilihat di ukuran kecil dibanding versi sebelumnya.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden="true"
      style={{
        display: 'block',
        filter: active ? 'drop-shadow(0 1px 2px rgba(37, 99, 235, 0.45))' : undefined,
        transition: 'filter .15s ease',
      }}
    >
      {active && (
        <defs>
          <linearGradient id="tkThumbGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M104 224H24c-13.255 0-24 10.745-24 24v192c0 13.255 10.745 24 24 24h80c13.255 0 24-10.745 24-24V248c0-13.255-10.745-24-24-24zM320 64c-13.255 0-24 10.745-24 24v304c0 13.255 10.745 24 24 24h24c79.529 0 144-64.471 144-144v-64c0-79.529-64.471-144-144-144h-24z"
        fill={active ? 'url(#tkThumbGrad)' : '#cbd5e1'}
      />
    </svg>
  );
}

// Format nilai enum/array/boolean untuk ditampilkan di detail.
function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return '-';
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
    return Array.isArray(value) && value.length > 0 ? value.join(', ') : '-';
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
    // Nilai lama berupa teks bebas (mis. seed NTT "Gempa Laut Flores M7,7
    // (15/8/2026)") - tampilkan apa adanya.
    return value;
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
  if (!d) return '-';
  // Nilai teks biasa (seed lama): tampilkan langsung tanpa format objek.
  if (typeof d === 'string') {
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
        {d}
        {BMKG_SOURCE}
      </span>
    );
  }
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
      Gempa terdekat: M{d.magnitude} - {d.location} ({d.date}, ±{d.distance_km} km)
      {BMKG_SOURCE}
    </span>
  );
}

// Badge cuaca: {kondisi} · {rentang suhu} - berlaku {tanggal}.
function WeatherBadge({ value }) {
  const d = parseEnrich(value);
  if (!d) return '-';
  // Nilai teks biasa: tampilkan langsung.
  if (typeof d === 'string') {
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
        {d}
        {BMKG_SOURCE}
      </span>
    );
  }
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
      Cuaca: {d.condition} · {d.temp_range} - berlaku {d.valid_date}
      {BMKG_SOURCE}
    </span>
  );
}

export default function DetailModal({ report, onClose, otoritas = null, onReportUpdated, origin = null, onOriginClick = null, mode = 'modal', ...restProps }) {
  const isSide = mode === 'side';
  const isMobile = useIsMobile();
  // Perangkat sentuh (ponsel/tablet): verifikasi e.id untuk fitur Dukung
  // lewat deep link wallet (tanpa scan QR) - lihat VerificationFlow.
  const isTouchDevice = useIsTouchDevice();
  // Label asal navigasi untuk breadcrumb detail (File 1 Bagian 4.2):
  // 'list' -> Daftar Laporan, 'map' -> Peta, null -> tanpa breadcrumb.
  const originLabel = origin === 'list' ? 'Daftar Laporan' : origin === 'map' ? 'Peta' : null;
  const [statusAction, setStatusAction] = useState('idle'); // idle | busy
  const [statusError, setStatusError] = useState('');
  const [voteState, setVoteState] = useState('idle'); // idle | prompt | verifying | busy | done
  const [voteError, setVoteError] = useState('');
  const [voteCount, setVoteCount] = useState(Number(report.vote_count) || 0);
  const [eidVerified, setEidVerified] = useState(() => Boolean(getStoredEidVerification()));
  // Animasi like: likeBurst naik tiap dukungan sukses (memicu pop + bintang);
  // hasVoted menandai user sudah pernah mendukung (ikon biru, tombol terkunci).
  const [likeBurst, setLikeBurst] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  // Bookmark (tandai laporan): pin lokal per perangkat.
  const BM_KEY = 'titikrusak_bookmarks';
  const getBm = () => {
    try {
      return JSON.parse(localStorage.getItem(BM_KEY)) || [];
    } catch (_e) {
      return [];
    }
  };
  const [marked, setMarked] = useState(() => getBm().includes(Number(report.id)));
  const [pinPop, setPinPop] = useState(0);
  const toggleBookmark = () => {
    const arr = getBm();
    const id = Number(report.id);
    const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    try {
      localStorage.setItem(BM_KEY, JSON.stringify(next));
    } catch (_e) {
      /* abaikan */
    }
    setMarked(!arr.includes(id));
    setPinPop((p) => p + 1);
  };
  // Foto yang sedang dibuka dalam frame (lightbox dalam situs - tidak
  // membuka tab baru / tidak menutup layar; bisa ditutup).
  const [photoView, setPhotoView] = useState(null);

  // Sinyal minat: user membuka detail sebuah laporan (tanpa data tambahan).
  useEffect(() => {
    beacon('detail_open');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Riwayat status titik (transparansi publik) - tanpa nama pribadi otoritas.
  const [statusHistory, setStatusHistory] = useState(null);
  useEffect(() => {
    let on = true;
    fetch(`/api/activity/report/${report.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (on && d && Array.isArray(d.history) && d.history.length > 0) {
          setStatusHistory(d.history);
        }
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [report.id]);

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
        headers: { 'Content-Type': 'application/json', ...eidSessionHeaders() },
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
      onClose(); // modal menampilkan data lama - tutup agar tidak basi
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
        headers: { 'Content-Type': 'application/json', ...eidSessionHeaders() },
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
      setHasVoted(true);
      setLikeBurst((b) => b + 1); // pop jempol + ledakan bintang
    } catch (err) {
      // 409 (sudah didukung identitas yang sama) juga dianggap selesai -
      // tombol dinonaktifkan agar tidak berulang.
      if (String(err.message).includes('sudah didukung')) {
        setVoteState('done');
        setVoteError('Laporan ini sudah Anda dukung.');
        setHasVoted(true);
      } else {
        setVoteState('idle');
        setVoteError(err.message);
      }
    }
  };

  const removeVote = async () => {
    setVoteState('busy');
    setVoteError('');
    try {
      const res = await fetch(`/api/reports/${report.id}/vote`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...eidSessionHeaders() },
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
      setVoteCount(Number(updated.vote_count) || Math.max(0, voteCount - 1));
      setVoteState('idle');
      setHasVoted(false);
    } catch (err) {
      setVoteState('idle');
      setVoteError(err.message);
    }
  };

  const handleVoteClick = () => {
    if (eidVerified) {
      // Sudah mendukung -> klik lagi untuk membatalkan (unlike).
      if (hasVoted) {
        removeVote();
      } else {
        castVote(getStoredEidVerification()?.displayName || null);
      }
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
    setEidSession({ session_id: result.session_id, role: 'warga' });
    setEidVerified(true);
    setVoteState('busy');
    castVote(result.displayName || null);
  };

  return (
    <div
      className="tk-modal-backdrop"
      style={
        isSide
          ? { position: 'relative', inset: 0, background: 'transparent', display: 'flex', height: '100%' }
          : {
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(15, 23, 42, 0.55)',
              display: 'flex',
              // Mobile: bottom sheet (File 1 Bagian 9.7) - sama dengan modal
              // ReportForm & otoritas; desktop: kartu di tengah.
              alignItems: isMobile ? 'flex-end' : 'center',
              justifyContent: 'center',
              padding: isMobile ? 0 : 16,
            }
      }
      onClick={isSide ? undefined : onClose}
    >
      <div
        className="tk-modal-panel"
        style={
          isSide
            ? {
                background: '#fff',
                width: '100%',
                height: '100%',
                borderLeft: '1px solid #e2e8f0',
                overflowY: 'auto',
                padding: '16px 20px',
                boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.08)',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 16,
              }
            : {
                background: '#fff',
                borderRadius: isMobile ? '14px 14px 0 0' : 12,
                width: isMobile ? '100%' : 'min(940px, 96vw)',
                maxWidth: isMobile ? undefined : 940,
                maxHeight: isMobile ? '92dvh' : '85vh',
                overflowY: 'auto',
                padding: isMobile ? '18px 18px 24px' : '20px 24px',
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
                // Desktop: dua kolom - kiri detail laporan, kanan bagikan +
                // diskusi (sticky). Mobile: satu kolom (ditumpuk).
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'flex-start',
                gap: isMobile ? 0 : 18,
              }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ flex: 1, minWidth: 0, maxWidth: 620 }}>
        {originLabel && (
          <Breadcrumb
            items={[
              homeCrumb(),
              onOriginClick
                ? { label: originLabel, onClick: onOriginClick }
                : { label: originLabel },
              { label: report.location_name },
            ]}
          />
        )}

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
            aria-label={marked ? 'Hapus dari bookmark' : 'Tandai laporan (bookmark)'}
            title={marked ? 'Hapus dari bookmark' : 'Tandai laporan'}
            onClick={toggleBookmark}
            style={{
              border: marked ? '1px solid #eab308' : '1px solid #cbd5e1',
              background: marked ? '#fefce8' : '#fff',
              borderRadius: 6,
              width: 30,
              height: 30,
              fontSize: 16,
              lineHeight: 1,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span key={pinPop} className="tk-pin-pop">
              {marked ? '📍' : '📌'}
            </span>
          </button>
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

        {/* Klaim perbaikan dari media (monitor berita) - publik */}
        {report.media_repair_url && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12.5,
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            <strong>● Menurut media sudah diperbaiki</strong> - menunggu
            verifikasi otoritas.{' '}
            <a
              href={report.media_repair_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#15803d', fontWeight: 700 }}
            >
              Baca beritanya
            </a>
          </div>
        )}

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

        {/* ---- Riwayat status (transparansi publik) ---- */}
        {statusHistory && statusHistory.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
              Riwayat status (transparansi)
            </div>
            {statusHistory.map((h, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  fontSize: 12.5,
                  padding: '5px 0',
                  borderBottom: i < statusHistory.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}
              >
                <span style={{ color: '#1c1917' }}>
                  Otoritas - {STATUS_LABELS[h.new_status] || h.new_status}
                </span>
                <span style={{ color: '#64748b', flexShrink: 0 }}>
                  {new Date(String(h.changed_at).replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}

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
            Otoritas TIDAK bisa mendukung laporan - hanya warga yang
            memberikan dukungan; saat sesi otoritas aktif tampil jumlahnya
            saja tanpa tombol. */}
        <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          {otoritas ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155' }}>
              <ThumbIcon size={22} />
              <span>
                Dukungan warga: <strong>{voteCount}</strong>
              </span>
            </div>
          ) : voteState === 'idle' || hasVoted ? (
            <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                aria-label={
                  hasVoted ? 'Batalkan dukungan laporan warga' : 'Dukung laporan warga (jempol)'
                }
                onClick={handleVoteClick}
                disabled={voteState === 'busy'}
                title={
                  hasVoted
                    ? 'Batalkan dukungan'
                    : eidVerified
                      ? 'Dukung laporan ini'
                      : 'Verifikasi e.id untuk mendukung'
                }
                style={{
                  position: 'relative',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  flexShrink: 0,
                  border: `2px solid ${hasVoted ? '#2563eb' : '#cbd5e1'}`,
                  background: hasVoted ? '#dbeafe' : '#fff',
                  cursor: hasVoted ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,.12)',
                }}
              >
                <span
                  key={likeBurst}
                  className={`tk-like-pop${likeBurst > 0 ? ' tk-like-pop--active' : ''}`}
                >
                  <ThumbIcon active={hasVoted} size={26} />
                </span>
                {likeBurst > 0 &&
                  LIKE_STARS.map(([dx, dy, del], i) => (
                    <span
                      key={i}
                      className="tk-star"
                      style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${del}ms` }}
                    >
                      ✦
                    </span>
                  ))}
              </button>
              <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>
                Dukungan warga: <strong>{voteCount}</strong>
              </span>
            </div>
            {hasVoted && (
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6 }}>
                Klik jempol biru untuk membatalkan dukungan Anda.
              </div>
            )}
            </>
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
              </div>
            </div>
          )}

          {voteState === 'verifying' && (
            <VerificationFlow
              role="warga"
              walletMode={isTouchDevice}
              onComplete={handleVoteVerified}
              onCancel={() => setVoteState('prompt')}
            />
          )}

          {(voteState === 'busy' || voteState === 'done') && (
            <div style={{ fontSize: 13, color: '#334155' }}>
              {voteState === 'busy' && <span>Memproses dukungan Anda…</span>}
              {voteState === 'done' && (
                <span style={{ color: '#15803d', fontWeight: 600 }}>
                  ✓ {voteError || `Terima kasih! Dukungan Anda tercatat (${voteCount}).`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ---- Panel kelola laporan (fitur 2 Sep 2026): tanda ✗ otoritas,
            edit/hapus milik sendiri (warga), klaim "sudah diperbaiki"
            dengan foto + antrean klaim utk otoritas ---- */}
        <ReportManagePanel
          report={report}
          otoritas={otoritas}
          onReportUpdated={onReportUpdated}
          onClose={onClose}
        />
        </div>

        {/* Kolom kanan (desktop): bagikan + diskusi; mobile otomatis
            ditumpuk di bawah karena panel flexDirection column. */}
        <div
          style={
            isMobile
              ? { width: 'auto', flexShrink: 0 }
              : {
                  width: 300,
                  flexShrink: 0,
                  borderLeft: '1px solid #e2e8f0',
                  paddingLeft: 16,
                  position: 'sticky',
                  top: 0,
                  maxHeight: '78vh',
                  overflowY: 'auto',
                }
          }
        >
          <ShareButtons report={report} />
          <Discussion report={report} />
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
