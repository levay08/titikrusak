'use strict';

// backend/routes/track.js
// POST /api/track - event minat dari frontend (tanpa isi teks, privasi):
//   { e: 'detail_open' | 'report_form_open' | 'contact_open' |
//        'contact_typed' | 'contact_wa_click' }
// Dicatat ke hitLogger seperti hit biasa (sesi idle + batas harian per IP).

const express = require('express');
const rateLimit = require('express-rate-limit');
const { recordEvent } = require('../lib/hitLogger.js');

const router = express.Router();

const EVENT_TYPES = new Set([
  'detail_open',
  'report_form_open',
  'contact_open',
  'contact_typed',
  'contact_wa_click',
]);

// Antisipasi spam beacon: 120/menit/IP jauh di atas pemakaian manusia.
const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak event dari IP ini' },
});

router.post('/', trackLimiter, (req, res) => {
  const ev = req.body && typeof req.body.e === 'string' ? req.body.e : null;
  if (!ev || !EVENT_TYPES.has(ev)) {
    return res.status(400).json({ error: 'Jenis event tidak dikenal' });
  }
  const fwd = req.headers['x-forwarded-for'];
  const ip = (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') || req.socket?.remoteAddress || '';
  recordEvent({ ip, ev, ua: req.headers['user-agent'] });
  res.status(204).end();
});

module.exports = router;
