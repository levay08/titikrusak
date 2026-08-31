'use strict';

// backend/test/eidClient.test.js
// Unit test logika penyimpanan & refresh access token e.id Gateway.
// Memakai fetch TIRUAN (mock) — tidak memanggil API asli, karena
// EID_CLIENT_ID / EID_CLIENT_SECRET belum tersedia di lingkungan ini.
//
// Format request/response mock mengikuti dokumentasi resmi:
//   POST {base}/api/v1/auth/token           body {client_id, client_secret}
//   POST {base}/api/v1/auth/refresh-token   body {refresh_token}
//   response: { token, token_type, refresh_token, refresh_expires, ttl }

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEidClient } = require('../services/eidClient.js');

const BASE = 'https://gateway.e.id';

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// Mock fetch dengan daftar route: { url, body?, response() }.
// `body` boleh objek (deepEqual) atau fungsi predikat terhadap payload.
function makeFetchMock(routes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    for (const route of routes) {
      if (route.url !== url) continue;
      if (route.body) {
        const sent = JSON.parse(init.body);
        const ok =
          typeof route.body === 'function'
            ? route.body(sent)
            : JSON.stringify(sent) === JSON.stringify(route.body);
        if (!ok) continue;
      }
      return route.response();
    }
    throw new Error(`unexpected fetch: ${url} body=${init ? init.body : ''}`);
  };
  fn.calls = calls;
  return fn;
}

const defaultOpts = { baseUrl: BASE, clientId: 'cid-123', clientSecret: 'csec-456' };

test('memperoleh access token lewat POST /api/v1/auth/token dengan body client_id + client_secret', async () => {
  const fetchMock = makeFetchMock([
    {
      url: `${BASE}/api/v1/auth/token`,
      body: { client_id: 'cid-123', client_secret: 'csec-456' },
      response: () =>
        jsonResponse(200, {
          token: 'tok-1',
          token_type: 'Bearer',
          ttl: 3600,
          refresh_token: 'rt-1',
          refresh_expires: '2030-01-01T00:00:00Z',
        }),
    },
  ]);
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  const token = await client.getAccessToken();

  assert.equal(token, 'tok-1');
  assert.equal(fetchMock.calls.length, 1);
  assert.equal(fetchMock.calls[0].url, `${BASE}/api/v1/auth/token`);
  assert.equal(fetchMock.calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(fetchMock.calls[0].init.body), {
    client_id: 'cid-123',
    client_secret: 'csec-456',
  });
});

test('token tersimpan dipakai ulang tanpa request baru (cache di memori)', async () => {
  const fetchMock = makeFetchMock([
    {
      url: `${BASE}/api/v1/auth/token`,
      response: () => jsonResponse(200, { token: 'tok-1', ttl: 3600 }),
    },
  ]);
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  await client.getAccessToken();
  await client.getAccessToken();
  await client.getAccessToken();

  assert.equal(fetchMock.calls.length, 1, 'hanya satu request autentikasi');
});

test('token hampir kedaluwarsa -> refresh otomatis via POST /api/v1/auth/refresh-token', async () => {
  const fetchMock = makeFetchMock([
    {
      url: `${BASE}/api/v1/auth/token`,
      response: () => jsonResponse(200, { token: 'tok-1', ttl: 30, refresh_token: 'rt-1' }),
    },
    {
      url: `${BASE}/api/v1/auth/refresh-token`,
      body: { refresh_token: 'rt-1' },
      response: () => jsonResponse(200, { token: 'tok-2', ttl: 3600, refresh_token: 'rt-2' }),
    },
  ]);
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  // ttl 30 detik < margin aman 60 detik -> panggilan kedua harus refresh.
  assert.equal(await client.getAccessToken(), 'tok-1');
  assert.equal(await client.getAccessToken(), 'tok-2');

  assert.deepEqual(
    fetchMock.calls.map((c) => c.url),
    [`${BASE}/api/v1/auth/token`, `${BASE}/api/v1/auth/refresh-token`]
  );
  assert.deepEqual(JSON.parse(fetchMock.calls[1].init.body), { refresh_token: 'rt-1' });
});

test('tanpa refresh_token -> token kedaluwarsa memicu request token baru', async () => {
  let n = 0;
  const fetchMock = async () => {
    n += 1;
    return jsonResponse(200, { token: `tok-${n}`, ttl: 30 }); // ttl < margin
  };
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  assert.equal(await client.getAccessToken(), 'tok-1');
  assert.equal(await client.getAccessToken(), 'tok-2');
  assert.equal(n, 2);
});

