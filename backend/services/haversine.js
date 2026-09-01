'use strict';

// backend/services/haversine.js
// Jarak haversine antara dua koordinat geografis (File 1 Bagian 5.8).
// Dipakai enrichment BMKG (jarak laporan <-> gempa) dan pencarian adm4
// terdekat untuk prakiraan cuaca.

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Jarak dalam kilometer; null bila koordinat tidak valid.
function haversineKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((v) => Number.isFinite(v))) return null;
  const R = 6371; // radius bumi (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

module.exports = { haversineKm };
