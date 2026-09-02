// frontend/src/components/FooterModals.test.jsx
// Tes menu footer: Dokumentasi (legend peta, keterangan severity/status,
// panduan mengoperasikan) dan Syarat & Ketentuan (kebijakan privasi,
// mention e.id & KYC verification agar pelapor merasa aman).

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DocModal, TermsModal } from './FooterModals.jsx';

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
