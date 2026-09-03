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
    expect(screen.getByText(/Legenda Peta - Tingkat Kerusakan/)).toBeInTheDocument();
    expect(screen.getAllByText('Ringan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ambruk').length).toBeGreaterThan(0);
    expect(screen.getByText(/Kerusakan kosmetik atau kecil/)).toBeInTheDocument();
    // Catatan: hijau khusus laporan sudah diperbaiki (koreksi user) -
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

describe('FooterModals: Kontak (form -> buka WhatsApp 62818101990)', () => {
  let origOpen;
  beforeEach(() => {
    origOpen = window.open;
    window.open = vi.fn();
  });
  afterEach(() => {
    window.open = origOpen;
  });

  it('menampilkan penjelasan form kontak yang baru (nomor support, bukan nomor di teks)', () => {
    render(<ContactModal onClose={vi.fn()} />);

    expect(
      screen.getByText(
        (_c, el) =>
          el.tagName === 'P' &&
          el.textContent.includes('Ada masukan, pertanyaan, atau ingin kerja sama?') &&
          el.textContent.includes('Silahkan isi form dibawah ini') &&
          el.textContent.includes('nomor support kami') &&
          el.textContent.includes('Terima kasih!')
      )
    ).toBeInTheDocument();
    // Nomor WhatsApp TIDAK muncul lagi di teks penjelasan.
    expect(screen.queryByText(/62818101990/)).not.toBeInTheDocument();
  });

  it('validasi: nama & pesan wajib sebelum membuka WhatsApp', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<ContactModal onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /kirim via whatsapp/i }));
    expect(screen.getByText(/nama wajib diisi/i)).toBeInTheDocument();
    expect(screen.getByText(/pesan minimal 10 karakter/i)).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('submit valid -> buka WhatsApp dengan pesan berformat rapi (bukan satu baris)', async () => {
    const user = (await import('@testing-library/user-event')).default;
    render(<ContactModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/nama \*/i), 'Pahlevy');
    await user.type(
      screen.getByLabelText(/pesan \*/i),
      'Halo, saya ingin bertanya tentang kerja sama.'
    );
    await user.click(screen.getByRole('button', { name: /kirim via whatsapp/i }));

    expect(window.open).toHaveBeenCalledTimes(1);
    const url = window.open.mock.calls[0][0];
    expect(url).toContain('https://wa.me/62818101990?text=');
    // Isi form ikut terbawa + format pakai baris baru (encode %0A), bukan
    // satu baris panjang.
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('Nama: Pahlevy');
    expect(decoded).toContain('Pesan:');
    expect(decoded).toContain('Halo, saya ingin bertanya tentang kerja sama.');
    expect(url).toContain('%0A'); // URL memakai baris baru (encode) -> rapi
    expect(decoded).toContain('\n'); // pesan multi-baris, bukan satu baris

    // Feedback sukses + tombol cadangan Buka WhatsApp (teks utuh di <p>,
    // cek lewat textContent karena emoji/aksen di awal kalimat).
    expect(
      await screen.findByText(
        (_c, el) => el.tagName === 'P' && el.textContent.includes('WhatsApp terbuka dengan pesan Anda') && el.textContent.includes('tinggal tekan tombol kirim')
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /buka whatsapp/i })).toHaveAttribute(
      'href',
      url
    );
  });
});
