// frontend/src/components/HeaderModals.jsx
// Konten menu header (File 1 Bagian 9.1 / poin Alur Inti 9) — semuanya
// MODAL, bukan halaman baru: Tentang, Statistik (per severity/pulau/
// provinsi + tabel & grafik), Pantau (laporan dalam perbaikan & baru
// selesai), dan Notifikasi (aktivitas laporan: dibuat oleh, lokasi, apa
// yang rusak, status kerusakan). Data berasal dari props reports (satu
// sumber data yang sama dengan peta/daftar — di sini versi TANPA filter).

import {
  SEVERITIES,
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  INFRA_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../lib/labels.js';
import { ISLAND_REGIONS, OTHER_ISLAND, detectIsland, detectProvince } from '../lib/regions.js';
import useIsMobile from '../lib/useIsMobile.js';

// ---- Utilitas kecil ----

// Tanggal DB (UTC "YYYY-MM-DD HH:MM:SS") -> teks lokal (id-ID).
export function formatDateTime(value) {
  if (!value) return '—';
  const t = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? new Date(`${value.replace(' ', 'T')}Z`)
    : new Date(value);
  if (Number.isNaN(t.getTime())) return value;
  try {
    return t.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (_e) {
    return value;
  }
}

// ---- Kerangka modal bersama (bottom sheet di mobile, kartu di desktop) ----
export function ModalShell({ title, onClose, children, maxWidth = 640 }) {
  const isMobile = useIsMobile();
  return (
    <div
      className="tk-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1250,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
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
          maxWidth,
          maxHeight: isMobile ? '92dvh' : '85vh',
          overflowY: 'auto',
          padding: isMobile ? '18px 18px 24px' : '20px 24px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0, flex: 1, fontSize: 17, color: '#0f172a' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Tutup ${title}`}
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
        {children}
      </div>
    </div>
  );
}

// ---- Grafik batang sederhana (tanpa dependensi library chart) ----
function BarRow({ label, count, color, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span
        style={{
          width: 120,
          fontSize: 12,
          color: '#334155',
          flexShrink: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 5, height: 14, overflow: 'hidden' }}>
        <div
          style={{
            width: `${count > 0 ? Math.max(pct, 4) : 0}%`,
            background: color,
            height: 14,
            borderRadius: 5,
          }}
        />
      </div>
      <span style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
        {count}
      </span>
    </div>
  );
}

// ---- Tentang (poin 9: about web app ini) ----
export function AboutModal({ onClose }) {
  return (
    <ModalShell title="Tentang titikrusak.id" onClose={onClose} maxWidth={560}>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, lineHeight: 1.6, color: '#334155' }}>
        <strong>titikrusak.id</strong> adalah platform crowdsourcing untuk melaporkan dan
        memantau kerusakan infrastruktur publik di Indonesia — jembatan, jalan, sekolah,
        prasarana publik, dan utilitas. Warga melaporkan kondisi di lapangan, otoritas
        memverifikasi dan menindaklanjuti, dengan verifikasi identitas e.id untuk
        kepercayaan dan transparansi.
      </p>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
          Cara pakai
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: '#334155' }}>
          <li>Laporkan kerusakan lewat tombol "Lapor Kerusakan" (form + peta lokasi).</li>
          <li>Pantau status: Dilaporkan → Terverifikasi → Dalam Perbaikan → Selesai Diperbaiki.</li>
          <li>Dukung laporan warga lain (terverifikasi e.id) — dukungan menaikkan prioritas.</li>
          <li>Otoritas: masuk via e.id, verifikasi laporan, dan lanjutkan status perbaikan.</li>
        </ul>
      </div>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#64748b' }}>
        Data laporan tersimpan di database lokal. Identitas e.id hanya ditampilkan sesuai
        pilihan Anda (nama asli atau alias/anonim).
      </p>
    </ModalShell>
  );
}

