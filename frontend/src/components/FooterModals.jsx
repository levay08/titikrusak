// frontend/src/components/FooterModals.jsx
// Menu footer: Dokumentasi (legend peta + keterangan severity/status +
// panduan mengoperasikan web app) dan Syarat & Ketentuan (privacy policy,
// mention e.id & verifikasi KYC agar pelapor merasa aman). Status & Kontak
// di-render disable di App (belum aktif).
// Memakai ModalShell yang sama dengan modal header agar konsisten.

import {
  SEVERITY_ORDER,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  SEVERITY_DEFINITIONS,
  INFRA_TYPES,
  INFRA_LABELS,
  STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../lib/labels.js';
import { ModalShell } from './HeaderModals.jsx';

const sectionTitle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  color: '#1c1917',
  marginBottom: 8,
};

// Arti singkat tiap status laporan (alur File 1 Bagian 6.2).
const STATUS_MEANING = {
  dilaporkan: 'Laporan baru masuk dan menunggu verifikasi otoritas.',
  terverifikasi: 'Divalidasi oleh otoritas — titik tampil dengan centang ✓ di peta.',
  dalam_perbaikan: 'Sedang ditangani / diperbaiki oleh otoritas.',
  selesai_diperbaiki: 'Perbaikan telah selesai dilakukan.',
};

export function DocModal({ onClose }) {
  return (
    <ModalShell title="Dokumentasi" onClose={onClose} maxWidth={640}>
      {/* ---- Legenda peta: tingkat kerusakan ---- */}
      <div style={{ marginBottom: 18 }}>
        <span style={sectionTitle}>Legenda Peta — Tingkat Kerusakan</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SEVERITY_ORDER.map((sev) => (
            <div
              key={sev}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '9px 12px',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: SEVERITY_COLORS[sev],
                  border: '2px solid #fff',
                  boxShadow: `0 0 0 1px ${SEVERITY_COLORS[sev]}`,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <span style={{ flex: 1 }}>
                <strong style={{ fontSize: 13, color: '#1c1917' }}>
                  {SEVERITY_LABELS[sev]}
                </strong>
                <span style={{ display: 'block', fontSize: 12, color: '#475569', marginTop: 2 }}>
                  {SEVERITY_DEFINITIONS[sev]}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Status laporan ---- */}
      <div style={{ marginBottom: 18 }}>
        <span style={sectionTitle}>Status Laporan</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STATUSES.map((s) => (
            <div
              key={s.value}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '9px 12px',
              }}
            >
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: `${s.color}1a`,
                  color: s.color,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {STATUS_LABELS[s.value] || s.value}
              </span>
              <span style={{ flex: 1, fontSize: 12.5, color: '#475569' }}>
                {STATUS_MEANING[s.value] || ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Kategori kerusakan ---- */}
      <div style={{ marginBottom: 18 }}>
        <span style={sectionTitle}>Kategori Kerusakan</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {INFRA_TYPES.map((t) => (
            <span
              key={t.value}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#334155',
              }}
            >
              {INFRA_LABELS[t.value] || t.value}
            </span>
          ))}
        </div>
      </div>

      {/* ---- Panduan penggunaan ---- */}
      <div>
        <span style={sectionTitle}>Panduan Mengoperasikan</span>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7, color: '#334155' }}>
          <li>
            <strong>Lihat peta</strong> — klik titik berwarna untuk membuka detail
            lengkap (foto, jenis kerusakan, status, sumber); klik cluster (angka)
            untuk memperbesar ke area itu.
          </li>
          <li>
            <strong>Filter &amp; cari</strong> — gunakan sidebar filter (severity,
            kewenangan, status vital) atau search bar di header untuk mencari kata
            kunci (nama kota, jenis kerusakan, media).
          </li>
          <li>
            <strong>Laporkan kerusakan</strong> — tekan tombol “+ Lapor Kerusakan”,
            isi form (jenis, lokasi, deskripsi). Verifikasi e.id bersifat opsional
            bagi pelapor.
          </li>
          <li>
            <strong>Dukung laporan</strong> — pada detail titik, tekan “Dukung
            laporan” (memerlukan verifikasi e.id warga) — dukungan menjadi sinyal
            prioritas bagi otoritas.
          </li>
          <li>
            <strong>Otoritas</strong> — login lalu buka menu “Admin” untuk
            memverifikasi laporan dan mengeset status perbaikan.
          </li>
          <li>
            <strong>Menu header</strong> — Tentang, Statistik, Pantau, Notifikasi
            menampilkan ringkasan &amp; aktivitas seluruh laporan.
          </li>
        </ol>
      </div>
    </ModalShell>
  );
}

export function TermsModal({ onClose }) {
  return (
    <ModalShell title="Syarat & Ketentuan" onClose={onClose} maxWidth={620}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, lineHeight: 1.65, color: '#334155' }}>
        <div>
          <span style={sectionTitle}>Kebijakan Privasi</span>
          <p style={{ margin: '0 0 8px' }}>
            titikrusak.id mengumpulkan data laporan kerusakan infrastruktur
            publik: jenis &amp; tingkat kerusakan, lokasi (koordinat), deskripsi,
            foto (opsional), dan nama pelapor (opsional — pelaporan anonim
            didukung penuh).
          </p>
          <p style={{ margin: 0 }}>
            Data digunakan untuk pemetaan kerusakan, penentuan prioritas
            perbaikan, dan statistik publik yang disajikan secara anonim. Data
            tidak dijual dan tidak dibagikan kepada pihak ketiga tanpa
            persetujuan Anda, kecuali diwajibkan oleh hukum.
          </p>
        </div>

        <div>
          <span style={sectionTitle}>Verifikasi Identitas via e.id</span>
          <p style={{ margin: '0 0 8px' }}>
            Verifikasi identitas dilakukan oleh <strong>e.id</strong> (layanan
            identitas digital yang diselenggarakan PANDI). titikrusak.id hanya
            menerima <em>status hasil verifikasi</em> dan tidak pernah menyimpan
            kredensial, dokumen, atau data identitas mentah Anda.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong>Warga (pelapor)</strong> — verifikasi Member level 1: email,
            nama, alamat, dan nomor telepon. <strong>TANPA KTP</strong> — cukup
            untuk mendukung laporan dan menandai laporan terverifikasi.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Otoritas (verifikator)</strong> — verifikasi <strong>KYC
            e-KTP</strong>: identitas penuh dengan dokumen kependudukan. Hanya
            otoritas terverifikasi yang dapat menyetujui laporan dan mengubah
            status perbaikan.
          </p>
        </div>

        <div>
          <span style={sectionTitle}>Ketentuan Penggunaan</span>
          <p style={{ margin: 0 }}>
            Laporkan kerusakan yang nyata dan sesuai lokasi. Jangan mengunggah
            foto pribadi atau milik orang lain tanpa izin. Penyalahgunaan
            (laporan palsu, konten tidak pantas) dapat berujung pada pencabutan
            akses. Dengan menggunakan titikrusak.id, Anda menyetujui ketentuan
            di atas.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}
