// frontend/src/components/AdminView.test.jsx
// Tes halaman Administrator (poin: "page administrator yang juga ada
// menunya sebelum login"):
//   - belum login sebagai otoritas -> gerbang (gate) dengan tombol
//     "Masuk sebagai Otoritas" (menu memang tampil sebelum login);
//   - setelah masuk otoritas -> laporan tampil + tab filter status;
//   - klik baris laporan membuka DetailModal (verifikasi / tracking status).

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import AdminView from './AdminView.jsx';

const REPORTS = [
  {
    id: 1,
    location_name: 'Jembatan Depok',
    infra_type: 'jembatan',
    severity: 'berat',
    status: 'dilaporkan',
    reporter_is_verified: false,
    vote_count: 0,
    description: 'Retak parah di badan jembatan.',
    created_at: '2025-11-01T00:00:00Z',
  },
  {
    id: 2,
    location_name: 'Jalan Raya Cianjur',
    infra_type: 'jalan',
    severity: 'ambruk',
    status: 'terverifikasi',
    reporter_is_verified: true,
    vote_count: 5,
    description: 'Longsor menutup badan jalan.',
    created_at: '2025-10-01T00:00:00Z',
  },
];

describe('AdminView: gerbang sebelum login (menu ada untuk semua pengguna)', () => {
  it('menampilkan gerbang + tombol masuk otoritas saat belum login', () => {
    render(
      <AdminView
        reports={REPORTS}
        otoritas={null}
        onRequestLogin={vi.fn()}
        onReportUpdated={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText('Panel Administrator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masuk sebagai Otoritas/ })).toBeInTheDocument();
    // Belum login: baris laporan TIDAK boleh tampil.
    expect(screen.queryByText(/Jembatan Depok/)).not.toBeInTheDocument();
  });

  it('klik "Masuk sebagai Otoritas" memicu onRequestLogin', async () => {
    const user = userEvent.setup();
    const onRequestLogin = vi.fn();
    render(
      <AdminView
        reports={REPORTS}
        otoritas={null}
        onRequestLogin={onRequestLogin}
        onReportUpdated={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Masuk sebagai Otoritas/ }));
    expect(onRequestLogin).toHaveBeenCalledTimes(1);
  });
});

describe('AdminView: panel otoritas (organize + verifikasi + tracking status)', () => {
  it('menampilkan laporan + tab filter status saat sudah login sebagai otoritas', () => {
    render(
      <AdminView
        reports={REPORTS}
        otoritas={{ displayName: 'Dinas PU Kab. X' }}
        onRequestLogin={vi.fn()}
        onReportUpdated={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText(/Dinas PU Kab. X/)).toBeInTheDocument();
    expect(screen.getByText(/2 laporan total/)).toBeInTheDocument();
    expect(screen.getByText('Jembatan Depok')).toBeInTheDocument();
    expect(screen.getByText('Jalan Raya Cianjur')).toBeInTheDocument();
    // Tab filter status dengan jumlah.
    expect(screen.getByRole('button', { name: /Dilaporkan \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Terverifikasi \(1\)/ })).toBeInTheDocument();
  });

  it('tab filter status menyaring laporan', async () => {
    const user = userEvent.setup();
    render(
      <AdminView
        reports={REPORTS}
        otoritas={{ displayName: 'Dinas PU' }}
        onRequestLogin={vi.fn()}
        onReportUpdated={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Terverifikasi \(1\)/ }));
    expect(screen.getByText('Jalan Raya Cianjur')).toBeInTheDocument();
    expect(screen.queryByText('Jembatan Depok')).not.toBeInTheDocument();
  });

  it('klik baris laporan membuka DetailModal (verifikasi / tracking status)', async () => {
    const user = userEvent.setup();
    render(
      <AdminView
        reports={REPORTS}
        otoritas={{ displayName: 'Dinas PU' }}
        onRequestLogin={vi.fn()}
        onReportUpdated={vi.fn()}
        onBack={vi.fn()}
      />
    );

    await user.click(screen.getByText('Jembatan Depok'));

    // DetailModal terbuka: judul lokasi + tombol tindakan otoritas
    // (laporan berstatus 'dilaporkan' -> berikutnya 'terverifikasi').
    expect(screen.getByRole('heading', { name: 'Jembatan Depok' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tandai Terverifikasi \(Approve\)/ })).toBeInTheDocument();
  });
});
