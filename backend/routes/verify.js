'use strict';

// backend/routes/verify.js
// Endpoint verifikasi e.id (File 2 Bagian 7.1 langkah keempat-kelima-keenam;
// File 1 Bagian 6.5 & 7.4). Tanpa autentikasi tambahan — session_id
// sendiri yang menjadi kunci akses (File 1 Bagian 7.4).
//
//   POST /api/verify/start          -> buat VP Request di e.id Gateway,
//                                      simpan session, kembalikan qr_data
//                                      + session_id ke frontend.
//   GET  /api/verify/status/:id     -> proxy status sesi dari e.id,
//                                      update status di verification_sessions.
//   GET  /api/verify/result/:id     -> HANYA setelah approved: ambil
//                                      holder_did + nama holder, simpan di
//                                      tabel. holder_did tidak pernah
//                                      bocor ke endpoint publik lain
//                                      (File 1 Bagian 7.4 & 10.1).
//
// Endpoint e.id Gateway (docs.e.id + Postman resmi, envelope respons sama
// seperti Authentication: { code, message, status, data }):
//   POST {EID_BASE_URL}/api/v1/verifier/presentation/request
//        body { verifier_doc_schema_id, expires_in }   (verifier_doc_schema_id
//        = verification_schema.id hasil langkah ketiga = EID_VS_ID_*)
//        data { session_id, qr_data { challenge, qr_token, schema_id }, ... }
//   GET  {EID_BASE_URL}/api/v1/verifier/presentation/simple/:id
//        data { status, ... }
//   GET  {EID_BASE_URL}/api/v1/verifier/presentation/result/:id
//        data { holder_did, presentation.credentialSubject { ... }, ... }

const express = require('express');
const db = require('../db/db.js');
const env = require('../config/env.js');
const eidClient = require('../services/eidClient.js');

const router = express.Router();

const VP_REQUEST_PATH = '/api/v1/verifier/presentation/request';
const VP_SIMPLE_PATH = '/api/v1/verifier/presentation/simple/';
const VP_RESULT_PATH = '/api/v1/verifier/presentation/result/';

// Verification schema id per role (diisi dari env, hasil langkah ketiga).
const ROLE_TO_VS_ID = {
  warga: env.EID_VS_ID_WARGA,
  otoritas: env.EID_VS_ID_OTORITAS,
};

const ENV_KEY_BY_ROLE = { warga: 'EID_VS_ID_WARGA', otoritas: 'EID_VS_ID_OTORITAS' };

// Status yang dikenal (File 1 Bagian 6.5).
const KNOWN_STATUSES = ['pending', 'approved', 'expired', 'rejected'];

function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase();
  return KNOWN_STATUSES.includes(s) ? s : 'pending';
}

