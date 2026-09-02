'use strict';

// backend/lib/uploadGuard.js
// Proteksi unggahan foto (2 Sep 2026): foto dikirim sebagai data URL
// base64 di dalam JSON (bukan multipart), jadi "upload" = validasi isi
// byte gambar SEBELUM disimpan + scan antivirus ringan (ClamAV) bila
// tersedia di server. Fail-open untuk scanner: bila clamd tidak ada,
// foto tetap diterima setelah lolos magic-byte (dicegat di log).

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

// Batas: maksimal 5 foto, masing-masing <= 4 MB byte mentah (base64
// data URL dibatasi 5,6 MB) — kompresi dilakukan di frontend.
const MAX_PHOTOS = 5;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_DATA_URL_LEN = Math.ceil((MAX_BYTES * 4) / 3) + 256;

// Signature sihir (magic bytes) per format gambar yang diizinkan.
// MIME yang diklaim klien TIDAK dipercaya — dicek dari isi byte.
const SIGNATURES = [
  { ext: 'jpeg', magic: [0xff, 0xd8, 0xff] },
  { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'gif', magic: [0x47, 0x49, 0x46, 0x38] }, // GIF87a/GIF89a
  { ext: 'webp', magic: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP dicek lanjutan
];
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  for (const s of SIGNATURES) {
    if (s.magic.every((b, i) => buf[i] === b)) {
      if (s.ext === 'webp') {
        // RIFF + ukuran + "WEBP" pada offset 8.
        if (buf.toString('ascii', 8, 12) !== 'WEBP') return null;
      }
      return s.ext;
    }
  }
  return null;
}

// Validasi satu data URL gambar. Mengembalikan { ok:true } bila aman,
// atau { ok:false, error }. URL http(s) biasa diizinkan (dipakai data
// media hasil kurasi & hotlink) — bukan kanal upload file.
function validatePhoto(raw) {
  const u = String(raw || '').trim();
  if (u === '') return { ok: false, error: 'Foto kosong' };
  if (/^https?:\/\//i.test(u)) {
    return u.length <= MAX_DATA_URL_LEN * 2 ? { ok: true } : { ok: false, error: 'URL foto terlalu panjang' };
  }
  if (!u.startsWith('data:')) return { ok: false, error: 'Format foto tidak didukung (data URL atau URL http saja)' };
  if (u.length > MAX_DATA_URL_LEN) return { ok: false, error: 'Ukuran foto melebihi batas (maks 4 MB/foto)' };

  const m = u.match(/^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return { ok: false, error: 'Data URL gambar tidak valid' };
  const declared = m[1].toLowerCase();
  if (!ALLOWED_MIME.has(declared)) {
    return { ok: false, error: 'Tipe gambar tidak diizinkan (png/jpeg/webp/gif saja — SVG/HTML ditolak)' };
  }
  let buf;
  try {
    buf = Buffer.from(m[2], 'base64');
  } catch (_e) {
    return { ok: false, error: 'Isi base64 rusak' };
  }
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return { ok: false, error: 'Isi foto kosong/melebihi 4 MB' };
  }
  const ext = sniffImage(buf);
  if (!ext) return { ok: false, error: 'Isi file bukan gambar asli (magic bytes tidak cocok)' };
  // MIME klaim harus konsisten dengan isi.
  const expect = `image/${ext}`;
  if (declared !== expect) {
    return { ok: false, error: `Klaim tipe (${declared}) tidak cocok dengan isi file (${expect})` };
  }
  return { ok: true };
}

// Sanitasi array foto: { photos: [...yang lolos], errors: [...] }.
function sanitizePhotos(arr) {
  const list = Array.isArray(arr) ? arr.slice(0, MAX_PHOTOS) : [];
  const photos = [];
  const errors = [];
  for (const item of list) {
    if (typeof item !== 'string') {
      errors.push('Terdapat entri foto non-teks');
      continue;
    }
    const v = validatePhoto(item);
    if (v.ok) photos.push(item.trim());
    else errors.push(v.error);
  }
  return { photos: photos.slice(0, MAX_PHOTOS), errors };
}

// Scan antivirus (ClamAV) terhadap byte foto: tulis file temp, panggil
// clamdscan, hapus. FAIL-OPEN: clamd tidak ada/error -> lolos (dengan
// catatan), supaya layanan tidak mati karena scanner; FOUND -> tolak.
function scanBytes(buf) {
  return new Promise((resolve) => {
    let tmp = null;
    try {
      tmp = path.join(os.tmpdir(), `tk-scan-${crypto.randomBytes(8).toString('hex')}.img`);
      fs.writeFileSync(tmp, buf);
    } catch (e) {
      if (tmp) { try { fs.unlinkSync(tmp); } catch (_e) { /* noop */ } }
      return resolve({ ok: true, scanned: false, note: 'gagal tulis temp: ' + e.message });
    }
    execFile(
      'clamdscan',
      ['--no-summary', '--fdpass', tmp],
      { timeout: 15000 },
      (err, stdout) => {
        try { fs.unlinkSync(tmp); } catch (_e) { /* noop */ }
        if (err) {
          // clamdscan exit code 1 = virus FOUND; lainnya = scanner tak tersedia.
          if (/FOUND/i.test(String(stdout))) {
            return resolve({ ok: false, infected: true });
          }
          return resolve({ ok: true, scanned: false, note: 'clamd tidak tersedia' });
        }
        return resolve({ ok: true, scanned: true });
      }
    );
  });
}

// Validasi penuh untuk array data URL: magic bytes + (opsional) ClamAV.
async function guardPhotos(arr, { antivirus = true } = {}) {
  const { photos, errors } = sanitizePhotos(arr);
  if (photos.length === 0) {
    return { photos: [], errors: errors.length ? errors : ['Minimal 1 foto gambar yang valid'] };
  }
  const out = [];
  if (antivirus) {
    for (const p of photos) {
      if (!p.startsWith('data:')) { out.push(p); continue; }
      const m = p.match(/^data:(image\/[a-z+.-]+);base64,([A-Za-z0-9+/=]+)$/);
      const buf = m ? Buffer.from(m[2], 'base64') : null;
      if (buf) {
        // eslint-disable-next-line no-await-in-loop
        const s = await scanBytes(buf);
        if (s.ok === false) {
          errors.push('Foto mengandung malware — ditolak antivirus');
          continue;
        }
      }
      out.push(p);
    }
  } else {
    out.push(...photos);
  }
  return { photos: out, errors };
}

module.exports = { validatePhoto, sanitizePhotos, guardPhotos, sniffImage, MAX_PHOTOS, MAX_BYTES };
