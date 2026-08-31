'use strict';

// backend/config/env.js
// Sumber tunggal untuk seluruh environment variable aplikasi.
// Referensi: File 1 Bagian 7.5 (daftar lengkap env vars).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 3000,

  // e.id Verifier API (diisi pada hari pelaksanaan)
  EID_BASE_URL:      process.env.EID_BASE_URL      || 'https://gateway.e.id',
  EID_CLIENT_ID:     process.env.EID_CLIENT_ID     || '',
  EID_CLIENT_SECRET: process.env.EID_CLIENT_SECRET || '',
  EID_VS_ID_WARGA:   process.env.EID_VS_ID_WARGA   || '',
  EID_VS_ID_OTORITAS: process.env.EID_VS_ID_OTORITAS || '',

  // Disqus SSO
  DISQUS_SHORTNAME:   process.env.DISQUS_SHORTNAME   || '',
  DISQUS_PUBLIC_KEY:  process.env.DISQUS_PUBLIC_KEY  || '',
  DISQUS_SECRET_KEY:  process.env.DISQUS_SECRET_KEY  || '',

  // Administrator
  ADMIN_INITIAL_USERNAME: process.env.ADMIN_INITIAL_USERNAME || '',
  ADMIN_INITIAL_PASSWORD: process.env.ADMIN_INITIAL_PASSWORD || '',
};
