// backend/test/newsMonitorMatch.test.js
// Mengunci perbaikan 9 Sep 2026: artikel berita TIDAK boleh menempel ke titik
// di kabupaten lain hanya karena sama-sama menyebut nama provinsi (mis.
// "Aceh Utara" vs "Aceh Tengah"). Kasus uji = 16 baris [Update] nyasar yang
// benar-benar ada di DB produksi + beberapa kasus sah yang harus tetap cocok.
const { test } = require('node:test');
const assert = require('node:assert');
const { matchScore, regionConflict, regionOverlap, locContains } = require('../services/newsMonitor.js');

const ROWS = {
  47: {
    infra_type: 'sekolah', severity: 'berat', status: 'dilaporkan',
    location_name: 'SDN 12 Bintang, Kecamatan Bintang (Aceh Tengah, Aceh)',
    description: 'Banjir bandang dan longsor akhir November 2025 merusak parah sejumlah sekolah di dataran tinggi Gayo. Bangunan kelas SDN 12 Bintang, Aceh Tengah, rusak berat karena tertimbun longsor sehingga siswa terpaksa belajar di tenda darurat yang didirikan Kemendikdasmen.',
  },
  48: {
    infra_type: 'prasarana_publik', severity: 'berat', status: 'dilaporkan',
    location_name: 'Tanggul Sungai Sei Wampu, Kecamatan Gebang (Langkat, Sumatera Utara)',
    description: 'Jebolnya tanggul Sungai Sei Wampu menjadi penyebab banjir besar yang merendam Kabupaten Langkat pada 26 November 2025. Di Kecamatan Gebang, banjir melanda enam desa dan memaksa hampir seribu warga mengungsi.',
  },
  562: {
    infra_type: 'jembatan', severity: 'berat', status: 'dilaporkan',
    location_name: 'Jembatan penghubung Kelurahan Mangga Dua Utara–Tanah Tinggi Barat, Kecamatan Ternate Selatan, Kota Ternate',
    description: 'Longsor akibat hujan deras menggerus sisi kiri jembatan penghubung Mangga Dua Utara dan Tanah Tinggi Barat, Ternate Selatan, hingga muncul lubang besar; talud penahan banjir di sekitarnya ambruk.',
  },
  38: {
    infra_type: 'jembatan', severity: 'ambruk', status: 'dilaporkan',
    location_name: 'Jembatan antarkampung Desa Babadan, Klaten (Jawa Tengah)',
    description: 'Jembatan antarkampung di Desa Babadan, Klaten, ambruk diterjang derasnya arus sungai pada Kamis (3/4/2025) malam sehingga warga harus memutar sejauh 600 meter hingga 1 kilometer.',
  },
  7: {
    infra_type: 'jembatan', severity: 'ambruk', status: 'dilaporkan',
    location_name: 'Jembatan Limpas Kotakan–Siliwung, Situbondo (Jawa Timur)',
    description: 'Jembatan penghubung Desa Kotakan dan Desa Siliwung ambrol dan putus pada 31 Maret 2026 akibat derasnya air Sungai Sampean Baru dari hulu Bondowoso.',
  },
  614: {
    infra_type: 'jembatan', severity: 'ambruk', status: 'dilaporkan',
    location_name: 'Jembatan Dung Buceng, Desa Bangun, Munjungan, Trenggalek (Jawa Timur)',
    description: 'Jembatan Dung Buceng penghubung Kecamatan Munjungan dan Watulimo, Trenggalek, putus diterjang banjir bandang; tiang penyangga tengah roboh lebih dulu disusul runtuhnya badan jembatan.',
  },
  41: {
    infra_type: 'sekolah', severity: 'ambruk', status: 'dilaporkan',
    location_name: 'MTs Muhammadiyah 4 Bulu, Sambungmacan, Sragen (Jawa Tengah)',
    description: 'Atap ruang kelas VII MTs Muhammadiyah 4 Bulu, Kecamatan Sambungmacan, Sragen ambruk saat kegiatan belajar mengajar; tujuh orang terluka.',
  },
  432: {
    infra_type: 'rumah_sakit', severity: 'berat', status: 'dilaporkan',
    location_name: '12 puskesmas terdampak di Kab. Aceh Tamiang',
    description: 'Sebanyak 12 puskesmas di Kabupaten Aceh Tamiang mengalami kerusakan berat akibat bencana banjir, termasuk ambulans, puskesmas keliling, peralatan dan mebel penunjang yang terendam.',
  },
  434: {
    infra_type: 'prasarana_publik', severity: 'berat', status: 'dilaporkan',
    location_name: 'Bendung DI Jambo Aye, Desa Rumoh Rayeuk, Kec. Langkahan, Kab. Aceh Utara',
    description: 'Bendung Daerah Irigasi Jambo Aye di Aceh Utara jebol dengan lima titik tanggul rusak parah akibat banjir bandang, mengancam pengairan sawah tujuh kecamatan di Aceh Utara.',
  },
  116: {
    infra_type: 'jembatan', severity: 'ambruk', status: 'dilaporkan',
    location_name: 'Jembatan Gemboyah, Aceh Tengah, Aceh',
    description: 'Bupati Aceh Tengah meninjau Jembatan Gemboyah yang nyaris putus; perbaikan segera dilakukan. Jembatan darurat yang dipakai warga ikut putus - warga kembali menyeberang memakai sling.',
  },
  4: {
    infra_type: 'jembatan', severity: 'ambruk', status: 'dilaporkan',
    location_name: 'Jembatan Gantung Pongpet, Desa Margacinta, Cijulang, Pangandaran (Jawa Barat)',
    description: 'Jembatan Merah Putih Pongpet di Desa Margacinta, Kecamatan Cijulang, Pangandaran, miring/ambruk saat diresmikan pada 30 Agustus 2026.',
  },
};

