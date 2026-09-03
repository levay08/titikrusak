// frontend/src/components/Discussion.jsx
// Diskusi per laporan (3 Sep 2026). Menulis butuh sesi e.id verified;
// identitas = pilihan nama/anonim saat verifikasi. Anti-spam + sensor kata
// kasar (asterisk) di server. Upvote = arrow up ala Reddit (sekali per user).

import { useCallback, useEffect, useState } from 'react';
import VerificationFlow from './VerificationFlow.jsx';
import { getEidSession, eidSessionHeaders } from '../lib/eidSession.js';
import useIsTouchDevice from '../lib/useIsTouchDevice.js';

const api = async (url, opts) => {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...eidSessionHeaders(), ...(opts.headers || {}) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch (_e) {
    /* non-JSON */
  }
  if (!res.ok) throw new Error((body && body.error) || `HTTP ${res.status}`);
  return body;
};

function timeId(ts) {
  try {
    return new Date(String(ts).replace(' ', 'T') + 'Z').toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (_e) {
    return String(ts || '');
  }
}

export default function Discussion({ report, onNeedVerify }) {
  const isTouch = useIsTouchDevice();
  const session = getEidSession();
  const [list, setList] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const [voted, setVoted] = useState({});

  const load = useCallback(() => {
    fetch(`/api/comments/report/${report.id}`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => setList(Array.isArray(d.comments) ? d.comments : []))
      .catch(() => {});
  }, [report.id]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const displayName =
        (() => {
          try {
            const raw = localStorage.getItem('titikrusak_eid');
            const d = raw ? JSON.parse(raw) : null;
            if (d && d.isVerified && d.displayName) return d.displayName;
          } catch (_e) {
            /* abaikan */
          }
          return session && session.role === 'otoritas' ? 'Otoritas' : 'Warga';
        })();
      const body = await api(`/api/comments/report/${report.id}`, {
        method: 'POST',
        body: JSON.stringify({ text, display_name: displayName }),
      });
      setList((l) => [...l, body.comment]);
      setText('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (id) => {
    setBusy('e' + id);
    setErr('');
    try {
      const body = await api(`/api/comments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: editText }),
      });
      setList((l) => l.map((c) => (c.id === id ? body.comment : c)));
      setEditId(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const removeComment = async (id) => {
    if (!window.confirm('Hapus komentar ini? Tindakan tidak bisa dibatalkan.')) return;
    setBusy('d' + id);
    setErr('');
    try {
      await api(`/api/comments/${id}`, { method: 'DELETE' });
      setList((l) => l.filter((c) => c.id !== id));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const upvote = async (id) => {
    if (voted[id]) return;
    setBusy('u' + id);
    setErr('');
    try {
      const body = await api(`/api/comments/${id}/upvote`, { method: 'POST' });
      setList((l) => l.map((c) => (c.id === id ? body.comment : c)));
      setVoted((v) => ({ ...v, [id]: true }));
    } catch (e) {
      if (String(e.message).includes('sudah')) {
        setVoted((v) => ({ ...v, [id]: true }));
      } else {
        setErr(e.message);
      }
    } finally {
      setBusy('');
    }
  };

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
        Diskusi ({list.length})
      </div>

      {verifyOpen && (
        <VerificationFlow
          role="warga"
          walletMode={isTouch}
          onComplete={(result) => {
            try {
              localStorage.setItem('titikrusak_eid', JSON.stringify(result));
            } catch (_e) {
              /* abaikan */
            }
            setVerifyOpen(false);
            if (onNeedVerify) onNeedVerify();
          }}
          onCancel={() => setVerifyOpen(false)}
        />
      )}

      {!session && !verifyOpen && (
        <button
          type="button"
          onClick={() => setVerifyOpen(true)}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: 8,
            border: '1px solid #eab308',
            background: '#fffef5',
            color: '#854d0e',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          Verifikasi e.id untuk ikut berdiskusi
        </button>
      )}

      {session && !verifyOpen && (
        <div style={{ marginBottom: 10 }}>
          <textarea
            aria-label="Tulis komentar"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Tulis komentar atau konfirmasi kondisi terkini (maks. 500 karakter)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              type="button"
              disabled={busy === true || text.trim().length === 0}
              onClick={submit}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: text.trim() ? '#facc15' : '#e2e8f0',
                color: text.trim() ? '#1c1917' : '#94a3b8',
                fontSize: 13,
                fontWeight: 700,
                cursor: text.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Kirim komentar
            </button>
          </div>
        </div>
      )}

      {err && (
        <div style={{ fontSize: 12, color: '#b91c1c', margin: '4px 0 8px' }}>{err}</div>
      )}

      {list.length === 0 && (
        <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 8px' }}>
          Belum ada diskusi untuk titik ini.
        </p>
      )}

      {list.map((c) => (
        <div
          key={c.id}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '10px 12px',
            marginBottom: 8,
            background: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 12.5, color: '#1c1917' }}>
              {c.role === 'otoritas' ? `🏛 ${c.display_name}` : c.display_name || 'Warga'}
            </span>
            {c.role === 'otoritas' && (
              <span
                style={{
                  fontSize: 10,
                  background: '#fefce8',
                  color: '#854d0e',
                  border: '1px solid #fde68a',
                  borderRadius: 6,
                  padding: '1px 6px',
                }}
              >
                Otoritas
              </span>
            )}
            <span style={{ fontSize: 10.5, color: '#94a3b8', marginLeft: 'auto' }}>
              {timeId(c.created_at)}
              {c.is_edited === 1 ? ' (diedit)' : ''}
            </span>
          </div>
          {editId === c.id ? (
            <div style={{ marginTop: 8 }}>
              <textarea
                aria-label="Ubah komentar"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                }}
              />
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => saveEdit(c.id)}
                  disabled={busy === 'e' + c.id}
                  style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#facc15', color: '#1c1917', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => setEditId(null)}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 12, cursor: 'pointer' }}
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, color: '#334155', whiteSpace: 'pre-wrap' }}>
              {c.body}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              aria-label="Upvote komentar"
              disabled={busy === 'u' + c.id || Boolean(voted[c.id])}
              onClick={() => upvote(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 9px',
                borderRadius: 6,
                border: voted[c.id] ? '1px solid #f97316' : '1px solid #e2e8f0',
                background: voted[c.id] ? '#fff7ed' : '#fff',
                color: voted[c.id] ? '#f97316' : '#64748b',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>▲</span> {c.upvotes || 0}
            </button>
            {session && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditId(c.id);
                    setEditText(c.body);
                  }}
                  style={{ fontSize: 11.5, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeComment(c.id)}
                  disabled={busy === 'd' + c.id}
                  style={{ fontSize: 11.5, color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Hapus
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
