// frontend/src/components/VerificationFlow.jsx
// Alur verifikasi e.id secara visual (File 2 Bagian 7.1 langkah kedelapan;
// File 1 Bagian 5.2 langkah 4a dan Bagian 9.8).
//
// Alur:
//   1. POST /api/verify/start dengan role (warga | otoritas).
//   2. Tampilkan QR (value = eid_oauth_url dari e.id, fallback JSON qr_data)
//      + indikator tahapan (File 1 9.8):
//        "Permintaan verifikasi telah dikirim" -> "Menunggu persetujuan pada
//        wallet" -> "Verifikasi berhasil diterima".
//   3. Polling GET /api/verify/status/:session_id tiap 4 detik (File 1 5.2:
//      3-5 detik), maksimal 5 menit sejak QR tampil.
//   4. approved -> hentikan polling, GET /api/verify/result/:session_id,
//      tawarkan "Tampilkan nama asli saya" / "Gunakan alias/anonim"
//      (File 1 3.5), lalu onComplete({ displayName, isVerified: true }).
//   5. expired/rejected/timeout -> hentikan polling, pesan jelas + tombol
//      coba lagi dari awal.

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';

const STEPS = [
  'Permintaan verifikasi telah dikirim',
  'Menunggu persetujuan pada wallet',
  'Verifikasi berhasil diterima',
];