// ---- Statistik (poin 9: jumlah rusak, severity, wilayah per provinsi & pulau) ----
export function StatistikModal({ reports = [], onClose }) {
  const bySeverity = SEVERITIES.map((s) => ({
    ...s,
    count: reports.filter((r) => r.severity === s.value).length,
  }));
  const verifiedCount = reports.filter((r) => r.reporter_is_verified).length;
  const inPerbaikan = reports.filter((r) => r.status === 'dalam_perbaikan').length;
  const selesai = reports.filter((r) => r.status === 'selesai_diperbaiki').length;

  // Per pulau (urutan ISLAND_REGIONS + Lainnya).
  const islandCounts = [...ISLAND_REGIONS, OTHER_ISLAND].map((region) => ({
    region,
    count: reports.filter(
      (r) => detectIsland(Number(r.lat), Number(r.lng)).key === region.key
    ).length,
  }));

  // Per provinsi (semua yang terdeteksi, diurutkan jumlah terbanyak).
  const provinceMap = new Map();
  reports.forEach((r) => {
    const name = detectProvince(Number(r.lat), Number(r.lng)) || 'Tidak Terdeteksi';
    provinceMap.set(name, (provinceMap.get(name) || 0) + 1);
  });
  const provinceRows = [...provinceMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const topProvinces = provinceRows.slice(0, 10);

  const maxSeverity = Math.max(1, ...bySeverity.map((s) => s.count));
  const maxIsland = Math.max(1, ...islandCounts.map((i) => i.count));
  const maxProvince = Math.max(1, ...topProvinces.map((p) => p.count));

  const cardStyle = {
    flex: 1,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '8px 10px',
    textAlign: 'center',
  };

  return (
    <ModalShell title="Statistik Pelaporan" onClose={onClose} maxWidth={680}>
      {/* Kartu ringkasan */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{reports.length}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Total Laporan</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{verifiedCount}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Terverifikasi e.id</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>{inPerbaikan}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Dalam Perbaikan</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{selesai}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Selesai Diperbaiki</div>
        </div>
      </div>

      {/* Grafik severity */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Tingkat Kerusakan
        </div>
        {bySeverity.map((s) => (
          <BarRow key={s.value} label={s.label} count={s.count} color={s.color} max={maxSeverity} />
        ))}
      </div>

      {/* Tabel + grafik per pulau */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Wilayah per Pulau
        </div>
        {islandCounts.map(({ region, count }) => (
          <BarRow
            key={region.key}
            label={region.label}
            count={count}
            color="#7c3aed"
            max={maxIsland}
          />
        ))}
      </div>

      {/* Tabel + grafik per provinsi (10 besar) */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Wilayah per Provinsi (10 besar)
        </div>
        {topProvinces.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: '#64748b' }}>
            Belum ada laporan untuk dihitung per provinsi.
          </p>
        ) : (
          <div>
            {topProvinces.map((p) => (
              <BarRow key={p.name} label={p.name} count={p.count} color="#0891b2" max={maxProvince} />
            ))}
            {provinceRows.length > 10 && (
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                + {provinceRows.length - 10} provinsi lainnya
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ---- Pantau (poin 9: status yang masuk perbaikan & yang baru beres) ----
export function PantauModal({ reports = [], onClose }) {
  const tracked = reports
    .filter((r) => r.status === 'dalam_perbaikan' || r.status === 'selesai_diperbaiki')
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
    .slice(0, 30);
  const inPerbaikan = tracked.filter((r) => r.status === 'dalam_perbaikan');
  const selesai = tracked.filter((r) => r.status === 'selesai_diperbaiki');

  const rowStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
    cursor: 'pointer',
  };

  const renderRows = (rows) =>
    rows.length === 0 ? (
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#64748b' }}>Belum ada laporan.</p>
    ) : (
      rows.map((r) => (
        <div key={r.id} style={rowStyle}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{r.location_name}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {INFRA_LABELS[r.infra_type] || r.infra_type} ·{' '}
            {SEVERITY_LABELS[r.severity] || r.severity} · Diperbarui {formatDateTime(r.updated_at)}
          </div>
        </div>
      ))
    );

  return (
    <ModalShell title="Pantau Perbaikan" onClose={onClose} maxWidth={600}>
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#b45309',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          🚧 Dalam Perbaikan ({inPerbaikan.length})
        </div>
        {renderRows(inPerbaikan)}
      </div>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#15803d',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ✅ Baru Selesai Diperbaiki ({selesai.length})
        </div>
        {renderRows(selesai)}
      </div>
    </ModalShell>
  );
}

// ---- Notifikasi (poin 9: aktivitas laporan — dibuat oleh, lokasi, apa yang rusak) ----
export function NotifikasiModal({ reports = [], onClose }) {
  const feed = [...reports]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 20);

  return (
    <ModalShell title="Notifikasi Aktivitas" onClose={onClose} maxWidth={600}>
      {feed.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
          Belum ada aktivitas laporan.
        </p>
      ) : (
        feed.map((r) => {
          const name = r.reporter_display_name || 'Warga anonim';
          const statusColor = STATUS_COLORS[r.status] || '#64748b';
          const severityColor = SEVERITY_COLORS[r.severity] || '#64748b';
          return (
            <div
              key={r.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 2px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: '#ede9fe',
                  color: '#6d28d9',
                  fontSize: 14,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#0f172a' }}>
                  <strong>{name}</strong>{' '}
                  <span style={{ color: '#64748b', fontSize: 11.5 }}>
                    melaporkan {formatDateTime(r.created_at)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#334155',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.location_name}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${severityColor}1a`,
                      color: severityColor,
                    }}
                  >
                    {SEVERITY_LABELS[r.severity] || r.severity}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#f1f5f9',
                      color: '#334155',
                    }}
                  >
                    {INFRA_LABELS[r.infra_type] || r.infra_type}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${statusColor}1a`,
                      color: statusColor,
                    }}
                  >
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </ModalShell>
  );
}
