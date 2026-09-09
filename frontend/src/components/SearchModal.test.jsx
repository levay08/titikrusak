// frontend/src/components/SearchModal.test.jsx
// Tes modal hasil pencarian header (poin: tagline -> search bar):
//   - hasil sesuai kata kunci (mis. "Depok" cocok dengan nama lokasi);
//   - kata kunci tanpa kecocokan -> modal "tidak ada hasil";
//   - klik hasil memanggil onOpenReport (membuka DetailModal laporan);
//   - initialQuery dari search bar header mengisi input otomatis.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import SearchModal from './SearchModal.jsx';

const REPORTS = [
  {
    id: 1,
    location_name: 'Jembatan Penghubung Depok–Bogor, Sukmajaya (Jawa Barat)',
    description: 'Jembatan putus akibat banjir.',
    infra_type: 'jembatan',
    severity: 'ambruk',
    status: 'dilaporkan',
    source_media_name: 'detikJabar',
    created_at: '2025-11-01T00:00:00Z',
  },
  {
    id: 2,
    location_name: 'Jalan Raya Cianjur (Jawa Barat)',
    description: 'Longsor menutup badan jalan.',
    infra_type: 'jalan',
    severity: 'berat',
    status: 'terverifikasi',
    created_at: '2025-10-01T00:00:00Z',
  },
];

describe('SearchModal: hasil pencarian kata kunci', () => {
  it('menampilkan hanya laporan yang cocok dengan kata kunci lokasi (mis. Depok)', async () => {
    const user = userEvent.setup();
    render(<SearchModal reports={REPORTS} onClose={vi.fn()} onOpenReport={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), 'Depok');

    expect(screen.getByText(/Jembatan Penghubung Depok–Bogor/)).toBeInTheDocument();
    expect(screen.queryByText(/Jalan Raya Cianjur/)).not.toBeInTheDocument();
    expect(screen.getByText(/1 titik ditemukan/)).toBeInTheDocument();
  });

  it('menampilkan "Tidak ada hasil" saat kata kunci tidak cocok dengan apa pun', async () => {
    const user = userEvent.setup();
    render(<SearchModal reports={REPORTS} onClose={vi.fn()} onOpenReport={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), 'zxyz-tidak-ada');

    expect(screen.getByText(/Tidak ada hasil untuk/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Jembatan Penghubung Depok/ })).not.toBeInTheDocument();
  });

  it('klik hasil memanggil onOpenReport dengan laporan tersebut', async () => {
    const user = userEvent.setup();
    const onOpenReport = vi.fn();
    render(<SearchModal reports={REPORTS} onClose={vi.fn()} onOpenReport={onOpenReport} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), 'Depok');
    await user.click(screen.getByText(/Jembatan Penghubung Depok–Bogor/));

    expect(onOpenReport).toHaveBeenCalledTimes(1);
    expect(onOpenReport).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('initialQuery dari search bar header mengisi input pencarian otomatis', () => {
    render(
      <SearchModal reports={REPORTS} initialQuery="Cianjur" onClose={vi.fn()} onOpenReport={vi.fn()} />
    );

    expect(screen.getByPlaceholderText(/kata kunci/i)).toHaveValue('Cianjur');
    expect(screen.getByText(/Jalan Raya Cianjur/)).toBeInTheDocument();
  });
});

