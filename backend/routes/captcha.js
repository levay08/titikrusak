'use strict';

// backend/routes/captcha.js
// GET /api/captcha -> { id, question } untuk pelapor warga yang TIDAK
// verifikasi e.id (lapisan captcha anti-bot di form lapor).

const express = require('express');
const { createCaptcha } = require('../lib/security.js');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(createCaptcha());
});

module.exports = router;
