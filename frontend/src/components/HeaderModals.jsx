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
import Logo from './Logo.jsx';
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
          {/* Aksen oranye khas modal (poin 9) */}
          <span
            style={{ width: 4, height: 22, borderRadius: 2, background: '#eab308', flexShrink: 0 }}
          />
          <h2 style={{ margin: 0, flex: 1, fontSize: 17, color: '#1c1917' }}>{title}</h2>
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
            height: 14,
            borderRadius: 5,
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
          }}
        />
      </div>
      <span style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1c1917' }}>
        {count}
      </span>
    </div>
  );
}

// ---- Grafik donat (SVG murni, tanpa library chart) ----
function DonutChart({ segments, size = 150, thickness = 20 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', flexShrink: 0 }}
      role="img"
      aria-label={`Grafik donat: total ${total} laporan`}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
      {segments.map((s, i) => {
        if (s.value <= 0) return null;
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.4s ease' }}
          />
        );
        offset += len;
        return el;
      })}
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 26, fontWeight: 800, fill: '#1c1917' }}
      >
        {total}
      </text>
      <text x="50%" y="61%" textAnchor="middle" style={{ fontSize: 10, fill: '#64748b' }}>
        laporan
      </text>
    </svg>
  );
}

// ---- Tentang (poin 9: about web app ini) ----
export function AboutModal({ onClose }) {
  return (
    <ModalShell title="Tentang titikrusak.id" onClose={onClose} maxWidth={600}>
      {/* Hero: logo + tagline */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          marginBottom: 14,
          background: 'linear-gradient(135deg, #fefce8, #fef9c3)',
          border: '1px solid #fef08a',
          borderRadius: 12,
          padding: '14px 16px',
        }}
      >
        <Logo size={54} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1c1917' }}>titikrusak.id</div>
          <div style={{ fontSize: 12.5, color: '#854d0e', marginTop: 2 }}>
            Laporkan &amp; pantau infrastruktur publik yang rusak di Indonesia
          </div>
        </div>
      </div>

      <p style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.6, color: '#334155' }}>
        <strong>titikrusak.id</strong> adalah platform crowdsourcing untuk melaporkan dan
        memantau kerusakan infrastruktur publik di Indonesia — jembatan, jalan, sekolah,
        prasarana publik, dan utilitas. Warga melaporkan kondisi di lapangan, otoritas
        memverifikasi dan menindaklanjuti, dengan verifikasi identitas e.id untuk
        kepercayaan dan transparansi.
      </p>

      {/* Kartu fitur utama */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[
          { icon: '📝', title: 'Lapor', desc: 'Laporkan kerusakan dengan lokasi & deskripsi' },
          { icon: '🛠️', title: 'Pantau', desc: 'Ikuti status perbaikan hingga selesai' },
          { icon: '🤝', title: 'Dukung', desc: 'Dukung laporan warga lain (terverifikasi e.id)' },
          { icon: '🏛', title: 'Otoritas', desc: 'Verifikasi & tindak lanjut via e.id KYC e-KTP' },
        ].map((f) => (
          <div
            key={f.title}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '12px',
            }}
          >
            <div style={{ fontSize: 20, lineHeight: 1 }}>{f.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', marginTop: 6 }}>
              {f.title}
            </div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
              {f.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Cara pakai */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#1c1917',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{ width: 14, height: 3, borderRadius: 2, background: '#eab308', display: 'inline-block' }}
          />
          Cara pakai
        </div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: '#334155' }}>
          <li>Laporkan kerusakan lewat tombol "Lapor Kerusakan" (form + peta lokasi).</li>
          <li>Pantau status: Dilaporkan → Terverifikasi → Dalam Perbaikan → Selesai Diperbaiki.</li>
          <li>Dukung laporan warga lain (terverifikasi e.id) — dukungan menaikkan prioritas.</li>
          <li>Otoritas: masuk via e.id, verifikasi laporan, dan lanjutkan status perbaikan.</li>
        </ol>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.5,
          color: '#64748b',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '10px 12px',
        }}
      >
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

  const maxIsland = Math.max(1, ...islandCounts.map((i) => i.count));
  const maxProvince = Math.max(1, ...topProvinces.map((p) => p.count));

  const cardStyle = (color) => ({
    flex: 1,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderTop: `3px solid ${color}`,
    borderRadius: 8,
    padding: '8px 10px',
    textAlign: 'center',
    minWidth: 110,
  });

  return (
    <ModalShell title="Statistik Pelaporan" onClose={onClose} maxWidth={680}>
      {/* Kartu ringkasan */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={cardStyle('#1c1917')}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1c1917' }}>{reports.length}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Total Laporan</div>
        </div>
        <div style={cardStyle('#22c55e')}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{verifiedCount}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Terverifikasi e.id</div>
        </div>
        <div style={cardStyle('#f59e0b')}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>{inPerbaikan}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Dalam Perbaikan</div>
        </div>
        <div style={cardStyle('#22c55e')}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#15803d' }}>{selesai}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Selesai Diperbaiki</div>
        </div>
      </div>

      {/* Grafik severity: donat + legenda */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#1c1917',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{ width: 14, height: 3, borderRadius: 2, background: '#eab308', display: 'inline-block' }}
          />
          Tingkat Kerusakan
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <DonutChart segments={bySeverity.map((s) => ({ value: s.count, color: s.color }))} />
          <div style={{ flex: 1, minWidth: 200 }}>
            {bySeverity.map((s) => (
              <div
                key={s.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
              >
                <span
                  style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 12.5, color: '#334155' }}>{s.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#1c1917' }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabel + grafik per pulau */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', marginBottom: 8 }}>
          Wilayah per Pulau
        </div>
        {islandCounts.map(({ region, count }) => (
          <BarRow
            key={region.key}
            label={region.label}
            count={count}
            color="#eab308"
            max={maxIsland}
          />
        ))}
      </div>

      {/* Tabel + grafik per provinsi (10 besar) */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1917', marginBottom: 8 }}>
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
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1c1917' }}>{r.location_name}</div>
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
                  background: '#fef9c3',
                  color: '#854d0e',
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
                <div style={{ fontSize: 13, color: '#1c1917' }}>
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
