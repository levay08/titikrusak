// frontend/src/components/FooterModals.test.jsx
// Tes menu footer: Dokumentasi (legend peta, keterangan severity/status,
// panduan mengoperasikan) dan Syarat & Ketentuan (kebijakan privasi,
// mention e.id & KYC verification agar pelapor merasa aman).

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DocModal, TermsModal, ContactModal } from './FooterModals.jsx';

describe('FooterModals: Dokumentasi', () => {
  it('menampilkan legenda severity, keterangan status, kategori, dan panduan', () => {
    render(<DocModal onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Dokumentasi' })).toBeInTheDocument();

    // Legenda peta: severity dengan definisi (nama muncul di baris legenda
    // DAN di catatan warna -> pakai getAllByText).
    expect(screen.getByText(/Legenda Peta — Tingkat Kerusakan/)).toBeInTheDocument();
    expect(screen.getAllByText('Ringan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ambruk').length).toBeGreaterThan(0);
    expect(screen.getByText(/Kerusakan kosmetik atau kecil/)).toBeInTheDocument();
    // Catatan: hijau khusus laporan sudah diperbaiki (koreksi user) —
    // teks terbagi elemen <strong>, cek lewat textContent.
    expect(
      screen.getByText(
        (_c, el) =>
          el.tagName === 'P' &&
          el.textContent.includes('sudah diperbaiki') &&
          el.textContent.includes('bukan tingkat kerusakan')
      )
    ).toBeInTheDocument();

    // Keterangan status laporan (maksud tiap status).
    expect(screen.getByText('Status Laporan')).toBeInTheDocument();
    expect(screen.getByText(/Divalidasi oleh otoritas/)).toBeInTheDocument();
    expect(screen.getByText(/Sedang ditangani/)).toBeInTheDocument();

    // Panduan mengoperasikan web app.
    expect(screen.getByText('Panduan Mengoperasikan')).toBeInTheDocument();
    expect(screen.getAllByText(/Laporkan kerusakan/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dukung laporan/).length).toBeGreaterThan(0);
  });
});

describe('FooterModals: Syarat & Ketentuan', () => {
  it('menyebut kebijakan privasi, e.id, KYC, dan pelaporan anonim', () => {
    render(<TermsModal onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Syarat & Ketentuan' })).toBeInTheDocument();
    expect(screen.getByText('Kebijakan Privasi')).toBeInTheDocument();
    // e.id / KYC disebut di beberapa paragraf -> gunakan getAllByText.
    expect(screen.getAllByText(/e\.id/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/KYC/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TANPA KTP/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/anonim/i).length).toBeGreaterThan(0);
  });
});

describe('FooterModals: Kontak (form kirim email hello@arfhacorp.com)', () => {
  it('validasi: nama/email/pesan wajib sebelum submit', async () => {
    const user = (await import('@testing-library/user-event')).default;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<ContactModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /kirim ke hello@arfhacorp\.com/i }));
    expect(screen.getByText(/nama wajib diisi/i)).toBeInTheDocument();
    expect(screen.getByText(/email tidak valid/i)).toBeInTheDocument();
    expect(screen.getByText(/pesan minimal 10 karakter/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submit valid -> POST /api/contact + feedback sukses', async () => {
    vi.unstubAllGlobals();
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = (await import('@testing-library/user-event')).default;
    render(<ContactModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/nama \*/i), 'Pahlevy');
    await user.type(screen.getByLabelText(/email \*/i), 'pahlevy@example.com');
    await user.type(
      screen.getByLabelText(/pesan \*/i),
      'Halo, saya ingin bertanya tentang kerja sama.'
    );
    await user.click(screen.getByRole('button', { name: /kirim ke hello@arfhacorp\.com/i }));

    await screen.findByText(/pesan anda terkirim ke hello@arfhacorp\.com/i);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/contact',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