test('refresh token kedaluwarsa/gagal -> fallback ke request token baru', async () => {
  let n = 0;
  const fetchMock = async (url) => {
    n += 1;
    if (n === 1) return jsonResponse(200, { token: 'tok-1', ttl: 30, refresh_token: 'rt-1' });
    if (n === 2) return jsonResponse(401, { message: 'refresh token invalid' });
    return jsonResponse(200, { token: 'tok-3', ttl: 3600 });
  };
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  assert.equal(await client.getAccessToken(), 'tok-1');
  assert.equal(await client.getAccessToken(), 'tok-3');
  assert.equal(n, 3, 'refresh gagal lalu token baru');
});

test('permintaan bersamaan didedupe menjadi satu request autentikasi', async () => {
  let fetchCount = 0;
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const fetchMock = async () => {
    fetchCount += 1;
    await gate;
    return jsonResponse(200, { token: 'tok-1', ttl: 3600 });
  };
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  const p1 = client.getAccessToken();
  const p2 = client.getAccessToken();
  release();
  const [a, b] = await Promise.all([p1, p2]);

  assert.equal(a, 'tok-1');
  assert.equal(b, 'tok-1');
  assert.equal(fetchCount, 1, 'satu request untuk dua pemanggil bersamaan');
});

test('client_id/client_secret kosong -> error jelas tanpa memanggil fetch', async () => {
  const fetchMock = async () => {
    throw new Error('fetch tidak boleh dipanggil');
  };
  const client = createEidClient({
    baseUrl: BASE,
    clientId: '',
    clientSecret: '',
    fetchImpl: fetchMock,
  });

  await assert.rejects(client.getAccessToken(), /EID_CLIENT_ID dan EID_CLIENT_SECRET belum dikonfigurasi/);
});

test('HTTP error dari e.id -> error memuat status dan detail', async () => {
  const fetchMock = makeFetchMock([
    {
      url: `${BASE}/api/v1/auth/token`,
      response: () => jsonResponse(401, { message: 'invalid client credentials' }),
    },
  ]);
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  await assert.rejects(client.getAccessToken(), /HTTP 401: invalid client credentials/);
});

test('respons tanpa field token -> error', async () => {
  const fetchMock = makeFetchMock([
    {
      url: `${BASE}/api/v1/auth/token`,
      response: () => jsonResponse(200, { foo: 'bar' }),
    },
  ]);
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  await assert.rejects(client.getAccessToken(), /tidak memuat access token/);
});

test('network error -> error dengan konteks URL', async () => {
  const fetchMock = async () => {
    throw new TypeError('fetch failed');
  };
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  await assert.rejects(
    client.getAccessToken(),
    /gagal terhubung ke https:\/\/gateway\.e\.id\/api\/v1\/auth\/token/
  );
});

test('ttl berupa milidetik juga dikenali sebagai kedaluwarsa di masa depan', async () => {
  const fetchMock = makeFetchMock([
    {
      url: `${BASE}/api/v1/auth/token`,
      response: () => jsonResponse(200, { token: 'tok-1', ttl: 3600 * 1000 }),
    },
  ]);
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  await client.getAccessToken();
  await client.getAccessToken();
  assert.equal(fetchMock.calls.length, 1, 'ttl ms (3600 detik) masih dianggap valid');
});

test('format respons ASLI e.id (envelope code/message/status/data + expire ISO) dikenali', async () => {
  const fetchMock = makeFetchMock([
    {
      url: `${BASE}/api/v1/auth/token`,
      response: () =>
        jsonResponse(200, {
          code: 200,
          message: 'success',
          status: true,
          data: {
            token: 'tok-env',
            token_type: 'Bearer',
            ttl: 3600,
            expire: new Date(Date.now() + 3600 * 1000).toISOString(),
            refresh_token: 'rt-env',
            refresh_expires: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
          },
        }),
    },
  ]);
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  assert.equal(await client.getAccessToken(), 'tok-env');
  await client.getAccessToken();
  assert.equal(fetchMock.calls.length, 1, 'expire ISO di masa depan -> token dianggap valid');
});

test('expire sudah lewat -> refresh otomatis via refresh-token', async () => {
  const fetchMock = makeFetchMock([
    {
      url: `${BASE}/api/v1/auth/token`,
      response: () =>
        jsonResponse(200, {
          data: {
            token: 'tok-1',
            expire: new Date(Date.now() - 1000).toISOString(),
            refresh_token: 'rt-1',
          },
        }),
    },
    {
      url: `${BASE}/api/v1/auth/refresh-token`,
      body: { refresh_token: 'rt-1' },
      response: () =>
        jsonResponse(200, {
          data: { token: 'tok-2', expire: new Date(Date.now() + 3600 * 1000).toISOString() },
        }),
    },
  ]);
  const client = createEidClient({ ...defaultOpts, fetchImpl: fetchMock });

  assert.equal(await client.getAccessToken(), 'tok-1');
  assert.equal(await client.getAccessToken(), 'tok-2');
  assert.deepEqual(
    fetchMock.calls.map((c) => c.url),
    [`${BASE}/api/v1/auth/token`, `${BASE}/api/v1/auth/refresh-token`]
  );
});
