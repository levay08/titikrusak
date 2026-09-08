// frontend/src/lib/useKeyboardNav.test.jsx
// Tes unit hook navigasi keyboard: ArrowLeft = kembali, ArrowRight =
// laporan berikutnya (urutan dataset), Spasi = aksi tombol Lapor - dan
// KETIGANYA hanya aktif di luar kolom teks, tanpa kombinasi Ctrl/Alt/Meta.

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import useKeyboardNav from './useKeyboardNav.js';

// Komponen uji tipis: hanya memasang hook dengan props yang dikendalikan tes.
function Harness(props) {
  useKeyboardNav(props);
  return null;
}

const DATA = [{ id: 1, location_name: 'A' }, { id: 2, location_name: 'B' }, { id: 3, location_name: 'C' }];

// Tekan tombol pada document.body (posisi fokus default halaman utama).
const press = (key, extra = {}) =>
  fireEvent.keyDown(document.body, { key, code: `Key${key === ' ' ? 'Space' : key}`, ...extra });

describe('useKeyboardNav', () => {
  it('ArrowRight membuka laporan berikutnya sesuai urutan dataset; berhenti di laporan terakhir', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const onSpace = vi.fn();
    const { rerender } = render(
      <Harness
        detailOpen
        currentId={1}
        dataset={DATA}
        onSelect={onSelect}
        onBack={onBack}
        onSpace={onSpace}
        spaceEnabled
      />
    );

    press('ArrowRight');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(DATA[1]); // laporan ke-2

    // Pindah ke laporan terakhir (id 3) -> tekan lagi: tidak ada berikutnya.
    onSelect.mockClear();
    rerender(
      <Harness
        detailOpen
        currentId={3}
        dataset={DATA}
        onSelect={onSelect}
        onBack={onBack}
        onSpace={onSpace}
        spaceEnabled
      />
    );
    press('ArrowRight');
    expect(onSelect).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('ArrowRight tidak bereaksi bila id terbuka tidak ada di dataset (detail dari sumber lain)', () => {
    const onSelect = vi.fn();
    render(<Harness detailOpen currentId={99} dataset={DATA} onSelect={onSelect} />);
    press('ArrowRight');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('ArrowLeft menutup detail (kembali); tanpa detail terbuka tidak bereaksi', () => {
    const onBack = vi.fn();
    const onSelect = vi.fn();
    // Detail tertutup: panah kiri = no-op (mis. biarkan perilaku default).
    const { rerender } = render(
      <Harness detailOpen={false} currentId={1} dataset={DATA} onSelect={onSelect} onBack={onBack} />
    );
    press('ArrowLeft');
    expect(onBack).not.toHaveBeenCalled();

    // Detail terbuka: panah kiri = tutup/kembali.
    rerender(<Harness detailOpen currentId={1} dataset={DATA} onSelect={onSelect} onBack={onBack} />);
    press('ArrowLeft');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Spasi memanggil aksi Lapor HANYA bila spaceEnabled', () => {
    const onSpace = vi.fn();
    const { rerender } = render(<Harness spaceEnabled={false} onSpace={onSpace} />);
    press(' ');
    expect(onSpace).not.toHaveBeenCalled();

    rerender(<Harness spaceEnabled onSpace={onSpace} />);
    press(' ');
    expect(onSpace).toHaveBeenCalledTimes(1);

    // Spasi ditahan (auto-repeat): cukup satu kali panggilan.
    onSpace.mockClear();
    press(' ', { repeat: true });
    expect(onSpace).not.toHaveBeenCalled();
  });

  it('ketiga tombol diabaikan saat fokus di kolom teks (input & textarea)', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const onSpace = vi.fn();
    render(
      <Harness
        detailOpen
        currentId={1}
        dataset={DATA}
        onSelect={onSelect}
        onBack={onBack}
        onSpace={onSpace}
        spaceEnabled
      />
    );

    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    document.body.appendChild(input);
    document.body.appendChild(textarea);

    input.focus();
    fireEvent.keyDown(input, { key: ' ', code: 'Space' });
    fireEvent.keyDown(input, { key: 'ArrowRight', code: 'ArrowRight' });
    fireEvent.keyDown(input, { key: 'ArrowLeft', code: 'ArrowLeft' });
    expect(onSpace).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();

    textarea.focus();
    fireEvent.keyDown(textarea, { key: ' ', code: 'Space' });
    fireEvent.keyDown(textarea, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(onSpace).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();

    input.remove();
    textarea.remove();
  });

  it('kombinasi Ctrl/Alt/Meta tidak diganggu (shortcut browser/OS)', () => {
    const onSelect = vi.fn();
    const onBack = vi.fn();
    const onSpace = vi.fn();
    render(
      <Harness
        detailOpen
        currentId={1}
        dataset={DATA}
        onSelect={onSelect}
        onBack={onBack}
        onSpace={onSpace}
        spaceEnabled
      />
    );
    press('ArrowRight', { ctrlKey: true });
    press('ArrowLeft', { metaKey: true });
    press(' ', { altKey: true });
    expect(onSelect).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
    expect(onSpace).not.toHaveBeenCalled();
  });

  it('listener dilepas saat komponen unmount (tidak bocor antar halaman)', () => {
    const onBack = vi.fn();
    const { unmount } = render(<Harness detailOpen onBack={onBack} />);
    unmount();
    press('ArrowLeft');
    expect(onBack).not.toHaveBeenCalled();
  });
});
