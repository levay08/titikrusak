'use strict';

// backend/routes/news.js
// GET /api/news — berita terkini (News Flash) dari agregasi RSS Indonesia.
// Selalu { news: [...] } (best-effort, tidak pernah error 5xx).

const express = require('express');
const { getNews } = require('../services/newsClient.js');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const news = await getNews();
    res.json({ news });
  } catch (_e) {
    res.json({ news: [] });
  }
});

module.exports = router;
