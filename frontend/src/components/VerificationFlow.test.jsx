// frontend/src/components/VerificationFlow.test.jsx
// Tes alur verifikasi e.id (File 2 Bagian 7.1 langkah kedelapan) dengan
// fetch di-stub: start -> QR + indikator tahapan, polling status ->
// approved -> pilihan nama -> onComplete, dan penanganan rejected.
// Polling dibuat cepat lewat prop pollIntervalMs (default produksi 4 dtk).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import VerificationFlow from './VerificationFlow.jsx';

// Mock fetch alur verifikasi: start -> qr_data; status berubah approved
// setelah `approveAfter` kali dipanggil (atau selalu `startStatus`);
// result -> holder_did + holder_name.
function buildFetchMock({ approveAfter = 2, startStatus = 'pending' } = {}) {
  let statusCalls = 0;
  return vi.fn((url) => {
    const u = String(url);
    if (u.includes('/api/verify/start')) {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          qr_data: { challenge: 'challenge-1', qr_token: 'qrtoken-1', schema_id: 'vs-1' },
          session_id: 'sess-1',
          eid_oauth_url:
            'https://wallet-sandbox.e.id/oauth/credential?c=challenge-1&q=qrtoken-1',
        }),
      });
    }
    if (u.includes('/api/verify/status/')) {
      statusCalls += 1;
      const status = statusCalls >= approveAfter ? 'approved' : startStatus;
      return Promise.resolve({ ok: true, json: async () => ({ status }) });
    }
    if (u.includes('/api/verify/result/')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ holder_did: 'did:eid:test', holder_name: 'Budi Santoso' }),
      });
    }
    throw new Error('unexpected fetch: ' + u);
  });
}

const FAST = { pollIntervalMs: 20, maxWaitMs: 5000 };

describe('VerificationFlow', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('start -> menampilkan QR (svg), indikator tahapan, dan polling status berjalan', async () => {
    const fetchMock = buildFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    render(<VerificationFlow role="warga" onComplete={vi.fn()} onCancel={vi.fn()} {...FAST} />);

    expect(await screen.findByText(/Scan QR ini dengan aplikasi e\.id/i)).toBeInTheDocument();
    expect(screen.getByText(/Permintaan verifikasi telah dikirim/i)).toBeInTheDocument();
    expect(screen.getByText(/Menunggu persetujuan pada wallet/i)).toBeInTheDocument();
    expect(document.querySelector('svg')).not.toBeNull(); // QR code ter-render

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/verify/status/'))
      ).toBe(true)
    );
  });

  it('polling approved -> pilih "Tampilkan nama asli saya" -> onComplete', async () => {
    vi.stubGlobal('fetch', buildFetchMock({ approveAfter: 2 }));
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<VerificationFlow role="warga" onComplete={onComplete} onCancel={vi.fn()} {...FAST} />);

    // Poll 1 (pending) lalu poll 2 (approved) + fetch result. Tombol
    // pilihan nama hanya muncul setelah fase approved tercapai.
    await user.click(
      await screen.findByRole('button', { name: /tampilkan nama asli saya/i }, { timeout: 2000 })
    );
    expect(onComplete).toHaveBeenCalledWith({ displayName: 'Budi Santoso', isVerified: true, session_id: 'sess-1' });
  });

  it('pilih alias -> onComplete dengan nama alias', async () => {
    vi.stubGlobal('fetch', buildFetchMock({ approveAfter: 1 }));
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<VerificationFlow role="warga" onComplete={onComplete} onCancel={vi.fn()} {...FAST} />);

    await user.click(
      await screen.findByRole('button', { name: /gunakan alias\/anonim/i }, { timeout: 2000 })
    );
    await user.type(screen.getByLabelText(/nama alias/i), 'Warga Garut');
    await user.click(screen.getByRole('button', { name: /lanjut dengan alias/i }));

    expect(onComplete).toHaveBeenCalledWith({ displayName: 'Warga Garut', isVerified: true, session_id: 'sess-1' });
  });

  it('status rejected -> pesan gagal + tombol Coba Lagi, polling berhenti', async () => {
    const fetchMock = buildFetchMock({ startStatus: 'rejected' });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<VerificationFlow role="otoritas" onComplete={vi.fn()} onCancel={vi.fn()} {...FAST} />);

    // Otoritas wajib memilih asal instansi sebelum QR/verifikasi berjalan.
    await user.type(screen.getByLabelText(/asal instansi otoritas/i), 'BPBD Uji');
    await user.click(screen.getByRole('button', { name: /lanjutkan & tampilkan qr/i }));

    expect(await screen.findByText(/Verifikasi ditolak/i, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();

    // Polling berhenti setelah fase failed.
    const statusCallsBefore = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/verify/status/')
    ).length;
    await new Promise((r) => setTimeout(r, 120));
    const statusCallsAfter = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes('/api/verify/status/')
    ).length;
    expect(statusCallsAfter).toBe(statusCallsBefore);
  });
});

describe('VerificationFlow walletMode (ponsel/tablet - buka wallet e.id, tanpa pindai QR)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // Status tetap pending (approveAfter sangat besar) agar UI tahap QR
  // stabil selama pengujian - approval dibahas tes desktop terpisah.
  const STAY_PENDING = { approveAfter: Number.MAX_SAFE_INTEGER };

  it('menampilkan tautan "Buka Wallet e.id" (deep link) dan TIDAK meminta scan QR', async () => {
    const fetchMock = buildFetchMock(STAY_PENDING);
    vi.stubGlobal('fetch', fetchMock);
    render(<VerificationFlow role="warga" walletMode onComplete={vi.fn()} onCancel={vi.fn()} {...FAST} />);

    const walletLink = await screen.findByRole('link', { name: /buka wallet e\.id/i }, { timeout: 2000 });
    expect(walletLink).toHaveAttribute(
      'href',
      'https://wallet-sandbox.e.id/oauth/credential?c=challenge-1&q=qrtoken-1'
    );
    expect(walletLink).toHaveAttribute('target', '_blank');
    // Tanpa pindai QR di perangkat ini.
    expect(screen.queryByText(/Scan QR ini dengan aplikasi e\.id/i)).not.toBeInTheDocument();
    expect(screen.getByText(/tanpa pindai QR/i)).toBeInTheDocument();
  });

  it('opsi cadangan "pindai QR di perangkat lain" memunculkan QR', async () => {
    const fetchMock = buildFetchMock(STAY_PENDING);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<VerificationFlow role="warga" walletMode onComplete={vi.fn()} onCancel={vi.fn()} {...FAST} />);

    await user.click(
      await screen.findByRole('button', { name: /pindai QR di perangkat lain/i }, { timeout: 2000 })
    );
    expect(screen.getByText(/Scan QR ini dengan aplikasi e\.id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sembunyikan QR/i })).toBeInTheDocument();
  });
});
