'use strict';

// backend/routes/contact.js
// POST /api/contact — form Kontak footer. Mengirim pesan ke email tujuan
// (default hello@arfhacorp.com, bisa diganti via env CONTACT_EMAIL).
//
// Pengiriman via relay FormSubmit.co (AJAX) — tanpa kredensial SMTP; cukup
// sekali aktivasi: pemilik inbox tujuan menerima email aktivasi dari
// FormSubmit lalu mengonfirmasi (email berikutnya terkirim normal).
// Opsi lain: set env CONTACT_SMTP_URL (contoh smtp://user:pass@host:587)
// dan backend beralih mengirim lewat SMTP tsb.

const express = require('express');
const env = require('../config/env.js');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tujuan pesan kontak (boleh di-override lewat .env).
const CONTACT_TO = env.CONTACT_EMAIL || 'hello@arfhacorp.com';

async function sendViaRelay(payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CONTACT_TO)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// POST /api/contact {name, email, message}
router.post('/', async (req, res) => {
  const { name = '', email = '', message = '' } = req.body || {};
  const errors = [];
  if (String(name).trim().length < 2) errors.push('Nama wajib diisi (min. 2 karakter).');
  if (!EMAIL_RE.test(String(email).trim())) errors.push('Alamat email tidak valid.');
  if (String(message).trim().length < 10) errors.push('Pesan wajib diisi (min. 10 karakter).');
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    const result = await sendViaRelay({
      name: String(name).trim(),
      email: String(email).trim(),
      message: String(message).trim(),
      _subject: `[titikrusak.id] Pesan kontak dari ${String(name).trim()}`,
      _captcha: 'false',
    });
    console.log(`contact: pesan dari ${String(email).trim()} diteruskan ke ${CONTACT_TO} (${JSON.stringify(result).slice(0, 120)})`);
    res.json({ ok: true, message: `Pesan terkirim ke ${CONTACT_TO}.` });
  } catch (err) {
    console.error(`contact: gagal meneruskan pesan ke ${CONTACT_TO}: ${err.message}`);
    res.status(502).json({ error: `Gagal mengirim pesan (${err.message}). Coba lagi beberapa saat lagi.` });
  }
});

module.exports = router;
