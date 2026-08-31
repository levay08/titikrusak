// frontend/src/components/ReportForm.jsx
// Formulir lapor kerusakan infrastruktur untuk warga.
// File 2 Bagian 6.3 langkah kelima; field sesuai File 1 Bagian 5.2 langkah
// kelima dan katalog nilai tetap Bagian 6.8.1-6.8.4.
//
// Tahap ini TANPA verifikasi e.id (opsi verifikasi menyusul di File 2
// Bagian 7.1) dan TANPA upload foto (menyusul terpisah).
//
// Lokasi (File 1 Bagian 5.2 langkah kelima): geocoding otomatis via
// Nominatim. Pengguna mengetik nama lokasi lalu menekan "Cari Lokasi";
// hasil geocoding ditampilkan di peta kecil (mini-map Leaflet) dengan pin
// yang bisa digeser. Pergeseran pin dibatasi radius 1,5 km dari titik
// hasil geocoding (haversine); jika pengguna menggeser melebihi radius,
// pin otomatis dikembalikan ke titik terdekat di tepi radius. Jika
// geocoding tidak menemukan hasil, peta ditampilkan dengan titik tengah
// default (tengah Indonesia) agar pengguna tetap bisa menempatkan pin
// secara manual. Koordinat final yang dikirim ke backend adalah posisi
// pin (setelah digeser jika digeser).
//
// Data dikirim ke POST /api/reports; onSubmitted() dipanggil setelah
// sukses agar MapView me-refresh marker-nya.

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  INFRA_TYPES,
  SEVERITIES,
  BRIDGE_AUTHORITIES,
  VITAL_STATUSES,
} from '../lib/labels.js';
import VerificationFlow from './VerificationFlow.jsx';
import useIsMobile from '../lib/useIsMobile.js';

// ---- Konfigurasi geocoding & peta lokasi (File 1 Bagian 5.2) ----

// Titik tengah default Indonesia (File 1 Bagian 5.1), dipakai saat
// geocoding tidak menemukan hasil atau sebelum pencarian pertama.
const DEFAULT_CENTER = { lat: -2.5, lng: 118 };

// Radius maksimum pergeseran pin dari titik hasil geocoding (File 1
// Bagian 5.2): 1,5 km — di tengah rentang 1-2 km yang ditentukan.
const MAX_RADIUS_M = 1500;

const GEOCODE_URL = 'https://nominatim.openstreetmap.org/search';

