'use strict';

// backend/services/eidClient.js
// Klien e.id Gateway - langkah pertama Authentication (File 2 Bagian 7.1
// langkah pertama; File 1 Bagian 8.3 & 8.4).
//
// Format request/response mengikuti dokumentasi resmi e.id Verifier API:
//   https://docs.e.id/en/verifier/v1/authentication/get-token
//   (juga Postman collection resmi: /files/postman/eid-verifier.postman_collection.json)
//
//   POST {EID_BASE_URL}/api/v1/auth/token
//     body: { "client_id": "...", "client_secret": "..." }
//     response: { token, token_type, refresh_token, refresh_expires, ttl }
//       - token      : access token (JWT)
//       - token_type : "Bearer"
//       - refresh_token : token untuk /api/v1/auth/refresh-token
//       - refresh_expires : timestamp kedaluwarsa refresh token
//       - ttl        : umur access token (dalam detik)
//
//   POST {EID_BASE_URL}/api/v1/auth/refresh-token
//     body: { "refresh_token": "..." }
//
// Access token disimpan SEMENTARA DI MEMORI (bukan database) bersama
// refresh token-nya. getAccessToken() adalah satu-satunya fungsi yang
// dipakai modul lain: ia menangani logika apakah memakai token yang
// masih tersimpan, me-refresh sebelum kedaluwarsa, atau meminta token
// baru. Permintaan bersamaan (concurrent) didedupe menjadi satu request.
//
// Belum ada endpoint lain (Document Schema, Verification Schema, dst) -
// itu langkah berikutnya.

const env = require('../config/env.js');

const AUTH_TOKEN_PATH = '/api/v1/auth/token';
const REFRESH_TOKEN_PATH = '/api/v1/auth/refresh-token';

// Margin aman (ms) sebelum kedaluwarsa: token dianggap sudah perlu
// diganti ketika sisa umurnya kurang dari margin ini, supaya tidak
// kedaluwarsa di tengah pemakaian.
const REFRESH_MARGIN_MS = 60 * 1000; // 1 menit

// Buat instance klien e.id. Parameter eksplisit (bukan baca env langsung)
// supaya unit test bisa menyuntikkan baseUrl/clientId/secret/fetch
// tiruan tanpa menyentuh environment global.
function createEidClient({ baseUrl, clientId, clientSecret, fetchImpl = fetch }) {
  // Cache di memori: null = belum pernah autentikasi.
  let cached = null;
  // Promise request yang sedang berjalan (dedupe permintaan bersamaan).
  let inflight = null;

  // ttl dari respons e.id berupa detik; terima juga milidetik bila nilai
  // sangat besar (heuristik aman terhadap dua satuan).
  function parseExpiresAt(ttl) {
    if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) return null;
    return Date.now() + (ttl > 1e11 ? ttl : ttl * 1000);
  }

  function parseAuthResponse(body) {
    // Respons ASLI e.id Gateway dibungkus envelope:
    //   { code: 200, message: "success", status: true, data: { token,
    //     token_type, refresh_token, refresh_expires, expire, ttl } }
    // (terverifikasi langsung ke API sungguhan; docs/Postman menampilkan
    // data tanpa envelope). Dukung dua-duanya: bila `body.data` memuat
    // `token`, pakai `body.data`; selain itu anggap body langsung data.
    const data =
      body && typeof body === 'object' && body.data && typeof body.data === 'object' && body.data.token
        ? body.data
        : body;
    if (!data || typeof data !== 'object' || !data.token) {
      throw new Error('e.id auth: respons tidak memuat access token (field "token")');
    }
    // Prioritas kedaluwarsa: field `expire` (ISO timestamp) dari respons
    // asli; fallback ke `ttl` (detik).
    let expiresAt = null;
    if (data.expire !== undefined && data.expire !== null) {
      const t = new Date(data.expire).getTime();
      if (Number.isFinite(t)) expiresAt = t;
    }
    if (expiresAt === null) expiresAt = parseExpiresAt(data.ttl);
    let refreshExpiresAt = null;
    if (data.refresh_expires !== undefined && data.refresh_expires !== null) {
      const t = new Date(data.refresh_expires).getTime();
      if (Number.isFinite(t)) refreshExpiresAt = t;
    }
    return {
      token: data.token,
      tokenType: data.token_type || 'Bearer',
      refreshToken: data.refresh_token || null,
      refreshExpiresAt,
      expiresAt,
    };
  }

  // Token dianggap masih valid jika sisa umurnya > REFRESH_MARGIN_MS.
  // Tanpa info TTL, token dianggap valid (tidak bisa dipastikan).
  function isUsable(entry) {
    if (!entry) return false;
    if (entry.expiresAt === null) return true;
    return entry.expiresAt - Date.now() > REFRESH_MARGIN_MS;
  }

  async function requestJson(path, payload) {
    const url = `${baseUrl}${path}`;
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new Error(`e.id auth: gagal terhubung ke ${url}: ${err.message}`);
    }
    if (!res.ok) {
      let detail = '';
      try {
        const data = await res.json();
        detail = data.message || data.error || JSON.stringify(data);
      } catch (_e) {
        // body bukan JSON; cukup status
      }
      throw new Error(`e.id auth: HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    let data;
    try {
      data = await res.json();
    } catch (_e) {
      throw new Error('e.id auth: respons bukan JSON');
    }
    return parseAuthResponse(data);
  }

  async function doAuth() {
    if (!clientId || !clientSecret) {
      throw new Error(
        'e.id auth: EID_CLIENT_ID dan EID_CLIENT_SECRET belum dikonfigurasi di .env'
      );
    }
    return requestJson(AUTH_TOKEN_PATH, {
      client_id: clientId,
      client_secret: clientSecret,
    });
  }

  async function doRefresh(refreshToken) {
    return requestJson(REFRESH_TOKEN_PATH, { refresh_token: refreshToken });
  }

  // Dapatkan token yang valid: (1) pakai cache bila masih sehat,
  // (2) refresh via refresh_token bila ada dan belum kedaluwarsa,
  // (3) fallback request token baru (mis. refresh gagal/tidak ada).
  async function obtainToken() {
    if (cached && cached.refreshToken) {
      const refreshExpired =
        cached.refreshExpiresAt !== null && Date.now() >= cached.refreshExpiresAt;
      if (!refreshExpired) {
        try {
          cached = await doRefresh(cached.refreshToken);
          return cached.token;
        } catch (_err) {
          // refresh gagal (mis. token sudah dicabut) -> coba token baru
        }
      }
    }
    cached = await doAuth();
    return cached.token;
  }

  async function getAccessToken() {
    if (isUsable(cached)) return cached.token;
    if (!inflight) {
      inflight = obtainToken().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  }

  // Untuk unit test: kosongkan cache (boleh dipakai antar kasus uji).
  function _reset() {
    cached = null;
    inflight = null;
  }

  return { getAccessToken, _reset };
}

// Singleton default: membaca konfigurasi dari env (config/env.js).
// EID_CLIENT_ID / EID_CLIENT_SECRET boleh kosong - getAccessToken akan
// melempar error yang jelas sampai kredensial diisi.
const defaultClient = createEidClient({
  baseUrl: env.EID_BASE_URL,
  clientId: env.EID_CLIENT_ID,
  clientSecret: env.EID_CLIENT_SECRET,
});

module.exports = defaultClient;
module.exports.createEidClient = createEidClient;