const stepDot = (bg) => ({
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: bg,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

// pollIntervalMs & maxWaitMs dapat disuntikkan lewat props untuk uji
// (default sesuai File 1 Bagian 5.2: polling 3-5 detik, maks 5 menit).
export default function VerificationFlow({
  role,
  onComplete,
  onCancel,
  // Alur perangkat sentuh (ponsel/tablet): buka wallet e.id lewat deep
  // link (eid_oauth_url) - TANPA pindai QR. Desktop (false) = QR biasa.
  walletMode = false,
  pollIntervalMs = 4000,
  maxWaitMs = 5 * 60 * 1000,
}) {
  const [phase, setPhase] = useState(() => (role === 'otoritas' ? 'agency' : 'starting')); // starting | agency | qr | approved | failed
  const [qrData, setQrData] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [holderName, setHolderName] = useState(null);
  const [aliasMode, setAliasMode] = useState(false);
  const [alias, setAlias] = useState('');
  // Sisa waktu sesi (display countdown, 1 detik).
  const [remainingMs, setRemainingMs] = useState(maxWaitMs);
  // Alur wallet (mobile): QR disembunyikan - bisa dimunculkan sebagai
  // opsi cadangan lewat tautan "Atau pindai QR di perangkat lain".
  const [showQr, setShowQr] = useState(false);
  // Otoritas wajib memilih asal instansi ("bertindak sebagai") SEBELUM QR
  // ditampilkan - label inilah yang tampil publik (tanpa nama pribadi).
  const isOtoritasFlow = role === 'otoritas';
  const [agency, setAgency] = useState('');
  const agencyReady = !isOtoritasFlow || agency.trim().length >= 3;

  const deadlineRef = useRef(0);
  const sessionRef = useRef(null);

  const roleLabel = role === 'otoritas' ? 'Otoritas Lokal' : 'Warga';
  // Penjelasan skema verifikasi (File 1/File 2, alur yang dikoreksi):
  // otoritas = KYC e-KTP (identitas penuh/detail KTP); warga = Member
  // level 1 (email, nama, alamat, nomor telepon - tanpa KTP).
  const roleSchemaNote =
    role === 'otoritas'
      ? 'Verifikasi KYC e-KTP: identitas penuh dengan detail KTP untuk otoritas lokal.'
      : 'Verifikasi Member level 1: email, nama, alamat, dan nomor telepon - tanpa KTP.';

  // ---- Langkah 1: buat VP Request ----
  const startVerification = useCallback(async () => {
    setPhase('starting');
    setErrorMsg('');
    setAliasMode(false);
    setAlias('');
    setShowQr(false);
    try {
      const res = await fetch('/api/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          ...(role === 'otoritas' && agency.trim() ? { agency_label: agency.trim().slice(0, 120) } : {}),
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
      const data = await res.json();
      setQrData(data.qr_data);
      setQrUrl(data.eid_oauth_url || null);
      setSessionId(data.session_id);
      sessionRef.current = data.session_id;
      deadlineRef.current = Date.now() + maxWaitMs;
      setPhase('qr');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('failed');
    }
  }, [role, agency]);

  // ---- Mulai verifikasi (warga: langsung; otoritas: lewat tombol setelah
  //      memilih instansi - start eksplisit di tombol "Lanjutkan") ----
  useEffect(() => {
    if (!isOtoritasFlow && phase === 'starting') {
      startVerification();
    }
  }, [startVerification, isOtoritasFlow, phase]);

  // ---- Langkah 4-7: polling status sampai selesai ----
  useEffect(() => {
    if (phase !== 'qr' || !sessionId) return undefined;

    const finish = (nextPhase, message) => {
      setErrorMsg(message);
      setPhase(nextPhase);
    };

    const tick = async () => {
      // Batas waktu polling maksimal 5 menit sejak QR ditampilkan (File 1 5.2).
      if (Date.now() > deadlineRef.current) {
        finish('failed', 'Waktu verifikasi habis (5 menit). Silakan coba lagi.');
        return;
      }
      try {
        const res = await fetch(`/api/verify/status/${sessionId}`);
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
        const { status } = await res.json();

        if (status === 'approved') {
          // Langkah 5: ambil holder_did + holder_name.
          const r2 = await fetch(`/api/verify/result/${sessionId}`);
          if (!r2.ok) {
            let msg = `HTTP ${r2.status}`;
            try {
              const d = await r2.json();
              if (d.error) msg = d.error;
            } catch (_e) {
              // body bukan JSON
            }
            throw new Error(msg);
          }
          const result = await r2.json();
          setHolderName(result.holder_name || null);
          setPhase('approved');
        } else if (status === 'expired' || status === 'rejected') {
          finish(
            'failed',
            status === 'expired'
              ? 'Sesi verifikasi kedaluwarsa. Silakan coba lagi.'
              : 'Verifikasi ditolak. Silakan coba lagi.'
          );
        }
        // status 'pending' -> lanjut polling pada interval berikutnya.
      } catch (err) {
        finish('failed', `Gagal memeriksa status: ${err.message}`);
      }
    };

    tick();
    const interval = setInterval(tick, pollIntervalMs);
    // Begitu pengguna kembali ke tab ini (mis. selesai menyetujui di
    // wallet e.id), langsung periksa status - tidak perlu menunggu
    // interval polling berikutnya.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, sessionId, pollIntervalMs]);

  // ---- Countdown sisa waktu sesi (display per detik) ----
  useEffect(() => {
    if (phase !== 'qr') return undefined;
    const update = () => setRemainingMs(Math.max(0, deadlineRef.current - Date.now()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // mm:ss - angka tabular agar tidak berkedip saat berdetak.
  const fmtTime = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ---- Langkah 5: kirim hasil ke pemanggil sesuai pilihan (File 1 3.5) ----
  const handleRealName = () => {
    onComplete({ displayName: holderName, isVerified: true, session_id: sessionId });
  };
  const handleAlias = () => {
    const name = alias.trim() === '' ? 'Anonim' : alias.trim();
    onComplete({ displayName: name, isVerified: true, session_id: sessionId });
  };

  // Indeks tahap aktif: -1 = gagal, 0 = starting, 1 = qr, 2 = approved.
  const currentStep = phase === 'approved' ? 2 : phase === 'failed' ? -1 : phase === 'qr' ? 1 : 0;

  const qrValue = qrUrl || (qrData ? JSON.stringify(qrData) : '');
  // Alur wallet hanya tersedia bila backend mengirim eid_oauth_url (deep
  // link wallet). Tanpa URL itu, fallback ke QR seperti desktop.
  const canWallet = walletMode && !!qrUrl;

  // Chip countdown sisa waktu sesi (dipakai alur QR maupun wallet).
  const countdownChip = (
    <div
      style={{
        display: 'inline-block',
        marginTop: 12,
        padding: '6px 14px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        background: remainingMs < 10000 ? '#fef2f2' : '#f8fafc',
        border: `1px solid ${remainingMs < 10000 ? '#fca5a5' : '#e2e8f0'}`,
        color: remainingMs < 10000 ? '#b91c1c' : '#1c1917',
      }}
    >
      Sisa waktu: {fmtTime(remainingMs)}
    </div>
  );

  // Panel QR (desktop & opsi cadangan alur wallet).
  const qrPanel = (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          display: 'inline-block',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 14,
          boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        }}
      >
        <QRCode value={qrValue} size={200} />
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.5, color: '#334155' }}>
        Scan QR ini dengan aplikasi e.id Anda untuk menyetujui verifikasi.
        <br />
        Sesi berlaku maksimal 5 menit.
      </p>
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#1c1917' }}>
        Verifikasi e.id - {roleLabel}
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: 12, lineHeight: 1.5, color: '#64748b' }}>
        {roleSchemaNote}
      </p>

      <p style={{ margin: '0 0 14px', fontSize: 12, lineHeight: 1.5, color: '#64748b' }}>
        Belum punya akun e.id atau perlu daftar ulang?{' '}
        <a
          href="https://wallet.e.id/auth/login"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}
        >
          Daftar atau masuk di sini
        </a>
        .
      </p>

      {/* Indikator tahapan (File 1 Bagian 9.8) */}
      <ol
        style={{
          margin: '0 0 16px',
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {STEPS.map((label, i) => {
          const done = currentStep >= 2 || i < currentStep;
          const active = i === currentStep && currentStep !== -1;
          return (
            <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={stepDot(done ? '#22c55e' : active ? '#eab308' : '#cbd5e1')}>
                {done ? '✓' : i + 1}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: done || active ? '#1c1917' : '#94a3b8',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ---- Tahap agency (otoritas): pilih asal instansi dulu ---- */}
      {phase === 'agency' && (
        <div>
          <p style={{ margin: '0 0 10px', fontSize: 13.5, lineHeight: 1.5, color: '#475569' }}>
            Pilih atau tulis <strong>instansi/asal tempat Anda bertindak</strong>. Label ini
            yang tampil ke publik sebagai identitas otoritas - nama pribadi Anda tidak
            ditampilkan. Asal instansi diklaim sendiri oleh pengguna.
          </p>
          <input
            type="text"
            aria-label="Asal instansi otoritas"
            list="tk-agency-suggest"
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            placeholder="Contoh: BPBD Aceh Utara, Dinas PUPR Kota X, atau Warga KYC pemeriksa mandiri"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 13.5,
              marginBottom: 8,
            }}
          />
          <datalist id="tk-agency-suggest">
            {['Dinas PUPR', 'Dinas Pendidikan', 'BPBD', 'BPJN / Bina Marga', 'Kementerian PUPR', 'BUMN / BUMD', 'Pemerintah Kabupaten/Kota', 'Pemerintah Provinsi', 'TNI/Polri', 'Warga KYC (pemeriksa mandiri)'].map(
              (o) => (
                <option key={o} value={o} />
              )
            )}
          </datalist>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              disabled={!agencyReady}
              onClick={startVerification}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                background: agencyReady ? '#facc15' : '#e2e8f0',
                color: agencyReady ? '#1c1917' : '#94a3b8',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: agencyReady ? 'pointer' : 'not-allowed',
              }}
            >
              Lanjutkan & tampilkan QR
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '9px 12px',
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
            )}
          </div>
          {!agencyReady && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
              Tulis minimal 3 karakter (mis. nama instansi atau unit).
            </p>
          )}
        </div>
      )}

      {/* ---- Tahap starting ---- */}
      {phase === 'starting' && (
        <p style={{ fontSize: 14, color: '#334155' }}>Mengirim permintaan verifikasi…</p>
      )}

      {/* ---- Tahap QR: menunggu persetujuan di wallet ---- */}
      {phase === 'qr' &&
        (canWallet ? (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 10,
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: '#15803d',
                  fontWeight: 600,
                }}
              >
                Verifikasi langsung dari perangkat ini - tanpa pindai QR.
              </p>
              {/* Tab SAMA (4 Sep 2026): buka wallet di halaman ini, bukan
                  tab baru - setelah setujui, tekan kembali (←) browser;
                  status diperiksa otomatis saat halaman kembali aktif. */}
              <a
                href={qrValue}
                onClick={(e) => {
                  // Deep link wallet (eid://...) tidak bisa dipaksa di tab
                  // sama oleh browser; biarkan navigasi default.
                  e.preventDefault();
                  window.location.href = qrValue;
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 16px',
                  borderRadius: 8,
                  background: '#facc15',
                  color: '#1c1917',
                  fontSize: 14.5,
                  fontWeight: 700,
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                📲 Buka Wallet e.id
              </a>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.55, color: '#475569' }}>
              Aplikasi e.id akan terbuka untuk menyetujui verifikasi. Jika aplikasi
              belum terpasang, halaman wallet e.id terbuka di halaman yang sama. Setelah
              menyetujui, tekan kembali (←) di browser untuk kembali ke sini; status
              diperiksa otomatis.
            </p>
            {countdownChip}
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setShowQr((s) => !s)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: 12.5,
                  fontWeight: 600,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                {showQr ? 'Sembunyikan QR' : 'Atau pindai QR di perangkat lain'}
              </button>
            </div>
            {showQr && (
              <div style={{ marginTop: 12 }}>
                {qrPanel}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            {qrPanel}
            {countdownChip}
          </div>
        ))}

      {/* ---- Tahap approved: pilihan nama (File 1 3.5) ---- */}
      {phase === 'approved' && (
        <div>
          <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5, color: '#1c1917' }}>
            Verifikasi berhasil diterima.
            {holderName ? ` Nama yang terverifikasi: ${holderName}.` : ''}
          </p>
          {!aliasMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={handleRealName}
                style={{
                  padding: '11px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#facc15',
                  color: '#1c1917',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Tampilkan nama asli saya
              </button>
              <button
                type="button"
                onClick={() => setAliasMode(true)}
                style={{
                  padding: '11px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#1c1917',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Gunakan alias/anonim
              </button>
            </div>
          ) : (
            <div>
              <label
                htmlFor="alias"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#1c1917' }}
              >
                Nama alias (kosongkan untuk "Anonim")
              </label>
              <input
                id="alias"
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="Contoh: Warga Garut"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                  marginBottom: 8,
                }}
              />
              <button
                type="button"
                onClick={handleAlias}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#facc15',
                  color: '#1c1917',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Lanjut dengan alias
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---- Tahap failed (expired/rejected/error/timeout) ---- */}
      {phase === 'failed' && (
        <div>
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {errorMsg}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={startVerification}
              style={{
                flex: 1,
                padding: '11px 14px',
                borderRadius: 8,
                border: 'none',
                background: '#facc15',
                color: '#1c1917',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Coba Lagi
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '11px 14px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#1c1917',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Batal di tahap QR/starting/approved */}
      {(phase === 'qr' || phase === 'starting' || phase === 'approved') && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#475569',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Batal
          </button>
        </div>
      )}
    </div>
  );
}
