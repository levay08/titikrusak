// frontend/src/components/ModalEscape.test.jsx
// Tombol Escape menutup modal di mana pun terbuka (setara klik ✕):
// ModalShell, SearchModal, DetailModal; overlay di dalam modal
// (VerificationFlow) menangani Escape lebih dulu (capture) sehingga modal
// luarnya TIDAK ikut tertutup.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ModalShell, NotifikasiModal } from './HeaderModals.jsx';
import SearchModal from './SearchModal.jsx';
import DetailModal from './DetailModal.jsx';
import VerificationFlow from './VerificationFlow.jsx';

// Target = document.body (bukan document) agar fase capture/bubble di
// document berjalan seperti browser asli (event dari elemen yang terfokus).
const pressEscape = () => fireEvent.keyDown(document.body, { key: 'Escape' });

describe('Escape menutup modal (kerangka ModalShell)', () => {
  it('Escape memanggil onClose; tombol lain tidak', () => {
    const onClose = vi.fn();
    render(
      <ModalShell title="Uji" onClose={onClose}>
        Isi modal
      </ModalShell>
    );

    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Escape menutup SearchModal', () => {
  it('Escape memanggil onClose', () => {
    const onClose = vi.fn();
    render(<SearchModal reports={[]} onClose={onClose} onOpenReport={vi.fn()} />);
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Escape menutup DetailModal (modal detail laporan)', () => {
  const REPORT = {
    id: 1,
    location_name: 'Jembatan Cibeureum, Garut',
    status: 'dilaporkan',
    infra_type: 'jembatan',
    severity: 'berat',
    created_at: '2025-11-01 00:00:00',
  };

  afterEach(() => vi.unstubAllGlobals());

  it('Escape memanggil onClose', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ history: [], comments: [] }) }))
    );
    const onClose = vi.fn();
    render(<DetailModal report={REPORT} onClose={onClose} onReportUpdated={vi.fn()} />);

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Escape pada overlay di dalam modal (prioritas capture)', () => {
  const FAST = { pollIntervalMs: 20, maxWaitMs: 5000 };

  afterEach(() => vi.unstubAllGlobals());

  it('Escape saat VerificationFlow terbuka = Batal (onCancel), bukan menutup modal luar', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            qr_data: { challenge: 'c', qr_token: 'q' },
            session_id: 'sess-1',
            eid_oauth_url: 'https://wallet-sandbox.e.id/oauth/credential?c=c&q=q',
          }),
        })
      )
    );

    const outerClose = vi.fn();
    const innerCancel = vi.fn();

    // VerificationFlow (role otoritas) di dalam ModalShell: verifikasi yang
    // terbuka di dalam modal. Escape harus = Batal alur verifikasi.
    render(
      <ModalShell title="Masuk Otoritas" onClose={outerClose}>
        <VerificationFlow
          role="otoritas"
          onComplete={vi.fn()}
          onCancel={innerCancel}
          {...FAST}
        />
      </ModalShell>
    );

    expect(screen.getByLabelText(/asal instansi otoritas/i)).toBeInTheDocument();
    pressEscape();

    expect(innerCancel).toHaveBeenCalledTimes(1);
    expect(outerClose).not.toHaveBeenCalled();
  });

  it('VerificationFlow berdiri sendiri: Escape memanggil onCancel', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({
            qr_data: { challenge: 'c', qr_token: 'q' },
            session_id: 'sess-2',
            eid_oauth_url: 'https://wallet-sandbox.e.id/oauth/credential?c=c&q=q',
          }),
        })
      )
    );
    const onCancel = vi.fn();
    render(
      <VerificationFlow role="warga" onComplete={vi.fn()} onCancel={onCancel} {...FAST} />
    );

    pressEscape();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('NotifikasiModal (berbasis ModalShell) ikut menutup dengan Escape', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Escape memanggil onClose', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ activities: [], commentGroups: [] }),
        })
      )
    );
    const onClose = vi.fn();
    render(<NotifikasiModal onClose={onClose} />);

    await screen.findByText(/belum ada aktivitas/i);
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
