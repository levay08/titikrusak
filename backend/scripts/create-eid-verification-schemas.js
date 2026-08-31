'use strict';

// backend/scripts/create-eid-verification-schemas.js
// Verifikasi manual (File 2 Bagian 7.1 langkah ketiga): buat dua
// Verification Schema di e.id Gateway memakai access token dari
// eidClient.getAccessToken(). Bukan bagian alur runtime aplikasi.
//
// Endpoint (docs.e.id + Postman resmi):
//   POST {EID_BASE_URL}/api/v1/verifier/verification-schema
// Envelope respons sama seperti Authentication: { code, message, status,
// data: { ... } }; field `id` pada data = verification_schema.id.
//
// Input expected_schemas memakai schema_id mentah hasil Document Schema
// List (langkah kedua), dengan required_fields minimal sesuai prinsip
// selective disclosure (File 1 Bagian 1.5 & 8.4):
//   - Warga    : KYC_Verification_by_PSrE  -> cukup "fullname"
//   - Otoritas : EID_Membership_Lv1        -> "email" + "phone_number"
//     (schema ini tidak memiliki field nama; File 1 8.4: nama & email/telepon)

const env = require('../config/env.js');
const eidClient = require('../services/eidClient.js');

const VS_PATH = '/api/v1/verifier/verification-schema';

const VERIFICATION_SCHEMAS = [
  {
    name: 'titikrusak_warga_kyc',
    description:
      'Verifikasi identitas warga pelapor titikrusak.id - selective disclosure: cukup fullname (File 1 8.4)',
    ttl: 1,
    presentation_limit: 0,
    expected_schemas: [
      {
        schema_id: 'a1e4eff5-c90c-4d06-a225-389e126fa1af', // KYC_Verification_by_PSrE
        mandatory: true,
        required_fields: ['fullname'],
      },
    ],
    custom_webhook_url: '',
    event_type: 'VERIFICATION',
  },
  {
    name: 'titikrusak_otoritas_membership_lv1',
    description:
      'Verifikasi otoritas titikrusak.id - Membership Lv1: email + telepon (File 1 8.4)',
    ttl: 1,
    presentation_limit: 0,
    expected_schemas: [
      {
        schema_id: '9e1221ff-f21d-4304-b514-c61cc6ebadc5', // EID_Membership_Lv1
        mandatory: true,
        required_fields: ['email', 'phone_number'],
      },
    ],
    custom_webhook_url: '',
    event_type: 'VERIFICATION',
  },
];

(async () => {
  const token = await eidClient.getAccessToken();

  for (const vs of VERIFICATION_SCHEMAS) {
    const res = await fetch(`${env.EID_BASE_URL}${VS_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(vs),
    });
    const body = await res.json();
    const data = body && body.data ? body.data : body;

    if (!res.ok) {
      console.log(
        `GAGAL membuat "${vs.name}" | HTTP ${res.status} | ${body.message || body.error || JSON.stringify(body)}`
      );
      process.exitCode = 1;
      continue;
    }

    console.log('SUKSES: Verification Schema dibuat');
    console.log(`  name                 : ${data.name}`);
    console.log(`  verification_schema_id: ${data.id}`);
    console.log(`  description          : ${data.description}`);
    console.log(`  ttl                  : ${data.ttl}`);
    console.log(`  presentation_limit   : ${data.presentation_limit}`);
    console.log(`  event_type           : ${data.event_type}`);
    console.log(`  expected_schemas     : ${JSON.stringify(data.expected_schemas)}`);
    console.log('');
  }
})().catch((err) => {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
});