// Ikon pin custom (divIcon) agar tidak bergantung asset gambar Leaflet
// dan tetap terlihat kontras di atas tile peta.
const PIN_ICON = L.divIcon({
  className: '',
  html:
    '<div style="width:18px;height:18px;border-radius:50%;background:#7c3aed;' +
    'border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Jarak great-circle dua titik dalam meter (haversine).
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Jika target melebihi maxM meter dari center, kembalikan titik terdekat
// di tepi lingkaran radius maxM (interpolasi linier sepanjang arah
// center->target; cukup akurat untuk radius ≤ 2 km).
function clampToRadius(center, target, maxM) {
  const dist = haversineMeters(center, target);
  if (dist <= maxM) return target;
  const t = maxM / dist;
  return {
    lat: center.lat + (target.lat - center.lat) * t,
    lng: center.lng + (target.lng - center.lng) * t,
  };
}

// ---- Peta kecil pemilih lokasi ----
// Menampilkan tile OSM + pin draggable. Jika ada anchor (hasil
// geocoding), peta diarahkan ke sana dan pin dijepit dalam radius
// MAX_RADIUS_M dari anchor. Tanpa anchor, pin bebas digeser.
function LocationMiniMap({ anchor, pin, onPinChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return undefined;

    const map = L.map(el, {
      center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: 5,
      scrollWheelZoom: false, // jangan zoom saat scroll form
    });
    mapRef.current = map;

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
      draggable: true,
      icon: PIN_ICON,
    }).addTo(map);
    markerRef.current = marker;

    // Saat drag berlangsung: jepit posisi ke tepi radius jika melampaui
    // (anchor = titik hasil geocoding). Tanpa anchor, ikuti posisi bebas.
    marker.on('drag', () => {
      const pos = marker.getLatLng();
      let next = { lat: pos.lat, lng: pos.lng };
      const anchorPt = anchorRef.current;
      if (anchorPt) {
        const clamped = clampToRadius(anchorPt, next, MAX_RADIUS_M);
        if (clamped.lat !== next.lat || clamped.lng !== next.lng) {
          marker.setLatLng([clamped.lat, clamped.lng]);
          next = clamped;
        }
      }
      onPinChange(next, false);
    });

    // Setelah pin dilepas: posisi final ditetapkan sebagai lokasi laporan.
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onPinChange({ lat: pos.lat, lng: pos.lng }, true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onPinChange]);

  // Saat hasil geocoding baru masuk (anchor berubah): arahkan peta dan
  // pindahkan pin ke titik hasil.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (anchor) {
      map.setView([anchor.lat, anchor.lng], 14);
      marker.setLatLng([anchor.lat, anchor.lng]);
    } else if (pin) {
      map.setView([pin.lat, pin.lng], 12);
      marker.setLatLng([pin.lat, pin.lng]);
    }
  }, [anchor, pin]);

  return (
    <div
      ref={containerRef}
      style={{ height: 220, width: '100%', borderRadius: 8, background: '#e2e8f0' }}
    />
  );
}

const INITIAL_FORM = {
  infra_type: '',
  severity: '',
  bridge_authority: 'tidak_diketahui',
  vital_status: [],
  vital_status_note: '',
  location_name: '',
  description: '',
};

const labelStyle = {
  display: 'block',
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 6,
  color: '#0f172a',
};

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  fontSize: 14,
  boxSizing: 'border-box',
  background: '#fff',
  color: '#0f172a',
};

const errorStyle = { color: '#dc2626', fontSize: 12, marginTop: 4 };

