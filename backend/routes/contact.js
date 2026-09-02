'use strict';

// backend/routes/contact.js
// POST /api/contact — form Kontak footer. Mengirim pesan ke email tujuan
// (default hello@arfhacorp.com, bisa diganti via env CONTACT_EMAIL).
//
// Jalur pengiriman (urutan prioritas):
//   1. SMTP LANGSUNG ke server email penerima (nodemailer) — tanpa
//      kredensial cukup untuk inbound: kirim ke MX domain tujuan di
//      port 25. Konfigurasi via env (default mengarah ke MX arfhacorp.com
//      yang port 25-nya terbuka & menerima).
//        CONTACT_SMTP_HOST (default 'arfhacorp.com')
//        CONTACT_SMTP_PORT (default 25)
//        CONTACT_SMTP_USER / CONTACT_SMTP_PASS (opsional, utk 587)
//   2. Fallback: relay FormSubmit.co AJAX bila SMTP gagal.

const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tujuan pesan kontak.
const CONTACT_TO = process.env.CONTACT_EMAIL || 'hello@arfhacorp.com';
// Pengirim (domain titikrusak.id — sesuaikan SPF/DKIM bila domain punya MX).
const CONTACT_FROM = process.env.CONTACT_FROM || 'noreply@titikrusak.id';

const smtpCfg = {
  host: process.env.CONTACT_SMTP_HOST || 'arfhacorp.com',
  port: Number(process.env.CONTACT_SMTP_PORT || 25),
  secure: false, // port 25/587 biasa pakai STARTTLS, bukan TLS langsung
  ignoreTLS: true, // inbound tanpa kredensial: banyak server tidak minta TLS
  ...(process.env.CONTACT_SMTP_USER
    ? { auth: { user: process.env.CONTACT_SMTP_USER, pass: process.env.CONTACT_SMTP_PASS || '' } }
    : {}),
};

async function sendViaSmtp(payload) {
  const transporter = nodemailer.createTransport(smtpCfg);
  const info = await transporter.sendMail({
    from: `"titikrusak.id" <${CONTACT_FROM}>`,
    to: CONTACT_TO,
    subject: payload._subject,
    text: `Nama: ${payload.name}\nEmail pengirim: ${payload.email}\n\n${payload.message}`,
  });
  return { smtpId: info.messageId || info.response || 'OK' };
}

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

  const payload = {
    name: String(name).trim(),
    email: String(email).trim(),
    message: String(message).trim(),
    _subject: `[titikrusak.id] Pesan kontak dari ${String(name).trim()}`,
    _captcha: 'false',
  };

  // 1) Coba SMTP langsung ke server email penerima.
  try {
    const result = await sendViaSmtp(payload);
    console.log(`contact: pesan dari ${payload.email} terkirim via SMTP -> ${CONTACT_TO} (${JSON.stringify(result).slice(0, 160)})`);
    return res.json({ ok: true, message: `Pesan terkirim ke ${CONTACT_TO}.` });
  } catch (err) {
    console.error(`contact: SMTP gagal (${err.message}) — coba relay FormSubmit`);
  }

  // 2) Fallback relay.
  try {
    const result = await sendViaRelay(payload);
    console.log(`contact: pesan dari ${payload.email} diteruskan via relay -> ${CONTACT_TO} (${JSON.stringify(result).slice(0, 160)})`);
    res.json({ ok: true, message: `Pesan terkirim ke ${CONTACT_TO}.` });
  } catch (err) {
    console.error(`contact: relay gagal -> ${CONTACT_TO}: ${err.message}`);
    res.status(502).json({ error: `Gagal mengirim pesan (${err.message}). Coba lagi beberapa saat.` });
  }
});

module.exports = router;
