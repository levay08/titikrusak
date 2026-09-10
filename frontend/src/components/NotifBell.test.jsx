// frontend/src/components/NotifBell.test.jsx
// Kunci perilaku menu Notifikasi: tetap bersimbol lonceng, punya NAMA menu,
// dan badge jumlah yang belum dibaca (plus dering saat jumlahnya bertambah).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import NotifBell from './NotifBell.jsx';

describe('NotifBell: menu notifikasi dengan badge belum dibaca', () => {
  it('tetap memakai simbol lonceng dan menampilkan nama menu "Notifikasi"', () => {
    render(<NotifBell count={0} onClick={vi.fn()} />);
    expect(screen.getByText('🔔')).toBeInTheDocument();
    expect(screen.getByText('Notifikasi')).toBeInTheDocument();
    // Tanpa notifikasi baru: tidak ada badge.
    expect(screen.queryByTestId('notif-badge')).not.toBeInTheDocument();
  });

  it('menampilkan jumlah belum dibaca pada badge', () => {
    render(<NotifBell count={3} onClick={vi.fn()} />);
    expect(screen.getByTestId('notif-badge')).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Notifikasi (3 belum dibaca)' })).toBeInTheDocument();
  });

  it('badge dibatasi "9+" bila lebih dari 9 dan hilang saat sudah dibaca', () => {
    const { rerender } = render(<NotifBell count={12} onClick={vi.fn()} />);
    expect(screen.getByTestId('notif-badge')).toHaveTextContent('9+');
    // Setelah dibuka (count 0) badge hilang, lonceng tetap ada.
    rerender(<NotifBell count={0} onClick={vi.fn()} />);
    expect(screen.queryByTestId('notif-badge')).not.toBeInTheDocument();
    expect(screen.getByText('🔔')).toBeInTheDocument();
  });

  it('berdering hanya ketika jumlahnya BERTAMBAH (notif baru masuk)', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<NotifBell count={2} onClick={vi.fn()} />);
      const btn = () => screen.getByRole('button');
      expect(btn().className).not.toContain('tk-notif-bell--ring');

      // Turun (sebagian sudah dibaca) TIDAK memicu dering.
      act(() => rerender(<NotifBell count={1} onClick={vi.fn()} />));
      expect(btn().className).not.toContain('tk-notif-bell--ring');

      // Naik = ada notifikasi baru -> lonceng berdering.
      act(() => rerender(<NotifBell count={3} onClick={vi.fn()} />));
      expect(btn().className).toContain('tk-notif-bell--ring');

      // Dering berhenti sendiri setelah 1,5 detik.
      act(() => {
        vi.advanceTimersByTime(1600);
      });
      expect(btn().className).not.toContain('tk-notif-bell--ring');
    } finally {
      vi.useRealTimers();
    }
  });

  it('klik memanggil onClick (membuka menu sekaligus menandai dibaca)', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<NotifBell count={2} onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: /Notifikasi/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
