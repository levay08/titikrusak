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

  it('dropdown status verifikasi nonaktif (disabled) sampai verifikasi e.id ada', () => {
    render(<FilterPanel filters={EMPTY} onChange={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /status verifikasi/i })).toBeDisabled();
  });

  it('tombol Reset Filter memanggil onReset', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<FilterPanel filters={EMPTY} onChange={vi.fn()} onReset={onReset} />);

    await user.click(screen.getByRole('button', { name: /reset filter/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
