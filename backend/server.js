'use strict';

// backend/server.js
// Entry point backend titikrusak.id. Dijalankan dengan: node server.js
// (File 2 Bagian 6.1). Port dari env PORT, default 3000.

const express = require('express');
const env = require('./config/env.js');
const reportsRouter = require('./routes/reports.js');
const verifyRouter = require('./routes/verify.js');
const enrichmentRouter = require('./routes/enrichment.js');
const activityRouter = require('./routes/activity.js');
const newsRouter = require('./routes/news.js');
const reportsGuards = require('./routes/guards.js'); // keamanan: sesi e.id, captcha, edit-own, tanda X
const captchaRouter = require('./routes/captcha.js');

const app = express();

// Body limit diperbesar: laporan bisa membawa foto (data URL hasil
// kompresi frontend, maks. 5 foto) — File 1 Bagian 5.2.
app.use(express.json({ limit: '12mb' }));

// Captcha anti-bot untuk pelapor tanpa verifikasi e.id.
app.use('/api/captcha', captchaRouter);

// Router keamanan DI DEPAN route laporan: otorisasi sesi e.id (fix
// pentest K-1/S-1), captcha, edit-milik-sendiri, tanda "tidak dapat
// diverifikasi" oleh otoritas. Request lain diteruskan ke reportsRouter.
app.use('/api/reports', reportsGuards);

// Route laporan (File 2 Bagian 6.3 langkah kedua).
// Rate limiting untuk POST diterapkan di dalam routes/reports.js
// (File 1 Bagian 11.3).
app.use('/api/reports', reportsRouter);

// Route verifikasi e.id (File 2 Bagian 7.1 langkah keempat-kelima-keenam).
app.use('/api/verify', verifyRouter);

// Route enrichment BMKG (File 1 7.4 / File 2 7.2): gempa & cuaca untuk
// laporan lama yang belum punya data enrichment.
app.use('/api/enrichment', enrichmentRouter);

// Route feed aktivitas gabungan (transparansi): notifikasi semua kejadian.
app.use('/api/activity', activityRouter);

// Route berita terkini (news flash) dari agregasi RSS Indonesia.
app.use('/api/news', newsRouter);


// 404 JSON untuk endpoint yang tidak dikenal.
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// Error handler: pastikan error selalu dikembalikan sebagai JSON,
// bukan HTML, termasuk JSON body yang tidak valid.
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Body JSON tidak valid' });
  }
  res.status(500).json({ error: 'Terjadi kesalahan internal server' });
});

app.listen(env.PORT, () => {
  console.log(`Backend titikrusak.id berjalan di port ${env.PORT}`);
});