// GET ke e.id Gateway dengan Bearer token; membuka envelope respons.
async function eidGet(path) {
  const token = await eidClient.getAccessToken();
  const res = await fetch(`${env.EID_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseEidResponse(res);
}

// POST ke e.id Gateway dengan Bearer token; membuka envelope respons.
async function eidPost(path, payload) {
  const token = await eidClient.getAccessToken();
  const res = await fetch(`${env.EID_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  return parseEidResponse(res);
}

async function parseEidResponse(res) {
  let body = {};
  try {
    body = await res.json();
  } catch (_e) {
    // body bukan JSON
  }
  if (!res.ok) {
    throw new Error(`e.id: HTTP ${res.status}${body.message ? `: ${body.message}` : ''}`);
  }
  if (body && body.status === false) {
    throw new Error(`e.id: ${body.message || 'status=false'}`);
  }
  if (body && body.data !== undefined) return body.data;
  return body;
}

// ---- POST /api/verify/start ----
router.post('/start', async (req, res) => {
  const role = req.body && req.body.role;
  if (role !== 'warga' && role !== 'otoritas') {
    return res.status(400).json({ error: 'role harus "warga" atau "otoritas"' });
  }
  const vsId = ROLE_TO_VS_ID[role];
  if (!vsId) {
    return res.status(500).json({
      error: `${ENV_KEY_BY_ROLE[role]} belum dikonfigurasi di .env`,
    });
  }

  try {
    const data = await eidPost(VP_REQUEST_PATH, {
      verifier_doc_schema_id: vsId,
      expires_in: 15, // menit, sesuai contoh Postman
    });
    const sessionId = data.session_id;
    const qrData = data.qr_data;
    if (!sessionId || !qrData || !qrData.qr_token) {
      return res.status(502).json({
        error: 'Respons e.id tidak memuat session_id/qr_data',
      });
    }

    db.prepare(
      `INSERT INTO verification_sessions (session_id, schema_type, status, expires_at)
       VALUES (?, ?, 'pending', ?)`
    ).run(sessionId, role, data.expires_at || null);

    res.status(201).json({
      qr_data: qrData,
      session_id: sessionId,
      // URL wallet e.id yang dibuka holder (mengandung challenge + qr_token)
      // — value QR yang tepat untuk discan (docs create-vp).
      eid_oauth_url: data.eid_oauth_url || null,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ---- GET /api/verify/status/:session_id ----
router.get('/status/:session_id', async (req, res) => {
  const sessionId = req.params.session_id;
  const row = db
    .prepare('SELECT id, status FROM verification_sessions WHERE session_id = ?')
    .get(sessionId);
  if (!row) {
    return res.status(404).json({ error: 'Sesi verifikasi tidak ditemukan' });
  }

  try {
    const data = await eidGet(VP_SIMPLE_PATH + encodeURIComponent(sessionId));
    const status = normalizeStatus(data.status);
    db.prepare('UPDATE verification_sessions SET status = ? WHERE session_id = ?').run(
      status,
      sessionId
    );
    res.json({ status });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ---- GET /api/verify/result/:session_id ----
router.get('/result/:session_id', async (req, res) => {
  const sessionId = req.params.session_id;
  const row = db
    .prepare('SELECT id, schema_type FROM verification_sessions WHERE session_id = ?')
    .get(sessionId);
  if (!row) {
    return res.status(404).json({ error: 'Sesi verifikasi tidak ditemukan' });
  }

  try {
    const data = await eidGet(VP_RESULT_PATH + encodeURIComponent(sessionId));
    const holderDid = data.holder_did;
    if (!holderDid) {
      return res.status(502).json({
        error: 'Respons e.id tidak memuat holder_did (pastikan sesi sudah approved)',
      });
    }
    let subject =
      data.presentation && data.presentation.credentialSubject
        ? data.presentation.credentialSubject
        : {};
    // Beberapa versi envelope menaruh credentialSubject di dalam
    // verifiableCredential[0] — cek juga struktur itu.
    if (!subject || typeof subject !== 'object' || Object.keys(subject).length === 0) {
      const vc = data.presentation && data.presentation.verifiableCredential;
      const cs = Array.isArray(vc) && vc[0] ? vc[0].credentialSubject : null;
      if (cs && typeof cs === 'object') subject = cs;
    }
    // Nama holder sesuai skema (File 1/File 2, koreksi alur): OTORITAS memakai
    // skema KYC e-KTP (identitas KTP: fullname), WARGA memakai Member level 1
    // (email, nama, alamat, nomor telepon — tanpa KTP). Field nama dicari dari
    // beberapa varian nama kolom yang umum di skema KYC e.id.
    let holderName = null;
    if (row.schema_type === 'otoritas') {
      holderName =
        subject.fullname ||
        subject.full_name ||
        subject.name ||
        subject.nama ||
        subject.given_name ||
        subject.givenName ||
        (subject.names && subject.names[0]) ||
        null;
    } else {
      holderName = subject.email || subject.phone_number || subject.name || null;
    }

    db.prepare(
      `UPDATE verification_sessions
       SET holder_did = ?, holder_name = ?, status = 'approved'
       WHERE session_id = ?`
    ).run(holderDid, holderName, sessionId);

    res.json({ holder_did: holderDid, holder_name: holderName });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
