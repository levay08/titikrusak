// frontend/src/components/ShareButtons.jsx
// Bagikan laporan titik rusak ke media sosial umum (FB, IG, X, WA, Telegram)
// + salin tautan. Pesan: "Bagikan laporan titik rusak ini: <lokasi>".

import { useState } from 'react';

function buildMessage(report) {
  const place = report.location_name || 'titik rusak';
  const url = 'https://titikrusak.id/';
  return {
    text: `Bagikan laporan titik rusak ini: ${place}. Lihat di ${url}`,
    url,
  };
}

const btn = {
  flex: '0 0 auto',
  width: 40,
  height: 40,
  borderRadius: '50%',
  border: '1px solid #e2e8f0',
  background: '#fff',
  fontSize: 18,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

export default function ShareButtons({ report }) {
  const { text, url } = buildMessage(report);
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent(text);
  const encUrl = encodeURIComponent(url);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) {
      // fallback manual
      window.prompt('Salin tautan laporan:', url);
    }
  };

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
        Bagikan laporan titik rusak ini
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <a
          style={btn}
          aria-label="Bagikan ke Facebook"
          title="Facebook"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${enc}`}
        >
          f
        </a>
        <a
          style={btn}
          aria-label="Bagikan ke Instagram"
          title="Instagram (salin pesan lalu tempel di unggahan Anda)"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.instagram.com/`}
        >
          📷
        </a>
        <a
          style={btn}
          aria-label="Bagikan ke X"
          title="X (Twitter)"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://twitter.com/intent/tweet?text=${enc}&url=${encUrl}`}
        >
          𝕏
        </a>
        <a
          style={btn}
          aria-label="Bagikan ke WhatsApp"
          title="WhatsApp"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://api.whatsapp.com/send?text=${enc}%20${encUrl}`}
        >
          🟢
        </a>
        <a
          style={btn}
          aria-label="Bagikan ke Telegram"
          title="Telegram"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://t.me/share/url?url=${encUrl}&text=${enc}`}
        >
          ✈️
        </a>
        <button
          type="button"
          aria-label="Salin tautan laporan"
          title={copied ? 'Tautan tersalin' : 'Salin tautan'}
          onClick={copy}
          style={btn}
        >
          {copied ? '✅' : '🔗'}
        </button>
      </div>
      {copied && (
        <div style={{ fontSize: 11.5, color: '#15803d', marginTop: 6 }}>Tautan disalin.</div>
      )}
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 1.4 }}>
        Pesan bagikan: &quot;{text}&quot;
      </div>
    </div>
  );
}
