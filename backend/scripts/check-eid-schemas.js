'use strict';

// backend/scripts/check-eid-schemas.js
// Verifikasi manual (File 2 Bagian 7.1 langkah kedua): panggil endpoint
// Document Schema List pada e.id Gateway memakai access token dari
// eidClient.getAccessToken().
//
// Path persis (dari docs.e.id + Postman collection resmi):
//   GET {EID_BASE_URL}/api/v1/verifier/document-schema
// Envelope respons sama seperti Authentication: { code, message, status,
// data: { items: [...] } }; tiap item memuat `id` (UUID) = schema_id,
// schema_name, schema_title, version, category, mandatory_kyc_file.
//
// BUKAN bagian alur runtime aplikasi — dijalankan sekali sebagai langkah
// verifikasi (File 2 Bagian 7.1). Akses token TIDAK pernah dicetak.

const env = require('../config/env.js');
const eidClient = require('../services/eidClient.js');

const LIST_PATH = '/api/v1/verifier/document-schema';

(async () => {
  const token = await eidClient.getAccessToken();
  const url = `${env.EID_BASE_URL}${LIST_PATH}?per_page=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const d = await res.json();
      detail = d.message || d.error || JSON.stringify(d);
    } catch (_e) {
      // body bukan JSON
    }
    throw new Error(`Document Schema List: HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  const body = await res.json();
  // Envelope sama seperti Authentication; tangani juga bila data berupa
  // array langsung (defensif).
  const data = body && body.data ? body.data : body;
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];

  console.log(`envelope: code=${body.code} message=${JSON.stringify(body.message)} status=${body.status}`);
  console.log(`jumlah skema dalam respons: ${items.length}`);
  console.log('');

  items.forEach((s, i) => {
    console.log(`${i + 1}. schema_name : ${s.schema_name}`);
    console.log(`   schema_title: ${s.schema_title}`);
    console.log(`   schema_id   : ${s.id}`);
    console.log(`   version=${s.version} | category=${s.category} | mandatory_kyc_file=${s.mandatory_kyc_file} | issuer=${s.issuer_name || s.issuer_id || '-'}`);
    if (s.description) console.log(`   deskripsi   : ${String(s.description).slice(0, 180)}`);
    console.log('');
  });
})().catch((err) => {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
});
