// frontend/src/components/ReportManagePanel.test.jsx
// Tes panel kelola laporan (fitur 2 Sep 2026): tanda ✗, edit/hapus hanya
// untuk pelapor, klaim perbaikan wajib foto (guard klien), laporan selesai
// tidak bisa diklaim lagi.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import ReportManagePanel from './ReportManagePanel.jsx';

const baseReport = {
  id: 42,
  source_type: 'warga',
  reporter_is_verified: 1,
  status: 'dilaporkan',
  unverifiable: 0,
  description: 'Jembatan rusak berat setelah banjir bandang',
  location_name: 'Jembatan Cibeureum, Garut',
  severity: 'berat',
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })));
});

function asWarga() {
  localStorage.setItem(
    'titikrusak_eid_session',
    JSON.stringify({ session_id: 'sess-warga-9', role: 'warga' })
  );
}

describe('ReportManagePanel (kelola laporan)', () => {
  it('warga terverifikasi: lihat tombol Edit & Hapus pada laporan miliknya (status dilaporkan)', () => {
    asWarga();
    render(<ReportManagePanel report={baseReport} otoritas={null} onReportUpdated={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /edit laporan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hapus laporan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /klaim sudah diperbaiki/i })).toBeInTheDocument();
  });

  it('bukan pelapor (report media / reporter_is_verified 0): TIDAK ada Edit/Hapus', () => {
    asWarga();
    render(
      <ReportManagePanel
        report={{ ...baseReport, source_type: 'media', reporter_is_verified: 0 }}
        otoritas={null}
        onReportUpdated={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /edit laporan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hapus laporan/i })).not.toBeInTheDocument();
  });

  it('titik bertanda ✗ menampilkan peringatan tidak dapat diverifikasi', () => {
    asWarga();
    render(
      <ReportManagePanel
        report={{ ...baseReport, unverifiable: 1 }}
        otoritas={null}
        onReportUpdated={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/tidak dapat diverifikasi keasliannya/i)).toBeInTheDocument();
  });

  it('klaim perbaikan TANPA foto diblokir pesan wajib foto (tanpa request)', async () => {
    asWarga();
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<ReportManagePanel report={baseReport} otoritas={null} onReportUpdated={() => {}} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /klaim sudah diperbaiki/i }));
    await user.click(screen.getByRole('button', { name: /kirim klaim ke otoritas/i }));
    expect(screen.getByText(/wajib menyertakan minimal 1 foto bukti/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('laporan selesai diperbaiki: tidak ada tombol klaim, ada catatan hijau', () => {
    asWarga();
    render(
      <ReportManagePanel
        report={{ ...baseReport, status: 'selesai_diperbaiki' }}
        otoritas={null}
        onReportUpdated={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /klaim sudah diperbaiki/i })).not.toBeInTheDocument();
    expect(screen.getByText(/status laporan/i)).toBeInTheDocument();
  });

  it('otoritas: tombol tolak laporan muncul, dan TIDAK ada tombol Hapus; alasan wajib', async () => {
    localStorage.setItem(
      'titikrusak_eid_session',
      JSON.stringify({ session_id: 'sess-otor-9', role: 'otoritas' })
    );
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <ReportManagePanel
        report={baseReport}
        otoritas={{ displayName: 'Otoritas Uji' }}
        onReportUpdated={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /tolak laporan/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hapus laporan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit laporan/i })).not.toBeInTheDocument();

    // Tanpa alasan -> diblokir (belum ada request).
    await user.click(screen.getByRole('button', { name: /tolak laporan/i }));
    await user.click(screen.getByRole('button', { name: /konfirmasi tolak laporan/i }));
    expect(screen.getByText(/alasan penolakan wajib diisi minimal 10 karakter/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('detail titik yang ditolak menampilkan ALASAN penolakan dari otoritas', () => {
    asWarga();
    render(
      <ReportManagePanel
        report={{ ...baseReport, unverifiable: 1, unverifiable_reason: 'Foto tidak sesuai lokasi yang dilaporkan' }}
        otoritas={null}
        onReportUpdated={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/laporan ditolak otoritas/i)).toBeInTheDocument();
    expect(screen.getByText(/foto tidak sesuai lokasi yang dilaporkan/i)).toBeInTheDocument();
  });
});