describe('SearchModal: pencarian nomor ID laporan', () => {
  // Laporan id 458 tidak memuat angka 458 di lokasi/deskripsi apa pun;
  // laporan id 500 yang lebih baru justru memuat "458" di deskripsinya.
  const ID_AND_TEXT = [
    {
      id: 458,
      location_name: 'Jembatan Uji Cilacap',
      description: 'Retak ringan di tiang penyangga.',
      infra_type: 'jembatan',
      severity: 'berat',
      status: 'dilaporkan',
      created_at: '2025-09-01T00:00:00Z',
    },
    {
      id: 500,
      location_name: 'Jalan Raya Uji',
      description: 'Pagar pembatas roboh selebar 458 cm.',
      infra_type: 'jalan',
      severity: 'berat',
      status: 'terverifikasi',
      created_at: '2026-02-01T00:00:00Z',
    },
  ];

  it('angka "458" menampilkan titik id 458 (lewat ID) DAN titik yang deskripsinya memuat "458"', async () => {
    const user = userEvent.setup();
    render(<SearchModal reports={ID_AND_TEXT} onClose={vi.fn()} onOpenReport={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), '458');

    // Keduanya muncul: kecocokan deskripsi dan kecocokan ID.
    expect(screen.getByText(/Jembatan Uji Cilacap/)).toBeInTheDocument();
    expect(screen.getByText(/Jalan Raya Uji/)).toBeInTheDocument();
    expect(screen.getByText(/2 titik ditemukan/)).toBeInTheDocument();
  });

  it('angka yang persis ID diberi penanda dan dinaikkan ke urutan pertama', async () => {
    const user = userEvent.setup();
    render(<SearchModal reports={ID_AND_TEXT} onClose={vi.fn()} onOpenReport={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), '458');

    // Penanda "ID #458" + keterangan cocok tepat di baris jumlah hasil.
    expect(screen.getByText('ID #458')).toBeInTheDocument();
    expect(screen.getByText(/ID #458 cocok tepat/)).toBeInTheDocument();
    // Hasil ID tepat di urutan pertama, walau lebih lama dari hasil teks.
    const rows = screen.getAllByRole('button', { name: /Uji/ });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Jembatan Uji Cilacap');
    expect(rows[0]).toHaveTextContent('ID #458');
  });

  it('angka yang bukan ID persis tetap mencari teks, tanpa penanda ID', async () => {
    const user = userEvent.setup();
    const reports = [
      {
        id: 10,
        location_name: 'Jalan Raya Bandung',
        description: 'Genangan setinggi 2 meter setelah hujan.',
        infra_type: 'jalan',
        severity: 'berat',
        status: 'dilaporkan',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 20,
        location_name: 'Jembatan Penghubung Sukabumi',
        description: 'Aspal mengelupas.',
        infra_type: 'jembatan',
        severity: 'berat',
        status: 'terverifikasi',
        created_at: '2025-12-01T00:00:00Z',
      },
    ];
    render(<SearchModal reports={reports} onClose={vi.fn()} onOpenReport={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), '2');

    // id 10 cocok lewat deskripsi, id 20 cocok lewat string ID-nya.
    expect(screen.getByText(/Jalan Raya Bandung/)).toBeInTheDocument();
    expect(screen.getByText(/Jembatan Penghubung Sukabumi/)).toBeInTheDocument();
    // Tidak ada id 2 -> tidak ada penanda ID / "cocok tepat".
    expect(screen.queryByText(/ID #\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cocok tepat/)).not.toBeInTheDocument();
  });

  it('hasil ID tepat tetap muncul walau >50 hasil teks lain (tidak terpotong batas 50)', async () => {
    const user = userEvent.setup();
    // 55 titik baru yang deskripsinya memuat "458" + 1 titik lama id 458.
    const filler = Array.from({ length: 55 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 7, 31 - i)); // mundur dari 31 Agu 2026
      return {
        id: 6000 + i,
        location_name: `Jalan Filler ${6000 + i}`,
        description: 'Retakan lebar sekitar 458 cm pada aspal.',
        infra_type: 'jalan',
        severity: 'berat',
        status: 'dilaporkan',
        created_at: d.toISOString(),
      };
    });
    const reports = [
      ...filler,
      {
        id: 458,
        location_name: 'Jembatan Tua Tepat',
        description: 'Retak ringan di tiang penyangga.',
        infra_type: 'jembatan',
        severity: 'berat',
        status: 'dilaporkan',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];
    render(<SearchModal reports={reports} onClose={vi.fn()} onOpenReport={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/kata kunci/i), '458');

    const rows = screen.getAllByRole('button', { name: /Jembatan Tua Tepat|Jalan Filler/ });
    expect(rows).toHaveLength(50); // batas hasil tetap 50
    expect(rows[0]).toHaveTextContent('Jembatan Tua Tepat');
    expect(rows[0]).toHaveTextContent('ID #458');
  });
});