// 16 baris [Update] yang NYASAR di produksi (9 Sep 2026) - semuanya harus DITOLAK.
const HARUS_TOLAK = [
  [47, '365 Sekolah Rusak Karena Banjir Mulai Diperbaiki di Aceh Utara, Proses Belajar Direlokasi Sementara - Kompas.com'],
  [47, 'Sekolah Rusak Akibat Banjir, Puluhan Siswa di Aceh Barat Masih Belajar di Tenda Darurat - Kompas.tv'],
  [47, '5 Bulan Pascabanjir, Ratusan Sekolah di Aceh Utara Belum Diperbaiki - Kompas.com'],
  [47, 'Disdikbud: Ratusan bangunan sekolah rusak akibat banjir di Aceh Timur - ANTARA News Aceh'],
  [47, '50 Murid SD di Aceh Barat Masih Belajar di Tenda Darurat Usai Sekolah Rusak Diterjang Banjir - Kompas.com'],
  [47, 'Sekolah Rusak Parah, Pendidikan Aceh Tamiang Bertahan di Tengah Tanggap Darurat - Lampumerahnews'],
  [47, '365 Sekolah Rusak Karena Banjir Mulai Diperbaiki di Aceh Utara, Proses Belajar Direlokasi Sementara - regional.kompas.com'],
  [47, 'Disdikbud: Ratusan bangunan sekolah rusak akibat banjir di Aceh Timur - aceh.antaranews.com'],
  [47, 'Sekolah Rusak Parah, Pendidikan Aceh Tamiang Bertahan di Tengah Tanggap Darurat - lampumerahnews.id'],
  [48, 'Banjir Rendam 4 Desa di Aceh Utara, Tanggul Jebol Belum Diperbaiki - Kompas.com'],
  [562, '19 Jembatan Bailey Dibangun di Aceh Utara, Pengganti Jembatan Ambruk Akibat Banjir - Kompas.com'],
  [38, '5 Desa di Aceh Tengah Terisolasi Lagi Imbas Jembatan Darurat Ambruk — detikNews'],
  [7, 'Jembatan Putus di Sekotong Timur-Mareje Mulai Dikerjakan - ekbisntb.com'],
  [614, 'Sehari Jembatan Putus, Warga 2 Desa di Pamekasan Kompak Bangun Jembatan Bambu - Kompas.com'],
  [41, 'Pengecekan berkala bangunan sekolah didorong pasca kejadian — Kompas.id'],
  [432, 'Ministry of Health and Youth Community Strengthen Health Facility Recovery in Sumatra'],
];

test('SEMUA 16 update nyasar ditolak (tidak menempel ke titik kabupaten lain)', () => {
  for (const [id, title] of HARUS_TOLAK) {
    assert.equal(matchScore(ROWS[id], title, null), null, `#${id} seharusnya TIDAK cocok: ${title}`);
  }
});

test('update dari kabupaten/objek yang SAMA tetap diterima', () => {
  // #434 & #116: artikel menyebut kabupaten yang sama dengan titiknya.
  assert.notEqual(matchScore(ROWS[434], 'Banjir Rusak Jalan Darurat, Aktivitas Belajar di Aceh Utara Terganggu - Minanews.net', null), null);
  assert.notEqual(matchScore(ROWS[116], 'Tiga kampung di Aceh Tengah terisolasi karena jembatan darurat rusak — AcehSatu', null), null);
  // #4: lanjutan berita objek yang sama (Pangandaran).
  assert.notEqual(matchScore(ROWS[4], 'Jembatan di Pangandaran Ambruk Saat Diresmikan, Menteri PU: Harus Bangun Ulang - detikFinance', null), null);
});

test('aturan wilayah: pasangan arah dibandingkan utuh, bukan kata per kata', () => {
  assert.equal(regionConflict('Aceh Tengah', 'berita dari Aceh Barat'), true);
  assert.equal(regionConflict('Aceh Tengah', 'berita dari Aceh Tengah'), false);
  assert.equal(regionConflict('Klaten (Jawa Tengah)', 'Aceh Tengah'), true);
  assert.equal(regionConflict('Langkat, Sumatera Utara', 'Kecamatan Gebang, Langkat'), false); // tak ada pasangan berarah
  assert.equal(regionOverlap('Kab. Aceh Utara', 'kabar Aceh Utara'), true);
  assert.equal(regionOverlap('Kab. Aceh Utara', 'kabar Aceh Timur'), false);
  // "aceh" saja BUKAN bukti kecocokan tempat; nama wilayah berarah
  // dibandingkan sebagai pasangan (regionOverlap).
  assert.equal(locContains('SDN 12 Bintang, Kecamatan Bintang (Aceh Tengah, Aceh)', 'Aceh Barat'), false);
  assert.equal(locContains('Jembatan Gemboyah, Aceh Tengah, Aceh', 'Aceh Tengah'), false); // dua-duanya kata generik
  assert.equal(regionOverlap('Jembatan Gemboyah, Aceh Tengah, Aceh', 'Aceh Tengah'), true);
  assert.equal(locContains('Jembatan Gantung Pongpet, Desa Margacinta, Cijulang, Pangandaran (Jawa Barat)', 'Jembatan di Pangandaran Ambruk Saat Diresmikan'), true);
});
