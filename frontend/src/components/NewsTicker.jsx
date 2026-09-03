// frontend/src/components/NewsTicker.jsx
// News Flash / Berita Terkini (ticker berjalan seperti berita TV): berita
// seputar perbaikan infrastruktur, infrastruktur rusak, dan bencana.
// - 5 berita per batch; berganti ke 5 berikutnya tiap 2 putaran penuh ticker.
// - hover -> ticker pause + tiap judul bisa diklik (buka source di tab baru).
// - SEMBUNYI di mobile phone (isMobile true) - hanya laptop/PC/tablet.
// Data dari GET /api/news (cache server, best-effort).

import { useEffect, useRef, useState } from 'react';
import useIsMobile from '../lib/useIsMobile.js';

const BATCH_SIZE = 5;
const ROUNDS_PER_BATCH = 2;

export default function NewsTicker() {
  const isMobile = useIsMobile();
  const [news, setNews] = useState([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const roundRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/news');
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && Array.isArray(body.news) && body.news.length > 0) {
          setNews(body.news);
        }
      } catch (_e) {
        // best-effort: tanpa berita ticker tidak dirender.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isMobile || news.length === 0) return null;

  const batch = news.slice(batchIndex, batchIndex + BATCH_SIZE);

  // Tiap 1 iterasi penuh (satu putaran scroll 5 judul) hitung; setelah 2
  // putaran pindah ke batch 5 berita berikutnya (wrap ke awal bila habis).
  const handleIteration = () => {
    roundRef.current += 1;
    if (roundRef.current >= ROUNDS_PER_BATCH) {
      roundRef.current = 0;
      setBatchIndex((i) => (i + BATCH_SIZE) % news.length);
    }
  };

  return (
    <div className="tk-news-flash" role="region" aria-label="Berita terkini">
      <span className="tk-news-flash-label">Berita Terkini:</span>
      <div className="tk-news-flash-viewport">
        {/* key=batchIndex: restart animasi bersih tiap ganti batch.
            Konten diduplikasi (x2) agar scroll mulus tanpa lompatan. */}
        <div
          key={batchIndex}
          className="tk-news-flash-track"
          onAnimationIteration={handleIteration}
        >
          {[...batch, ...batch].map((n, i) => (
            <a
              key={i}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="tk-news-flash-item"
              title={n.title}
            >
              <span className="tk-news-flash-dot" aria-hidden="true">
                •
              </span>
              {n.title}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
