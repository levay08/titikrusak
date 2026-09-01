'use strict';

// backend/routes/enrichment.js
// Endpoint enrichment BMKG (File 1 Bagian 7.4 kontrak API; File 2 7.2):
//   GET /api/enrichment/disaster?lat=&lng=  -> gempa terdekat relevan
//   GET /api/enrichment/weather?lat=&lng=   -> prakiraan cuaca 3-harian
// Dipakai frontend untuk laporan lama yang belum punya data enrichment
// (dipanggil saat detail laporan dibuka). Respons selalu { data, source }.
// Best-effort: data = null bila tidak ada/gagal (tidak pernah error 5xx
// karena sumber eksternal).

const express = require('express');
const { bmkg } = require('../services/bmkgClient.js');

const router = express.Router();

function parseCoords(req, res) {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (req.query.lat === undefined || req.query.lng === undefined ||
      !Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'Parameter lat dan lng wajib berupa angka' });
    return null;
  }
  return { lat, lng };
}

// GET /api/enrichment/disaster?lat=&lng=
router.get('/disaster', async (req, res) => {
  const coords = parseCoords(req, res);
  if (!coords) return;
  try {
    const data = await bmkg.enrichEarthquake({ ...coords, date: new Date().toISOString() });
    res.json({ data, source: 'BMKG' });
  } catch (_e) {
    res.json({ data: null, source: 'BMKG' });
  }
});

// GET /api/enrichment/weather?lat=&lng=
router.get('/weather', async (req, res) => {
  const coords = parseCoords(req, res);
  if (!coords) return;
  try {
    const data = await bmkg.enrichWeather(coords);
    res.json({ data, source: 'BMKG' });
  } catch (_e) {
    res.json({ data: null, source: 'BMKG' });
  }
});

module.exports = router;
