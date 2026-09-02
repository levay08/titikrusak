// frontend/src/App.query.test.jsx
// Unit test query GET /api/reports hasil buildQuery — termasuk filter
// Verifikasi Titik (sudah diverifikasi = status terverifikasi /
// dalam_perbaikan / selesai_diperbaiki; belum = dilaporkan).

import { describe, it, expect } from 'vitest';
import { buildQuery } from './App.jsx';

const base = {
  severity: [],
  infra_type: [],
  bridge_authority: [],
  vital_status: [],
  q: '',
  sort: 'terbaru',
};

describe('buildQuery: filter Verifikasi Titik', () => {
  it('verified=semua (default): tanpa param status (semua titik tampil)', () => {
    const qs = buildQuery({ ...base, verified: 'semua' });
    expect(qs).not.toContain('status=');
    expect(qs).not.toContain('verified');
  });

  it('verified=verified: status terverifikasi + dalam_perbaikan + selesai_diperbaiki', () => {
    const qs = buildQuery({ ...base, verified: 'verified' });
    expect(qs).toContain('status=terverifikasi');
    expect(qs).toContain('status=dalam_perbaikan');
    expect(qs).toContain('status=selesai_diperbaiki');
    // Tidak menyertakan dilaporkan.
    expect(qs).not.toContain('status=dilaporkan');
  });

  it('verified=belum: hanya status dilaporkan', () => {
    const qs = buildQuery({ ...base, verified: 'belum' });
    expect(qs).toContain('status=dilaporkan');
    expect(qs).not.toContain('status=terverifikasi');
  });

  it('filter lain tetap jalan bersamaan dengan verified', () => {
    const qs = buildQuery({
      ...base,
      verified: 'verified',
      severity: ['berat', 'ambruk'],
      q: 'jembatan',
    });
    expect(qs).toContain('severity=berat');
    expect(qs).toContain('severity=ambruk');
    expect(qs).toContain('q=jembatan');
    expect(qs).toContain('status=terverifikasi');
  });
});
