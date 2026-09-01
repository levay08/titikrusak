// frontend/src/components/FilterPanel.test.jsx
// Tes interaksi FilterPanel: toggle checkbox multi-select, search box,
// dropdown sorting, dan tombol Reset Filter — semuanya memicu onChange
// dengan state filter baru (real-time, tanpa submit).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import FilterPanel from './FilterPanel.jsx';

const EMPTY = {
  severity: [],
  infra_type: [],
  bridge_authority: [],
  vital_status: [],
  q: '',
  sort: 'terbaru',
};

describe('FilterPanel: status e.id sejalan dengan sesi otoritas', () => {
  it('saat otoritas login: kartu terverifikasi menampilkan Role Otoritas + nama KTP + tombol keluar', async () => {
    const user = userEvent.setup();
    const onLogoutOtoritas = vi.fn();
    render(
      <FilterPanel
        filters={EMPTY}
        onChange={vi.fn()}
        onReset={vi.fn()}
        otoritas={{ displayName: 'Budi Santoso' }}
        onLogoutOtoritas={onLogoutOtoritas}
      />
    );

    expect(screen.getByText('Terverifikasi e.id')).toBeInTheDocument();
    expect(screen.getByText('Otoritas')).toBeInTheDocument();
    expect(screen.getByText(/KYC e-KTP — nama sesuai KTP/)).toBeInTheDocument();
    expect(screen.getByText(/sebagai Budi Santoso/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Keluar \/ Logout e.id/ }));
    expect(onLogoutOtoritas).toHaveBeenCalledTimes(1);
  });

  it('tombol "Verifikasi e.id" (belum terverifikasi) berwarna biru muda #60a5fa', () => {
    render(<FilterPanel filters={EMPTY} onChange={vi.fn()} onReset={vi.fn()} />);

    const btn = screen.getByRole('button', { name: 'Verifikasi e.id' });
    expect(btn.style.background).toBe('rgb(96, 165, 250)'); // #60a5fa
    expect(btn.style.color).toBe('rgb(255, 255, 255)');
  });
});

describe('FilterPanel', () => {
  it('toggle checkbox tingkat kerusakan memicu onChange dengan nilai baru', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterPanel filters={EMPTY} onChange={onChange} onReset={vi.fn()} />);

    await user.click(screen.getByRole('checkbox', { name: 'Ambruk' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ severity: ['ambruk'] }));

    // Render ulang dengan state baru, lalu uncheck.
    render(
      <FilterPanel
        filters={{ ...EMPTY, severity: ['ambruk'] }}
        onChange={onChange}
        onReset={vi.fn()}
      />
    );
    // Ambil checkbox yang checked pada instance kedua.
    const checkbox = screen.getAllByRole('checkbox', { name: 'Ambruk' })[1];
    await user.click(checkbox);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ severity: [] })
    );
  });

  it('search box nama lokasi dan dropdown sorting memicu onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterPanel filters={EMPTY} onChange={onChange} onReset={vi.fn()} />);

    // fireEvent.change sekali set value penuh (user.type memicu onChange
    // per karakter; user.paste tidak men-dispatch input di jsdom).
    fireEvent.change(screen.getByRole('textbox', { name: /nama lokasi/i }), {
      target: { value: 'Garut' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Garut' }));

    await user.selectOptions(screen.getByRole('combobox', { name: /urutkan/i }), 'terparah');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'terparah' }));
  });

  it('status verifikasi e.id: menampilkan "Belum terverifikasi" + tombol verifikasi saat belum', async () => {
    const user = userEvent.setup();
    const onRequestVerify = vi.fn();
    render(
      <FilterPanel
        filters={EMPTY}
        onChange={vi.fn()}
        onReset={vi.fn()}
        eidVerified={false}
        onRequestVerify={onRequestVerify}
      />
    );

    expect(screen.getByText('Status Verifikasi e.id')).toBeInTheDocument();
    expect(screen.getByText('Belum terverifikasi e.id')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /verifikasi e\.id/i }));
    expect(onRequestVerify).toHaveBeenCalledTimes(1);
  });

  it('status verifikasi e.id: AKTIF saat terverifikasi — menampilkan role Warga + nama + tombol Keluar', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    render(
      <FilterPanel
        filters={EMPTY}
        onChange={vi.fn()}
        onReset={vi.fn()}
        eidVerified
        eidDisplayName="Warga Garut"
        onLogoutEid={onLogout}
      />
    );

    expect(screen.getByText('Terverifikasi e.id')).toBeInTheDocument();
    expect(screen.getByText(/Role:/)).toBeInTheDocument();
    expect(screen.getByText('Warga')).toBeInTheDocument();
    expect(screen.getByText(/Member Lv1 — email, nama, alamat, no\. telepon/)).toBeInTheDocument();
    expect(screen.getByText(/sebagai Warga Garut/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verifikasi e\.id/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /keluar \/ logout e\.id/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('tombol Reset Filter memanggil onReset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<FilterPanel filters={EMPTY} onChange={vi.fn()} onReset={onReset} />);

    await user.click(screen.getByRole('button', { name: /reset filter/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
