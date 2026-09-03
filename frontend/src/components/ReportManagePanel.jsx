// frontend/src/components/ReportManagePanel.jsx
// Panel aksi laporan versi 2 (fitur 2 Sep 2026):
//   - Otoritas: tandai "✗ tidak dapat diverifikasi keasliannya" (batalkan
//     juga bisa); otoritas TIDAK bisa menghapus laporan.
//   - Warga terverifikasi e.id: EDIT & HAPUS laporan miliknya sendiri
//     (hanya status 'dilaporkan' - server memverifikasi kepemilikan).
//   - Warga terverifikasi e.id: klaim "titik sudah diperbaiki" WAJIB foto;
//     masuk antrean otoritas.
//   - Otoritas: antrean klaim perbaikan untuk laporan ini - Terima = titik
//     di-close (status selesai_diperbaiki, HIJAU otomatis) / Tolak.
// Semua keputusan otorisasi dilakukan SERVER (routes/guards.js) via header
// 'x-eid-session'; tombol di sini hanya penyaji.

import { useEffect, useState } from 'react';
import { getEidSession, eidSessionHeaders } from '../lib/eidSession.js';
import { STATUS_LABELS, SEVERITIES } from '../lib/labels.js';

const btnBase = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13.5,
  fontWeight: 700,
  cursor: 'pointer',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#1c1917',
};

