// frontend/src/components/SearchModal.jsx
// Modal hasil pencarian header (poin: tagline diganti search bar).
// Mencari kata kunci apa pun di seluruh laporan (semua data tanpa filter):
// nama lokasi, deskripsi, jenis/severity/status (label Indonesia), nama
// media, dll. Klik hasil -> buka DetailModal laporan tersebut (via
// onOpenReport). Jika tidak ada yang cocok -> tampilan "tidak ada hasil".

import { useMemo, useState } from 'react';
import {
  INFRA_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  SEVERITY_COLORS,
} from '../lib/labels.js';
import useIsMobile from '../lib/useIsMobile.js';

// Kumpulkan seluruh teks yang bisa dicari dari satu laporan.
function searchableText(r) {
  return [
    r.location_name,
    r.description,
    r.source_media_name,
    r.source_media_url,
    r.source_media_date,
    r.vital_status_note,
    r.related_earthquake,
    r.related_weather,
    INFRA_LABELS[r.infra_type],
    SEVERITY_LABELS[r.severity],
    STATUS_LABELS[r.status],
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function SearchModal({ reports = [], initialQuery = '', onClose, onOpenReport }) {
  const isMobile = useIsMobile();
  const [q, setQ] = useState(initialQuery);
  const keyword = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!keyword) return [];
    return reports
      .filter((r) => searchableText(r).includes(keyword))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 50);
  }, [reports, keyword]);

  return (
    <div
      className="tk-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? 0 : '8vh 16px 16px',
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
          maxHeight: isMobile ? '92dvh' : '80vh',
          overflowY: 'auto',
          padding: isMobile ? '18px 18px 24px' : '20px 24px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, color: '#1c1917' }}>Cari Titik Rusak</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pencarian"
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

        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari dengan kata kunci…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 14,
            color: '#1c1917',
            outline: 'none',
          }}
        />

        <div style={{ marginTop: 14 }}>
          {!keyword && (
            <div style={{ fontSize: 13, color: '#64748b', padding: '10px 2px' }}>
              Ketik kata kunci — misalnya nama kota, jenis kerusakan (jembatan),
              atau nama media — lalu pilih titik dari daftar hasil.
            </div>
          )}

          {keyword && results.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '28px 12px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1c1917' }}>
                Tidak ada hasil untuk “{q.trim()}”
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                Coba kata kunci lain, atau periksa ejaan nama lokasi.
              </div>
            </div>
          )}

          {keyword && results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: '#64748b', padding: '0 2px' }}>
                {results.length} titik ditemukan untuk “{q.trim()}”
              </div>
              {results.map((r) => {
                const sevColor = SEVERITY_COLORS[r.severity] || '#64748b';
                const statusColor = STATUS_COLORS[r.status] || '#64748b';
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpenReport(r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      textAlign: 'left',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '11px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: sevColor,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontWeight: 600,
                          fontSize: 13.5,
                          color: '#1c1917',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.location_name}
                      </span>
                      <span style={{ display: 'block', fontSize: 11.5, color: '#64748b', marginTop: 2 }}>
                        Kategori {INFRA_LABELS[r.infra_type] || r.infra_type} - Kerusakan{' '}
                        {SEVERITY_LABELS[r.severity] || r.severity}
                        {r.source_media_name ? ` · ${r.source_media_name}` : ''}
                      </span>
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: `${statusColor}1a`,
                        color: statusColor,
                        flexShrink: 0,
                      }}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
