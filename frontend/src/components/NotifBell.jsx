// frontend/src/components/NotifBell.jsx
// Menu Notifikasi di header: tetap memakai simbol lonceng (🔔) + nama menu
// "Notifikasi", plus badge jumlah notifikasi BELUM DIBACA dan efek lonceng
// berdering sesaat ketika ada notifikasi baru masuk.

import { useEffect, useRef, useState } from 'react';
import { badgeText } from '../lib/notifUnread.js';

export default function NotifBell({ count = 0, onClick, label = 'Notifikasi', compact = false }) {
  const [ring, setRing] = useState(false);
  const prev = useRef(Number(count) || 0);

  // Berdering hanya saat jumlahnya BERTAMBAH (notifikasi baru masuk),
  // bukan setiap render.
  useEffect(() => {
    const n = Number(count) || 0;
    if (n > prev.current) {
      setRing(true);
      prev.current = n;
      const t = setTimeout(() => setRing(false), 1500);
      return () => clearTimeout(t);
    }
    prev.current = n;
    return undefined;
  }, [count]);

  const badge = badgeText(count);
  const jumlah = Number(count) || 0;
  const aria = badge ? `${label} (${jumlah} belum dibaca)` : label;

  return (
    <button
      type="button"
      aria-label={aria}
      title={badge ? `${jumlah} notifikasi belum dibaca` : label}
      onClick={onClick}
      className={`tk-notif-bell${ring ? ' tk-notif-bell--ring' : ''}${badge ? ' tk-notif-bell--unread' : ''}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'none',
        border: 'none',
        color: 'rgba(255, 255, 255, 0.88)',
        fontSize: compact ? 16 : 14,
        lineHeight: 1,
        cursor: 'pointer',
        padding: compact ? '7px 9px' : '6px 9px',
        borderRadius: 6,
        marginRight: compact ? 12 : 0,
      }}
    >
      <span aria-hidden="true" className="tk-notif-bell__icon" style={{ fontSize: 16 }}>
        🔔
      </span>
      <span>{label}</span>
      {badge && (
        <span
          data-testid="notif-badge"
          className="tk-notif-badge"
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            borderRadius: 999,
            background: '#dc2626',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,.35)',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
