'use strict';

// backend/middleware/rateLimiter.js
// Rate limiting untuk endpoint POST /api/reports tanpa verifikasi e.id.
// Sesuai File 1 Bagian 11.3: maks 10 laporan per jam per IP.

const rateLimit = require('express-rate-limit');

// Digunakan pada POST /api/reports ketika request tidak membawa
// session_id yang sudah terverifikasi (diterapkan tanpa kondisi
// pada tahap ini sesuai File 2 Bagian 6.3 — verifikasi e.id belum
// diintegrasikan di tahap ini, sehingga seluruh POST dianggap tanpa
// verifikasi dan rate limit berlaku untuk semua).
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 10,                   // maks 10 request per window per IP
  standardHeaders: true,     // kirim header RateLimit-* sesuai RFC 6585
  legacyHeaders: false,
  message: {
    error: 'Terlalu banyak laporan dikirim dari IP ini. Coba lagi dalam 1 jam.',
  },
});

module.exports = { reportLimiter };
