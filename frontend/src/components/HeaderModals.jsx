// frontend/src/components/HeaderModals.jsx
// Konten menu header (File 1 Bagian 9.1 / poin Alur Inti 9) - semuanya
// MODAL, bukan halaman baru: Tentang, Statistik (per severity/pulau/
// provinsi + tabel & grafik), Pantau (laporan dalam perbaikan & baru
// selesai), dan Notifikasi (aktivitas laporan: dibuat oleh, lokasi, apa
// yang rusak, status kerusakan). Data berasal dari props reports (satu
// sumber data yang sama dengan peta/daftar - di sini versi TANPA filter).

import { useState, useEffect } from 'react';
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
import WelcomeModal from './WelcomeModal.jsx';

// ---- Utilitas kecil ----

// Tanggal DB (UTC "YYYY-MM-DD HH:MM:SS") -> teks lokal (id-ID).
export function formatDateTime(value) {
  if (!value) return '-';
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
function BarRow({ label, count, color, max, delay = 0 }) {
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
          className="tk-grow-x"
          style={{
            width: `${count > 0 ? Math.max(pct, 4) : 0}%`,
            height: 14,
            borderRadius: 5,
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
            animationDelay: `${delay}ms`,
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
  // Konten & DESAIN menu "Tentang" SAMA dengan modal welcome (koreksi
  // user): layout panel + logo transparan besar di latar belakang +
  // WelcomeBody (latar belakang, solusi, fitur utama, ajakan - satu
  // sumber konten). Cukup ganti heading/judul & tombol penutup.
  return (
    <WelcomeModal
      onClose={onClose}
      heading="Tentang titikrusak.id"
      subtitle="Laporkan & pantau infrastruktur publik yang rusak"
      ariaLabel="Tentang titikrusak.id"
      ctaLabel="Tutup"
    />
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

  // ---- Detail tambahan: tren bulanan (6 bulan terakhir) & rinci status ----
  const now = new Date();
  const monthTrend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthTrend.push({
      label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      count: reports.filter((r) => String(r.created_at || '').startsWith(key)).length,
    });
  }
  const maxMonth = Math.max(1, ...monthTrend.map((m) => m.count));
  const STATUS_BARS = [
    ['dilaporkan', 'Dilaporkan', '#64748b'],
    ['terverifikasi', 'Terverifikasi', '#2563eb'],
    ['dalam_perbaikan', 'Dalam Perbaikan', '#f59e0b'],
    ['selesai_diperbaiki', 'Selesai', '#22c55e'],
  ];
  const statusRows = STATUS_BARS.map(([value, label, color]) => ({
    label,
    color,
    count: reports.filter((r) => r.status === value).length,
  }));
  const maxStatus = Math.max(1, ...statusRows.map((s) => s.count));

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

      {/* Rinci status laporan (bar animasi) */}
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
          <span aria-hidden="true">📋</span> Rinci Status Laporan
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
          {statusRows.map((s, i) => (
            <BarRow key={s.label} {...s} max={maxStatus} delay={i * 90} />
          ))}
        </div>
      </div>

      {/* Tren bulanan 6 bulan terakhir */}
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
          <span aria-hidden="true">📈</span> Tren Pelaporan (6 Bulan Terakhir)
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
          {monthTrend.map((m, i) => (
            <BarRow key={m.label} label={m.label} count={m.count} color="#f59e0b" max={maxMonth} delay={i * 80} />
          ))}
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

// ---- Bookmark (3 Sep 2026): daftar laporan yang ditandai pin, per perangkat ----
export function BookmarkModal({ reports = [], onClose, onOpenReport }) {
  const ids = (() => {
    try {
      return JSON.parse(localStorage.getItem('titikrusak_bookmarks')) || [];
    } catch (_e) {
      return [];
    }
  })();
  const items = reports.filter((r) => ids.includes(Number(r.id)));
  return (
    <ModalShell title="Bookmark" onClose={onClose} maxWidth={480}>
      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          Belum ada laporan yang ditandai. Buka detail titik lalu tekan ikon pin (📌) untuk
          menandainya.
        </p>
      ) : (
        items.map((r) => (
          <button
            type="button"
            key={r.id}
            onClick={() => {
              if (onOpenReport) onOpenReport(r);
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
              padding: '9px 11px',
              marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1c1917' }}>
              📍 {r.location_name}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {r.infra_type} - {r.status}
            </span>
          </button>
        ))
      )}
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

// ---- Notifikasi (poin 9 + transparansi): feed aktivitas gabungan - laporan
// baru (warga), perubahan status (otoritas), dan dukungan (warga) - dari
// GET /api/activity, terurut terbaru. ----
export function NotifikasiModal({ onClose }) {
  const [activities, setActivities] = useState(null); // null = memuat
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/activity?limit=100');
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (!cancelled) setActivities(Array.isArray(body.activities) ? body.activities : []);
      } catch (_e) {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const TYPE_META = {
    report_created: { bg: '#fef9c3', fg: '#854d0e' },
    status_changed: { bg: '#eff6ff', fg: '#2563eb' },
    voted: { bg: '#f0fdf4', fg: '#16a34a' },
  };

  const feed = activities || [];

  const actorName = (a) => {
    if (a.type === 'report_created') {
      // Titik dari seed media/online: pelapor = media, bukan warga.
      if (a.source_type === 'media') return 'Media';
      return a.actor || 'Warga';
    }
    if (a.type === 'voted') return 'Warga';
    if (a.actor) return String(a.actor);
    return 'Otoritas';
  };

  const actionText = (a) => {
    if (a.type === 'report_created') return 'melaporkan';
    if (a.type === 'status_changed') {
      return `mengubah status menjadi ${STATUS_LABELS[a.new_status] || a.new_status}`;
    }
    return 'mendukung laporan';
  };

  return (
    <ModalShell title="Notifikasi Aktivitas" onClose={onClose} maxWidth={600}>
      {activities === null && !loadError ? (
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Memuat aktivitas…</p>
      ) : loadError ? (
        <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>Gagal memuat aktivitas.</p>
      ) : feed.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Belum ada aktivitas.</p>
      ) : (
        feed.map((a, i) => {
          const meta = TYPE_META[a.type] || TYPE_META.report_created;
          const name = actorName(a);
          const severityColor = SEVERITY_COLORS[a.severity] || '#64748b';
          return (
            <div
              key={`${a.type}-${a.report_id}-${a.at}-${i}`}
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
                  background: meta.bg,
                  color: meta.fg,
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
                    {actionText(a)} · {formatDateTime(a.at)}
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
                  {a.location_name}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
                  {a.type === 'report_created' && (
                    <>
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
                        {SEVERITY_LABELS[a.severity] || a.severity}
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
                        {INFRA_LABELS[a.infra_type] || a.infra_type}
                      </span>
                    </>
                  )}
                  {a.type === 'status_changed' && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${(STATUS_COLORS[a.new_status] || '#64748b')}1a`,
                        color: STATUS_COLORS[a.new_status] || '#64748b',
                      }}
                    >
                      {STATUS_LABELS[a.new_status] || a.new_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </ModalShell>
  );
}