export default function ReportForm({ onSubmitted, onClose }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState('idle'); // idle | submitting | success | error
  const [serverError, setServerError] = useState('');
  // Hasil verifikasi e.id (File 1 Bagian 5.2 langkah 4a):
  // null = belum memilih, {displayName, isVerified} = hasil keputusan.
  const [verification, setVerification] = useState(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  // Di mobile alur e.id (scan QR) tidak praktis — tampilkan info, bukan QR.
  const isMobile = useIsMobile();
  const [eidInfoOpen, setEidInfoOpen] = useState(false);

  // State lokasi: anchor = titik hasil geocoding (acuan radius), pin =
  // posisi pin saat ini, pinConfirmed = lokasi sudah ditentukan (hasil
  // geocoding atau pin pernah digeser pengguna).
  const [anchor, setAnchor] = useState(null);
  const [pin, setPin] = useState(DEFAULT_CENTER);
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [geoState, setGeoState] = useState('idle'); // idle | searching | found | notfound | error
  const [geoError, setGeoError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleVital = (value) => (e) => {
    const checked = e.target.checked;
    setForm((f) => ({
      ...f,
      vital_status: checked
        ? [...f.vital_status, value]
        : f.vital_status.filter((v) => v !== value),
    }));
  };

  const handlePinChange = useCallback((next, isFinal) => {
    setPin(next);
    if (isFinal) setPinConfirmed(true);
  }, []);

  // ---- Geocoding via Nominatim (File 1 Bagian 5.2 langkah kelima) ----
  const searchLocation = async () => {
    const name = form.location_name.trim();
    if (!name) return; // error lokasi sudah ditangani validasi saat submit
    setGeoState('searching');
    setGeoError('');
    try {
      const url = `${GEOCODE_URL}?format=json&limit=1&q=${encodeURIComponent(name)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
        const found = { lat: Number(data[0].lat), lng: Number(data[0].lon) };
        setAnchor(found);
        setPin(found);
        setPinConfirmed(true);
        setGeoState('found');
      } else {
        // Tidak ditemukan: peta kembali ke tengah Indonesia; pengguna
        // menempatkan pin secara manual dengan menggesernya.
        setAnchor(null);
        setPin(DEFAULT_CENTER);
        setPinConfirmed(false);
        setGeoState('notfound');
      }
    } catch (err) {
      setGeoState('error');
      setGeoError(err.message);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.infra_type) errs.infra_type = 'Pilih jenis infrastruktur';
    if (!form.severity) errs.severity = 'Pilih tingkat kerusakan';
    if (form.vital_status.length === 0) errs.vital_status = 'Pilih minimal satu status vital';
    // File 1 Bagian 6.8.4: vital_status_note wajib jika Lainnya dicentang.
    if (form.vital_status.includes('lainnya') && !form.vital_status_note.trim()) {
      errs.vital_status_note = 'Wajib diisi karena Lainnya dipilih';
    }
    if (!form.location_name.trim()) errs.location_name = 'Nama lokasi wajib diisi';
    // Lokasi wajib ditentukan: lewat hasil geocoding atau geser pin manual.
    if (!pinConfirmed) {
      errs.location =
        'Tentukan lokasi dulu: klik "Cari Lokasi" setelah mengetik nama, atau geser pin di peta';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitState('submitting');
    setServerError('');

    const payload = {
      infra_type: form.infra_type,
      severity: form.severity,
      bridge_authority: form.bridge_authority,
      vital_status: form.vital_status,
      location_name: form.location_name.trim(),
      lat: Number(pin.lat),
      lng: Number(pin.lng),
      description: form.description.trim() === '' ? null : form.description.trim(),
    };
    if (form.vital_status.includes('lainnya') && form.vital_status_note.trim()) {
      payload.vital_status_note = form.vital_status_note.trim();
    }
    // Hasil verifikasi e.id ikut dikirim bila pengguna memilih terverifikasi.
    if (verification && verification.isVerified) {
      payload.reporter_display_name = verification.displayName || null;
      payload.reporter_is_verified = true;
    }

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data.error) msg = data.error;
        } catch (_e) {
          // body bukan JSON; pakai pesan status saja
        }
        throw new Error(msg);
      }
      await res.json();
      setSubmitState('success');
      onSubmitted(); // pemicu refresh peta (marker baru tanpa reload manual)
    } catch (err) {
      setSubmitState('error');
      setServerError(err.message);
    }
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setSubmitState('idle');
    setServerError('');
    setAnchor(null);
    setPin(DEFAULT_CENTER);
    setPinConfirmed(false);
    setGeoState('idle');
    setGeoError('');
  };

  // ---- Layar info e.id di mobile (File 1 Bagian 9.7) ----
  // Verifikasi e.id memerlukan scan QR dengan aplikasi e.id di perangkat
  // lain — tidak praktis dari HP itu sendiri. Tampilkan penjelasan, bukan
  // alur QR; desktop tetap memakai VerificationFlow.
  if (eidInfoOpen) {
    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#0f172a' }}>Verifikasi e.id</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.55, color: '#334155' }}>
          Verifikasi identitas e.id memerlukan pemindaian QR menggunakan aplikasi
          e.id di perangkat lain. Fitur ini hanya optimal dan lancar di tampilan{' '}
          <strong>desktop</strong> — silakan lakukan dari komputer, atau lanjut
          tanpa verifikasi.
        </p>
        <button
          type="button"
          onClick={() => setEidInfoOpen(false)}
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#fff',
            color: '#0f172a',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Kembali
        </button>
      </div>
    );
  }

  // ---- Layar awal: pilihan verifikasi e.id (File 1 5.2 langkah 4a) ----
  if (verification === null && !verificationOpen) {
    return (
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#0f172a' }}>Lapor Kerusakan</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.5, color: '#334155' }}>
          Laporkan kerusakan infrastruktur publik di sekitar Anda. Verifikasi identitas
          dengan e.id bersifat opsional dan memperkuat kredibilitas laporan.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={() => (isMobile ? setEidInfoOpen(true) : setVerificationOpen(true))}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Verifikasi dengan e.id
          </button>
          <button
            type="button"
            onClick={() => setVerification({ displayName: null, isVerified: false })}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#0f172a',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Lanjut tanpa verifikasi
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'none',
              color: '#64748b',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  // ---- Alur verifikasi e.id (role warga) ----
  if (verificationOpen) {
    return (
      <VerificationFlow
        role="warga"
        onComplete={(result) => {
          setVerification(result);
          setVerificationOpen(false);
        }}
        onCancel={() => setVerificationOpen(false)}
      />
    );
  }

  // ---- Tampilan sukses ----
  if (submitState === 'success') {
    return (
      <div>
        <h2 style={{ margin: '0 0 10px', fontSize: 18, color: '#0f172a' }}>Laporan Terkirim</h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, lineHeight: 1.5, color: '#334155' }}>
          Terima kasih! Laporan Anda sudah masuk dengan status <strong>Dilaporkan</strong>.
          Marker baru akan langsung muncul di peta.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={resetForm}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#0f172a',
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Kirim laporan lain
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#0f172a' }}>Lapor Kerusakan</h2>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b' }}>
        Semua field bertanda * wajib diisi.
      </p>

      {/* Badge status verifikasi (File 1 Bagian 5.2 langkah 4a) */}
      {verification && verification.isVerified ? (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12.5,
            marginBottom: 14,
          }}
        >
          ✓ Terverifikasi e.id — melapor sebagai <strong>{verification.displayName}</strong>
        </div>
      ) : (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#475569',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 12.5,
            marginBottom: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>Melapor tanpa verifikasi identitas</span>
          <button
            type="button"
            onClick={() => setVerificationOpen(true)}
            style={{
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Verifikasi dengan e.id
          </button>
        </div>
      )}

      {/* 1. Jenis Infrastruktur */}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="infra_type" style={labelStyle}>
          Jenis Infrastruktur *
        </label>
        <select
          id="infra_type"
          value={form.infra_type}
          onChange={set('infra_type')}
          style={{ ...inputStyle, height: 38 }}
        >
          <option value="">— Pilih —</option>
          {INFRA_TYPES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.infra_type && <div style={errorStyle}>{errors.infra_type}</div>}
      </div>

      {/* 2. Tingkat Kerusakan */}
      <div style={{ marginBottom: 16 }}>
        <span style={labelStyle}>Tingkat Kerusakan *</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SEVERITIES.map((s) => (
            <label
              key={s.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                fontSize: 14,
                background: form.severity === s.value ? `${s.color}1a` : '#fff',
              }}
            >
              <input
                type="radio"
                name="severity"
                value={s.value}
                checked={form.severity === s.value}
                onChange={set('severity')}
              />
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: s.color,
                  border: '1px solid #1f2937',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{s.label}</span>
            </label>
          ))}
        </div>
        {errors.severity && <div style={errorStyle}>{errors.severity}</div>}
      </div>

      {/* 3. Kategori Kewenangan */}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="bridge_authority" style={labelStyle}>
          Kategori Kewenangan (opsional)
        </label>
        <select
          id="bridge_authority"
          value={form.bridge_authority}
          onChange={set('bridge_authority')}
          style={{ ...inputStyle, height: 38 }}
        >
          {BRIDGE_AUTHORITIES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {errors.bridge_authority && <div style={errorStyle}>{errors.bridge_authority}</div>}
      </div>

      {/* 4. Status Vital */}
      <div style={{ marginBottom: 16 }}>
        <span style={labelStyle}>Status Vital / Kategori Akses * (minimal satu)</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {VITAL_STATUSES.map((v) => (
            <label
              key={v.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                cursor: 'pointer',
                color: '#0f172a',
              }}
            >
              <input
                type="checkbox"
                value={v.value}
                checked={form.vital_status.includes(v.value)}
                onChange={toggleVital(v.value)}
              />
              {v.label}
            </label>
          ))}
        </div>
        {errors.vital_status && <div style={errorStyle}>{errors.vital_status}</div>}

        {/* vital_status_note hanya muncul jika Lainnya dicentang (6.8.4) */}
        {form.vital_status.includes('lainnya') && (
          <div style={{ marginTop: 8 }}>
            <label htmlFor="vital_status_note" style={labelStyle}>
              Keterangan Status Vital * (wajib karena Lainnya dipilih)
            </label>
            <input
              id="vital_status_note"
              type="text"
              value={form.vital_status_note}
              onChange={set('vital_status_note')}
              placeholder="Jelaskan fungsi vital lainnya"
              style={inputStyle}
            />
            {errors.vital_status_note && <div style={errorStyle}>{errors.vital_status_note}</div>}
          </div>
        )}
      </div>

      {/* 5. Lokasi (geocoding Nominatim + pin manual, File 1 Bagian 5.2) */}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="location_name" style={labelStyle}>
          Nama Lokasi *
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="location_name"
            type="text"
            value={form.location_name}
            onChange={set('location_name')}
            onKeyDown={(e) => {
              // Enter memicu geocoding yang sama dengan tombol Cari Lokasi.
              if (e.key === 'Enter') {
                e.preventDefault();
                searchLocation();
              }
            }}
            placeholder="Contoh: Jembatan Gantung Cibeureum, Garut"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={searchLocation}
            disabled={geoState === 'searching'}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: '#0f172a',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: geoState === 'searching' ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {geoState === 'searching' ? 'Mencari…' : 'Cari Lokasi'}
          </button>
        </div>
        {errors.location_name && <div style={errorStyle}>{errors.location_name}</div>}

        {/* Mini-map: pin hasil geocoding, bisa digeser (dibatasi radius) */}
        <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
          <LocationMiniMap anchor={anchor} pin={pin} onPinChange={handlePinChange} />
        </div>

        <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.5, color: '#64748b' }}>
          {geoState === 'searching' && 'Mencari lokasi di OpenStreetMap…'}
          {geoState === 'found' &&
            `Lokasi ditemukan. Pin bisa digeser maksimal 1,5 km dari titik hasil pencarian.`}
          {geoState === 'notfound' &&
            'Lokasi tidak ditemukan. Tempatkan pin secara manual dengan menggesernya di peta.'}
          {geoState === 'error' && `Gagal mencari lokasi: ${geoError}`}
          {geoState === 'idle' &&
            'Ketik nama lokasi lalu klik "Cari Lokasi", atau geser pin langsung di peta.'}
        </p>
        {pin && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#334155' }}>
            Koordinat pin: {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
          </p>
        )}
        {errors.location && <div style={errorStyle}>{errors.location}</div>}
      </div>

      {/* 6. Deskripsi */}
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="description" style={labelStyle}>
          Deskripsi (opsional)
        </label>
        <textarea
          id="description"
          value={form.description}
          onChange={set('description')}
          rows={3}
          placeholder="Ceritakan kondisi kerusakan…"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {serverError && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          Gagal mengirim laporan: {serverError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="submit"
          disabled={submitState === 'submitting'}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#7c3aed',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: submitState === 'submitting' ? 'wait' : 'pointer',
          }}
        >
          {submitState === 'submitting' ? 'Mengirim…' : 'Kirim Laporan'}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            background: '#fff',
            color: '#0f172a',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Batal
        </button>
      </div>
    </form>
  );
}