export default function ReportManagePanel({ report, otoritas, onReportUpdated, onClose }) {
  const [session, setSession] = useState(() => getEidSession());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  // ---- Edit (milik sendiri) ----
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    description: report.description || '',
    location_name: report.location_name || '',
    severity: report.severity || 'ringan',
  });

  // ---- Klaim "sudah diperbaiki" (warga) ----
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimNote, setClaimNote] = useState('');
  const [claimPhotos, setClaimPhotos] = useState([]);
  const [claimMsg, setClaimMsg] = useState('');

  // ---- Antrean klaim (otoritas) ----
  const [claims, setClaims] = useState([]);
  const [claimsLoaded, setClaimsLoaded] = useState(false);

  const isOtoritas = Boolean(otoritas);
  const isWarga = session && session.role === 'warga';
  const isOwner = isWarga && report.source_type === 'warga' && report.reporter_is_verified === 1;
  const canEditDelete = isOwner && report.status === 'dilaporkan';
  const canClaim = isWarga && report.status !== 'selesai_diperbaiki' && !report.unverifiable;
  // Alur tolak otoritas: wajib alasan (koreksi user) - alasan tampil di
  // detail titik agar publik paham kenapa laporan ditolak.
  const [markOpen, setMarkOpen] = useState(false);
  const [markReason, setMarkReason] = useState('');

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
    if (!res.ok) {
      throw new Error((body && body.error) || `HTTP ${res.status}`);
    }
    return body;
  };

  // Keputusan otoritas atas klaim perbaikan dari media (monitor berita):
  // terima => selesai_diperbaiki (hijau ✓ otoritas), tolak => klaim dihapus.
  const mediaFix = async (decision) => {
    setBusy('mf');
    setErr('');
    try {
      const updated = await api(`/api/reports/${report.id}/media-fix`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      onReportUpdated(updated);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    if (!isOtoritas) return undefined;
    let on = true;
    api('/api/reports/fix-claims?status=menunggu')
      .then((rows) => {
        if (on && Array.isArray(rows)) {
          setClaims(rows.filter((c) => Number(c.report_id) === Number(report.id)));
        }
      })
      .catch(() => {
        /* antrean tidak bisa dimuat - tombol tetap bisa dipakai */
      })
      .finally(() => on && setClaimsLoaded(true));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOtoritas, report.id]);

  // ---- Otoritas: tanda X (tolak) - WAJIB alasan ----
  const submitMark = async () => {
    if (markReason.trim().length < 10) {
      setErr('Alasan penolakan wajib diisi minimal 10 karakter.');
      return;
    }
    setBusy('x');
    setErr('');
    try {
      await api(`/api/reports/${report.id}/unverifiable`, {
        method: 'PATCH',
        body: JSON.stringify({ unverifiable: true, reason: markReason.trim() }),
      });
      setMarkOpen(false);
      setMarkReason('');
      onReportUpdated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const unmark = async () => {
    if (!window.confirm('Batalkan penolakan (tanda ✗) pada laporan ini?')) return;
    setBusy('x');
    setErr('');
    try {
      await api(`/api/reports/${report.id}/unverifiable`, {
        method: 'PATCH',
        body: JSON.stringify({ unverifiable: false }),
      });
      onReportUpdated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  // ---- Warga: edit milik sendiri ----
  const saveEdit = async () => {
    setBusy('edit');
    setErr('');
    try {
      const payload = {};
      if (editForm.description.trim().length >= 10) payload.description = editForm.description.trim();
      if (editForm.location_name.trim() !== '') payload.location_name = editForm.location_name.trim();
      if (editForm.severity) payload.severity = editForm.severity;
      await api(`/api/reports/${report.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setEditOpen(false);
      onReportUpdated();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  // ---- Warga: hapus milik sendiri (otoritas tidak bisa hapus) ----
  const deleteReport = async () => {
    if (!window.confirm('Hapus laporan ini? Tindakan tidak bisa dibatalkan. Otoritas tidak dapat menghapus laporan - hanya Anda sebagai pelapor.')) return;
    setBusy('del');
    setErr('');
    try {
      await api(`/api/reports/${report.id}`, { method: 'DELETE' });
      onReportUpdated();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  // ---- Warga: klaim sudah diperbaiki (wajib foto) ----
  const pickClaimPhotos = (files) => {
    const arr = Array.from(files || [])
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, 5);
    if (arr.length === 0) return;
    const out = [];
    let i = 0;
    const next = () => {
      if (i >= arr.length) {
        setClaimPhotos([...out]);
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        out.push(r.result);
        i += 1;
        next();
      };
      r.onerror = () => {
        i += 1;
        next();
      };
      r.readAsDataURL(arr[i]);
    };
    next();
  };

  const submitClaim = async () => {
    if (claimPhotos.length === 0) {
      setErr('Wajib menyertakan minimal 1 foto bukti perbaikan.');
      return;
    }
    setBusy('claim');
    setErr('');
    setClaimMsg('');
    try {
      await api(`/api/reports/${report.id}/fix-claim`, {
        method: 'POST',
        body: JSON.stringify({ photo_urls: claimPhotos, note: claimNote.trim() || null }),
      });
      setClaimMsg('✓ Klaim terkirim. Menunggu verifikasi otoritas - titik akan berubah hijau setelah disetujui.');
      setClaimOpen(false);
      setClaimPhotos([]);
      setClaimNote('');
    } catch (e) {
      if (String(e.message).includes('menunggu')) setErr('Sudah ada klaim menunggu diverifikasi untuk titik ini.');
      else setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  // ---- Otoritas: putuskan klaim ----
  const decideClaim = async (claimId, decision) => {
    setBusy(`c${claimId}`);
    setErr('');
    try {
      await api(`/api/reports/${report.id}/fix-claim/${claimId}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
      if (decision === 'terima') onReportUpdated(); // status -> selesai (hijau)
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy('');
    }
  };

  const sectionTitle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#64748b',
    marginBottom: 8,
  };

  return (
    <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
      {/* ---- Tanda ✗ (otoritas) & status khusus ---- */}
      {report.unverifiable ? (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: 8,
            padding: '9px 11px',
            fontSize: 12.5,
            lineHeight: 1.5,
            marginBottom: 12,
          }}
        >
          ✗ <strong>Laporan ditolak otoritas</strong> - tidak dapat diverifikasi
          keasliannya.
          {report.unverifiable_reason && (
            <div style={{ marginTop: 4, color: '#7f1d1d' }}>
              Alasan: <strong>{report.unverifiable_reason}</strong>
            </div>
          )}
        </div>
        ) : null}

        {isOtoritas && (
        <div style={{ marginBottom: 14 }}>
          <span style={sectionTitle}>Otoritas</span>
          {report.unverifiable ? (
            <button type="button" style={btnBase} disabled={busy === 'x'} onClick={unmark}>
              {busy === 'x' ? 'Menyimpan…' : 'Batalkan penolakan (✗)'}
            </button>
          ) : markOpen ? (
            <div style={{ border: '1px solid #fecaca', borderRadius: 8, padding: 10 }}>
              <textarea
                aria-label="Alasan penolakan laporan"
                placeholder="Alasan penolakan (min. 10 karakter) - akan terlihat publik di detail titik, mis. lokasi tidak sesuai fakta / foto tidak asli"
                value={markReason}
                onChange={(e) => setMarkReason(e.target.value)}
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{ ...btnBase, background: '#b91c1c', border: 'none', color: '#fff' }}
                  disabled={busy === 'x'}
                  onClick={submitMark}
                >
                  {busy === 'x' ? 'Menyimpan…' : '✗ Konfirmasi tolak laporan'}
                </button>
                <button
                  type="button"
                  style={{ ...btnBase }}
                  onClick={() => { setMarkOpen(false); setMarkReason(''); }}
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              style={{ ...btnBase, borderColor: '#fca5a5', color: '#b91c1c' }}
              onClick={() => { setMarkOpen(true); setErr(''); }}
            >
              ✗ Tolak laporan (wajib alasan)
            </button>
          )}

          {report.media_repair_url && report.status === 'dilaporkan' && !report.unverifiable && (
            <div
              style={{
                marginTop: 12,
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: 10,
                background: '#f0fdf4',
              }}
            >
              <span style={sectionTitle}>Perbaikan menurut media (menunggu)</span>
              <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 8, lineHeight: 1.5 }}>
                Berita/media menyatakan titik ini sudah diperbaiki.{' '}
                <a
                  href={report.media_repair_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#15803d', fontWeight: 700 }}
                >
                  Baca berita sumber
                </a>
                . Cocokkan dengan data Anda, lalu tutup titik (hijau ✓) atau tolak klaimnya.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{ ...btnBase, background: '#15803d', border: 'none', color: '#fff' }}
                  disabled={busy === 'mf'}
                  onClick={() => mediaFix('terima')}
                >
                  {busy === 'mf' ? 'Menyimpan…' : '✓ Setujui & tutup titik (hijau)'}
                </button>
                <button
                  type="button"
                  style={{ ...btnBase, background: '#fff', color: '#b91c1c', borderColor: '#fecaca' }}
                  disabled={busy === 'mf'}
                  onClick={() => mediaFix('tolak')}
                >
                  Tolak klaim media
                </button>
              </div>
            </div>
          )}

          {claimsLoaded && claims.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span style={sectionTitle}>Klaim perbaikan dari warga (menunggu)</span>
              {claims.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 6 }}>
                    <strong>{c.claimed_by_display_name || 'Warga terverifikasi'}</strong> ·{' '}
                    {new Date(c.created_at).toLocaleString('id-ID')}
                  </div>
                  {Array.isArray(c.photo_urls) && c.photo_urls.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {c.photo_urls.slice(0, 4).map((p, i) => (
                        <img
                          key={i}
                          src={p}
                          alt={`Bukti foto klaim ${i + 1}`}
                          style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                        />
                      ))}
                    </div>
                  )}
                  {c.note && (
                    <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 8 }}>{c.note}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      style={{ ...btnBase, background: '#15803d', border: 'none', color: '#fff' }}
                      disabled={busy === `c${c.id}`}
                      onClick={() => decideClaim(c.id, 'terima')}
                    >
                      ✓ Terima - tutup titik (hijau)
                    </button>
                    <button
                      type="button"
                      style={{ ...btnBase, background: '#fff', color: '#b91c1c', borderColor: '#fecaca' }}
                      disabled={busy === `c${c.id}`}
                      onClick={() => decideClaim(c.id, 'tolak')}
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {claimsLoaded && claims.length === 0 && (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b' }}>
              Tidak ada klaim perbaikan menunggu untuk titik ini.
            </p>
          )}
        </div>
      )}

      {/* ---- Warga: kelola laporan milik sendiri + klaim perbaikan ----
          Hanya tampil saat sesi warga terverifikasi aktif; pengunjung tanpa
          sesi tidak melihat bagian ini (keterangan dukungan di atas sudah
          cukup - CTA verifikasi ada di sidebar & alur jempol). */}
      {isWarga && (
        <div>
          <span style={sectionTitle}>Warga</span>

          {isWarga && (
            <>
              {canEditDelete && (
                <div style={{ marginBottom: 12 }}>
                  <span style={sectionTitle}>Kelola laporan Anda</span>
                  {editOpen ? (
                    <div
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 8,
                      }}
                    >
                      <input
                        aria-label="Nama lokasi (edit)"
                        value={editForm.location_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, location_name: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8 }}
                      />
                      <select
                        aria-label="Tingkat kerusakan (edit)"
                        value={editForm.severity}
                        onChange={(e) => setEditForm((f) => ({ ...f, severity: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8 }}
                      >
                        {SEVERITIES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      <textarea
                        aria-label="Deskripsi (edit)"
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        rows={3}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={{ ...btnBase, background: '#facc15', border: 'none' }} disabled={busy === 'edit'} onClick={saveEdit}>
                          {busy === 'edit' ? 'Menyimpan…' : 'Simpan perubahan'}
                        </button>
                        <button type="button" style={{ ...btnBase, background: '#fff' }} onClick={() => setEditOpen(false)}>
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <button type="button" style={{ ...btnBase }} onClick={() => setEditOpen(true)}>
                        ✏️ Edit laporan
                      </button>
                      <button type="button" style={{ ...btnBase, color: '#b91c1c', borderColor: '#fecaca' }} disabled={busy === 'del'} onClick={deleteReport}>
                        {busy === 'del' ? 'Menghapus…' : '🗑 Hapus laporan'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {canClaim && (
                <div>
                  <span style={sectionTitle}>Titik sudah diperbaiki?</span>
                  {claimMsg && (
                    <p style={{ margin: '0 0 10px', fontSize: 12.5, color: '#15803d' }}>{claimMsg}</p>
                  )}
                  {!claimOpen && (
                    <button type="button" style={{ ...btnBase, background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }} onClick={() => { setClaimOpen(true); setErr(''); }}>
                      ✔ Klaim sudah diperbaiki (wajib foto bukti)
                    </button>
                  )}
                  {claimOpen && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, marginTop: 8 }}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => pickClaimPhotos(e.target.files)}
                        aria-label="Foto bukti perbaikan"
                        style={{ fontSize: 12, marginBottom: 8 }}
                      />
                      {claimPhotos.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {claimPhotos.map((p, i) => (
                            <img key={i} src={p} alt={`Foto bukti ${i + 1}`} style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6 }} />
                          ))}
                        </div>
                      )}
                      <textarea
                        aria-label="Catatan klaim"
                        placeholder="Catatan singkat (opsional) - mis. jenis perbaikan"
                        value={claimNote}
                        onChange={(e) => setClaimNote(e.target.value)}
                        rows={2}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, marginBottom: 8, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={{ ...btnBase, background: '#15803d', border: 'none', color: '#fff' }} disabled={busy === 'claim'} onClick={submitClaim}>
                          {busy === 'claim' ? 'Mengirim…' : 'Kirim klaim ke otoritas'}
                        </button>
                        <button type="button" style={{ ...btnBase }} onClick={() => setClaimOpen(false)}>Batal</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {err && (
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#b91c1c' }}>{err}</p>
      )}
      {report.status === 'selesai_diperbaiki' && (
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#15803d' }}>
          ✓ Status laporan: <strong>{STATUS_LABELS.selesai_diperbaiki}</strong> - titik ditandai
          hijau di peta.
        </p>
      )}
    </div>
  );
}
