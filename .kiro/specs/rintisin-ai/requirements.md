# Requirements Document

## Introduction

Rintisin AI adalah platform konsultan bisnis berbasis AI dan intelijen pasar lokal untuk UMKM ekonomi kreatif Indonesia (subsektor Kuliner, Fashion, Kriya, dan Beauty), disajikan dalam satu dashboard modular. Platform ini melayani dua segmen:

1. Founder tahap awal yang membutuhkan validasi objektif atas ide produk dan modal awal.
2. Pemilik toko fisik atau brand lokal tahap pertumbuhan yang membutuhkan intelijen kompetitor.

Keunggulan utama produk adalah *Dual-Engine Ekraf Intelligence*: dua modul independen yang berjalan paralel, dan keduanya menghasilkan dashboard visual yang digerakkan JSON (bukan chatbot).

- **Modul 1 — LokalTrend Radar**: memvalidasi kelayakan finansial dan kesiapan go-to-market dari draf ide produk.
- **Modul 2 — PetaSaingan Ekraf**: menganalisis ulasan Google Maps dari maksimal 3 kompetitor untuk memetakan celah pasar dan strategi merebut pelanggan.

Arsitektur wajib berbiaya Rp 0/bulan (*Zero-Cost Hybrid*): Next.js App Router + TypeScript di Vercel Hobby, Supabase (PostgreSQL + Supabase Auth + Supabase Realtime), GroqCloud Free Tier dengan auto-fallback model, serta worker scraper Python FastAPI yang di-Docker-kan di Hugging Face Spaces (folder `worker-scraper/`).

Seluruh teks antarmuka dan seluruh output AI untuk pengguna akhir ditulis dalam Bahasa Indonesia yang profesional, tajam, dan praktis. Isinya harus relevan dengan realitas pasar Indonesia: logistik ekspedisi lokal, daya beli regional, komisi marketplace/ojek online, dan perizinan NIB/PIRT/Halal.

## Glossary

- **Rintisin_App**: Aplikasi web Next.js (frontend dan API inti) yang di-deploy di Vercel Hobby.
- **Auth_Service**: Supabase Auth (`auth.users`), yang bertugas mengelola registrasi, login, dan sesi pengguna.
- **Database**: PostgreSQL yang dikelola Supabase (Supabase Free Tier), tempat menyimpan hasil analisis dalam kolom JSONB.
- **RLS**: Row Level Security PostgreSQL, yang membatasi akses baris berdasarkan pemilik (`user_id`).
- **Realtime_Channel**: Langganan Supabase Realtime `postgres_changes` untuk menerima perubahan baris tanpa polling.
- **Groq_Client**: Komponen server-side yang memanggil GroqCloud API.
- **Model_Primer**: Model Groq `openai/gpt-oss-120b`, dipanggil dengan `response_format: {"type": "json_object"}`.
- **Model_Fallback**: Model Groq `openai/gpt-oss-20b`. Model ini dipakai otomatis saat Model_Primer mengembalikan HTTP 429, dan juga dipakai untuk fase Map pada Modul 2.
- **Response_Guard**: Komponen yang memvalidasi setiap respons JSON LLM dengan skema Zod. Komponen ini juga menjalankan perbaikan (*repair*), satu kali percobaan ulang (*retry*), atau penerapan nilai default sebelum data disimpan atau dirender.
- **Hasil_Terdegradasi**: Hasil analisis yang sebagian field-nya diisi Nilai_Default oleh Response_Guard. Hasil ini ditandai dengan flag `is_degraded = true`.
- **Nilai_Default**: Nilai pengganti yang aman untuk dirender, ditentukan per field di dokumen desain (misalnya angka `0`, teks `"Data tidak tersedia"`, atau array kosong).
- **Modul_1**: Modul LokalTrend Radar (validator ide produk dan konsultan strategi).
- **Modul_2**: Modul PetaSaingan Ekraf (radar sentimen dan analisis celah kompetitor).
- **Idea_Form**: Formulir input Modul_1.
- **Kategori_Ekraf**: Salah satu dari empat nilai: `KULINER`, `FASHION`, `KRIYA`, `BEAUTY`.
- **Analysis_Service**: Logika server Modul_1 (Server Actions/API Routes) yang menjalankan Eksekusi Berantai 2 Langkah.
- **Langkah_1**: Panggilan AI pertama Modul_1, yang menghasilkan `feasibility_audit` dan `target_market_mapper`.
- **Langkah_2**: Panggilan AI kedua Modul_1. Panggilan ini menerima ringkasan hasil Langkah_1 sebagai konteks, lalu menghasilkan `competitor_matrix` dan `gtm_readiness`.
- **Module1_Analysis**: Baris pada tabel hasil Modul_1 yang menyimpan input, hasil JSON per langkah, dan status per langkah.
- **Competitor_Form**: Formulir input Modul_2 untuk 1–3 URL Google Maps.
- **Maps_URL**: URL tempat di Google Maps dengan salah satu format berikut: `https://www.google.com/maps/place/...`, `https://maps.google.com/...`, `https://maps.app.goo.gl/...`, atau `https://goo.gl/maps/...`.
- **Feature_ID**: Pengenal tempat Google Maps dengan format `0x<hex>:0x<hex>`.
- **Maps_URL_Parser**: Komponen worker yang mengekstrak Feature_ID dari Maps_URL. Untuk shortlink, komponen ini terlebih dahulu mengikuti redirect.
- **Maps_URL_Formatter**: Komponen yang membentuk URL kanonik Google Maps dari sebuah Feature_ID.
- **Radar_Job**: Baris pada tabel `module2_radars` yang mewakili satu permintaan analisis Modul_2.
- **Job_Status**: Status Radar_Job dengan nilai `PENDING`, `SCRAPING`, `ANALYZING`, `COMPLETED`, atau `FAILED`.
- **Status_Terminal**: Job_Status `COMPLETED` atau `FAILED`.
- **Scraper_Worker**: Layanan Python FastAPI di Hugging Face Spaces (folder `worker-scraper/`) yang menjalankan akuisisi ulasan, pra-filter, dan Map-Reduce untuk Modul_2.
- **Worker_Secret**: Shared secret yang dikirim Rintisin_App dan diverifikasi Scraper_Worker pada setiap permintaan.
- **Akuisisi_Primer**: Pengambilan ulasan melalui RPC internal `https://www.google.com/maps/rpc/listugcposts` menggunakan curl_cffi/httpx, dengan parameter urutan Terbaru dan Rating Terendah.
- **Akuisisi_Fallback**: Pengambilan ulasan melalui Playwright headless Chromium. Dalam mode ini, aset gambar, font, dan peta diblokir, lalu DOM ulasan di-scroll otomatis.
- **Pre_Filter**: Pipeline deterministik di Scraper_Worker yang membersihkan, menyaring, menormalisasi, menghapus duplikat, dan mengambil sampel ulasan sebelum ulasan dikirim ke LLM.
- **Ulasan_Bersih**: Ulasan yang hanya berisi pasangan `[rating 1–5]` dan `[teks ulasan]`.
- **Text_Normalizer**: Fungsi Pre_Filter yang meringkas huruf berulang (3 kali atau lebih menjadi 1 huruf) dan menghapus emoji.
- **Sampel_Terstratifikasi**: Maksimal 80 ulasan per kompetitor, dengan komposisi 50% ulasan kritis (rating 1–3, teks lebih dari 30 karakter) dan 50% ulasan positif terbaru (rating 4–5, teks lebih dari 40 karakter).
- **Fase_Map**: Panggilan paralel per kompetitor ke Model_Fallback untuk mengekstrak kekuatan, kelemahan, skor aspek, dan keluhan utama.
- **Fase_Reduce**: Satu panggilan ke Model_Primer yang menggabungkan hasil Fase_Map dari semua kompetitor menjadi JSON akhir Modul_2.
- **Dashboard**: Antarmuka visual terstruktur yang terdiri dari Card, Table, Gauge/Radial Bar, dan Radar Chart (Recharts), tanpa elemen percakapan.

## Requirements

### Requirement 1: Autentikasi Pengguna

**User Story:** Sebagai pelaku UMKM, saya ingin masuk ke akun saya, agar hasil analisis saya tersimpan dan hanya bisa diakses oleh saya.

#### Acceptance Criteria

1. WHEN pengguna mengirim formulir registrasi berisi email dengan format valid (maksimal 254 karakter) dan kata sandi sepanjang 8–72 karakter, THE Rintisin_App SHALL membuat akun melalui Auth_Service dan menampilkan pesan dalam Bahasa Indonesia yang menyatakan registrasi berhasil.
2. WHILE pengguna tidak memiliki sesi Auth_Service yang valid (belum login, sudah logout, atau sesinya kedaluwarsa), THE Rintisin_App SHALL mengarahkan setiap permintaan ke halaman Dashboard, Modul_1, dan Modul_2 ke halaman login sebelum konten halaman tersebut dirender, dengan menyimpan alamat halaman yang semula diminta.
3. WHILE pengguna tidak memiliki sesi Auth_Service yang valid, THE Rintisin_App SHALL menolak setiap pemanggilan Server Action atau API Route Modul_1 dan Modul_2 dengan respons HTTP 401, tanpa membuat atau mengubah baris Module1_Analysis maupun Radar_Job, dan tanpa memanggil Groq_Client maupun Scraper_Worker.
4. IF Auth_Service mengembalikan kegagalan login karena email tidak terdaftar atau kata sandi salah, THEN THE Rintisin_App SHALL tetap menampilkan halaman login dengan satu pesan galat Bahasa Indonesia yang identik untuk kedua kasus tersebut (sehingga tidak terungkap apakah email terdaftar), mempertahankan nilai email yang sudah diisi, dan mengosongkan field kata sandi.
5. IF formulir registrasi berisi email dengan format tidak valid, email lebih dari 254 karakter, atau kata sandi di luar rentang 8–72 karakter, THEN THE Rintisin_App SHALL menolak registrasi tanpa membuat akun di Auth_Service, menampilkan pesan galat Bahasa Indonesia yang menyebutkan field yang bermasalah, dan mempertahankan nilai email yang sudah diisi.
6. WHEN pengguna mengirim email dan kata sandi yang diterima Auth_Service pada halaman login, THE Rintisin_App SHALL memulai sesi pengguna dan mengarahkan pengguna ke halaman yang semula diminta, atau ke Dashboard jika tidak ada halaman yang semula diminta.
7. WHEN pengguna yang terautentikasi memilih logout, THE Rintisin_App SHALL mengakhiri sesi melalui Auth_Service dan mengarahkan pengguna ke halaman login, sehingga permintaan berikutnya ke Dashboard, Modul_1, dan Modul_2 diperlakukan sebagai belum terautentikasi sesuai kriteria 2 dan 3.

### Requirement 2: Kepemilikan dan Isolasi Data

**User Story:** Sebagai pengguna, saya ingin data analisis saya terisolasi dari pengguna lain, agar strategi bisnis saya tetap rahasia.

#### Acceptance Criteria

1. THE Database SHALL menyimpan kolom `user_id` yang wajib terisi (tidak boleh NULL) dan merujuk ke `auth.users` pada setiap baris Module1_Analysis dan Radar_Job, sehingga setiap baris tanpa `user_id` atau dengan `user_id` yang tidak ada di `auth.users` ditolak saat disimpan.
2. WHEN klien dengan sesi Auth_Service yang valid menjalankan operasi SELECT, INSERT, UPDATE, atau DELETE pada tabel Module1_Analysis atau tabel `module2_radars`, THE Database SHALL menerapkan RLS sehingga operasi tersebut hanya berlaku pada baris dengan `user_id` yang sama dengan ID pengguna aktif pada sesi tersebut.
3. WHEN baris pada tabel `module2_radars` ditambahkan, diubah, atau dihapus, THE Realtime_Channel SHALL mengirimkan event perubahan baris tersebut hanya kepada langganan milik pengguna terautentikasi dengan `user_id` yang sama dengan baris tersebut sesuai kebijakan RLS, sehingga langganan milik pengguna lain maupun klien tanpa sesi Auth_Service yang valid menerima 0 event untuk baris tersebut.
4. THE Rintisin_App SHALL menyimpan GROQ API key, Supabase service role key, dan Worker_Secret hanya di environment server-side, sehingga ketiga nilai tersebut tidak pernah disertakan dalam bundle JavaScript klien, dalam respons yang dikirim ke browser, maupun dalam pesan error yang ditampilkan kepada pengguna.
5. IF klien terautentikasi mencoba INSERT atau UPDATE baris Module1_Analysis atau Radar_Job dengan nilai `user_id` yang berbeda dari ID pengguna aktif, THEN THE Database SHALL menolak operasi tersebut, mengembalikan error yang menandakan pelanggaran kebijakan akses kepada pemanggil, dan membiarkan seluruh data pada tabel tidak berubah.
6. IF klien terautentikasi menjalankan SELECT, UPDATE, atau DELETE yang menargetkan baris Module1_Analysis atau Radar_Job milik pengguna lain, THEN THE Database SHALL memperlakukan baris tersebut sebagai tidak ada, yaitu mengembalikan 0 baris untuk SELECT, melaporkan 0 baris terpengaruh untuk UPDATE dan DELETE, serta membiarkan baris milik pengguna lain tersebut tidak berubah.
7. IF klien tanpa sesi Auth_Service yang valid menjalankan operasi SELECT, INSERT, UPDATE, atau DELETE pada tabel Module1_Analysis atau tabel `module2_radars`, THEN THE Database SHALL mengembalikan 0 baris untuk SELECT, menolak INSERT, UPDATE, dan DELETE, serta membiarkan seluruh data pada tabel tidak berubah.

### Requirement 3: Antarmuka Dashboard Terstruktur Berbahasa Indonesia

**User Story:** Sebagai pelaku UMKM, saya ingin hasil analisis tampil sebagai dashboard visual yang ringkas, agar saya dapat langsung mengambil keputusan tanpa membaca percakapan panjang.

#### Acceptance Criteria

1. THE Rintisin_App SHALL menerima input analisis pengguna hanya melalui field formulir terstruktur pada Idea_Form dan Competitor_Form, dan menampilkan hasil analisis hanya melalui komponen Dashboard (Card, Table, Gauge/Radial Bar, Radar Chart), tanpa menyediakan kolom obrolan bebas, gelembung percakapan, atau riwayat pesan bergaya chatbot di halaman mana pun.
2. THE Rintisin_App SHALL menampilkan seluruh label, judul, tombol, placeholder, pesan galat, teks status, dan teks antarmuka dalam Bahasa Indonesia, dengan pengecualian hanya untuk nama produk atau merek (misalnya Google Maps), singkatan perizinan (NIB, PIRT, Halal), dan teks yang diketik pengguna sendiri.
3. THE Rintisin_App SHALL menampilkan setiap nilai enum berkode Inggris (misalnya `VIABLE_WITH_NOTES`, `HIGH`, `EVERGREEN_NICHE`) dalam bentuk label Bahasa Indonesia sesuai pemetaan di dokumen desain, sehingga tidak ada kode enum mentah yang terlihat pada Dashboard.
4. THE Rintisin_App SHALL menyediakan Modul_1 dan Modul_2 sebagai dua menu navigasi terpisah yang masing-masing dapat dibuka dengan satu klik dari setiap halaman Dashboard, dan masing-masing dapat dijalankan tanpa memerlukan hasil modul lainnya, termasuk ketika modul lainnya sedang memproses, belum pernah dijalankan, atau berakhir gagal.
5. THE Rintisin_App SHALL menyertakan alternatif teks (tabel data atau label nilai) untuk setiap Gauge dan Radar Chart, yang memuat nama dan nilai numerik setiap titik data yang sama persis dengan nilai yang divisualisasikan grafik, dan dapat dibaca oleh pembaca layar.
6. WHILE Modul_1 atau Modul_2 sedang memproses, THE Rintisin_App SHALL menampilkan indikator pemuatan (*skeleton* atau *progress*) pada setiap area Dashboard yang datanya belum tersedia, disertai teks status Bahasa Indonesia yang dapat dibaca oleh pembaca layar.
7. IF Auth_Service, Groq_Client, Scraper_Worker, atau Database mengembalikan galat ke Rintisin_App, THEN THE Rintisin_App SHALL menampilkan pesan galat Bahasa Indonesia yang menjelaskan jenis kegagalan dan langkah yang dapat dilakukan pengguna, tanpa menampilkan pesan galat mentah berbahasa Inggris, kode internal, atau *stack trace*.
8. IF nilai enum yang akan dirender tidak memiliki pemetaan label Bahasa Indonesia di dokumen desain, THEN THE Rintisin_App SHALL menampilkan label pengganti Bahasa Indonesia yang ditetapkan di dokumen desain sebagai pengganti kode enum mentah, tanpa menghentikan render komponen Dashboard lainnya.
9. WHEN data untuk sebuah area Dashboard tersedia selama Modul_1 atau Modul_2 memproses, THE Rintisin_App SHALL mengganti indikator pemuatan pada area tersebut dengan konten hasilnya tanpa memuat ulang halaman, sementara area lain yang datanya belum tersedia tetap menampilkan indikator pemuatan.

### Requirement 4: Input dan Validasi Idea_Form (Modul_1)

**User Story:** Sebagai founder tahap awal, saya ingin memasukkan draf ide produk, kategori, modal, dan lokasi target, agar sistem dapat mengaudit kelayakan ide saya.

#### Acceptance Criteria

1. THE Idea_Form SHALL menyediakan empat field wajib: Draf Ide Produk (teks), Kategori_Ekraf (pilihan yang hanya berisi nilai `KULINER`, `FASHION`, `KRIYA`, dan `BEAUTY`), Estimasi Modal Awal dalam Rupiah (angka), dan Lokasi/Kota Target Pasar (teks).
2. IF pengguna menekan tombol kirim dan Draf Ide Produk berisi kurang dari 20 karakter atau lebih dari 1.000 karakter setelah spasi di awal dan akhir dihapus, THEN THE Idea_Form SHALL menolak pengiriman, menampilkan pesan validasi pada field tersebut yang menyebutkan batas 20–1.000 karakter, dan mempertahankan nilai seluruh field yang telah diisi.
3. IF pengguna menekan tombol kirim dan Estimasi Modal Awal kosong, bukan bilangan bulat, bernilai kurang dari 1, atau bernilai lebih dari 10.000.000.000, THEN THE Idea_Form SHALL menolak pengiriman, menampilkan pesan validasi pada field tersebut yang menyebutkan rentang Rp 1–Rp 10.000.000.000 dalam bilangan bulat, dan mempertahankan nilai seluruh field yang telah diisi.
4. IF permintaan analisis yang diterima Analysis_Service berisi Kategori_Ekraf yang kosong atau tidak termasuk salah satu dari empat nilai Kategori_Ekraf, THEN THE Analysis_Service SHALL menolak permintaan dengan pesan galat validasi yang menunjuk field Kategori_Ekraf, tanpa memanggil Groq_Client dan tanpa membuat baris Module1_Analysis.
5. IF pengguna menekan tombol kirim dan Lokasi/Kota Target Pasar berisi kurang dari 2 karakter atau lebih dari 100 karakter setelah spasi di awal dan akhir dihapus, THEN THE Idea_Form SHALL menolak pengiriman, menampilkan pesan validasi pada field tersebut yang menyebutkan batas 2–100 karakter, dan mempertahankan nilai seluruh field yang telah diisi.
6. WHEN Analysis_Service menerima permintaan analisis Modul_1, THE Analysis_Service SHALL memvalidasi ulang keempat field Idea_Form di sisi server dengan skema Zod yang sama, termasuk batas panjang dan rentang nilai pada kriteria 2 sampai 5, sebelum memanggil Groq_Client.
7. WHILE sebuah analisis Modul_1 sedang diproses, yaitu sejak tombol kirim ditekan hingga Analysis_Service mengembalikan respons berhasil atau galat, THE Idea_Form SHALL menonaktifkan tombol kirim sehingga satu kali penekanan tombol kirim menghasilkan tepat satu permintaan ke Analysis_Service.
8. IF pengguna menekan tombol kirim dan Kategori_Ekraf belum dipilih, THEN THE Idea_Form SHALL menolak pengiriman, menampilkan pesan validasi pada field Kategori_Ekraf, dan mempertahankan nilai seluruh field yang telah diisi.
9. IF validasi sisi server oleh Analysis_Service gagal pada satu atau lebih field, THEN THE Analysis_Service SHALL menolak permintaan dengan pesan galat validasi untuk setiap field yang tidak valid, tanpa memanggil Groq_Client dan tanpa membuat baris Module1_Analysis.
10. IF Analysis_Service mengembalikan respons galat, THEN THE Idea_Form SHALL mengaktifkan kembali tombol kirim, menampilkan pesan galat tersebut, dan mempertahankan nilai seluruh field yang telah diisi.

### Requirement 5: Eksekusi Berantai 2 Langkah (Modul_1)

**User Story:** Sebagai pengguna, saya ingin separuh atas dashboard tampil lebih dulu, lalu separuh bawah menyusul, agar saya tidak menunggu lama dan hasil JSON tidak terpotong.

#### Acceptance Criteria

1. WHEN pengguna yang sudah login mengirim Idea_Form yang valid, THE Analysis_Service SHALL membuat tepat satu baris Module1_Analysis yang terkait dengan `user_id` pengguna tersebut, berisi seluruh input Idea_Form dengan status Langkah_1 dan Langkah_2 sama-sama belum selesai, lalu menjalankan Langkah_1.
2. WHEN Analysis_Service menjalankan Langkah_1, THE Analysis_Service SHALL meminta Groq_Client menghasilkan satu objek JSON yang hanya berisi objek `feasibility_audit` dan `target_market_mapper`, dengan batas output maksimal 1.200 token.
3. WHEN Langkah_1 menghasilkan data yang lolos Response_Guard (termasuk Hasil_Terdegradasi), THE Analysis_Service SHALL menyimpan hasil Langkah_1 ke Module1_Analysis dan menandai status Langkah_1 sebagai berhasil, lalu THE Rintisin_App SHALL merender komponen Feasibility Auditor dan Target Market Mapper tanpa menunggu respons Langkah_2.
4. WHEN status Langkah_1 pada Module1_Analysis telah ditandai berhasil, THE Analysis_Service SHALL menjalankan Langkah_2 dengan konteks berupa ringkasan yang diturunkan hanya dari hasil Langkah_1 yang tersimpan di Module1_Analysis, dan meminta Groq_Client menghasilkan satu objek JSON yang hanya berisi objek `competitor_matrix` dan `gtm_readiness`, dengan batas output maksimal 1.200 token.
5. WHEN Langkah_2 menghasilkan data yang lolos Response_Guard (termasuk Hasil_Terdegradasi), THE Analysis_Service SHALL menyimpan hasil Langkah_2 ke Module1_Analysis tanpa mengubah hasil Langkah_1 yang sudah tersimpan dan menandai status Langkah_2 sebagai berhasil, lalu THE Rintisin_App SHALL merender komponen Competitor Matrix dan GTM Readiness di bawah komponen hasil Langkah_1.
6. THE Analysis_Service SHALL menjalankan Langkah_1 dan Langkah_2 sebagai dua permintaan server terpisah, dengan durasi masing-masing maksimal 10 detik, diukur dari saat permintaan diterima server hingga respons dikirim.
7. IF Langkah_2 gagal setelah status Langkah_1 ditandai berhasil, THEN THE Rintisin_App SHALL tetap menampilkan komponen Feasibility Auditor dan Target Market Mapper, menampilkan pesan galat dalam Bahasa Indonesia yang menyatakan bahwa Langkah_2 gagal, serta menampilkan tombol "Coba Lagi Langkah 2". Setiap klik tombol tersebut menjalankan ulang tepat satu Langkah_2 pada baris Module1_Analysis yang sama, menggunakan hasil Langkah_1 yang tersimpan, tanpa memanggil ulang Langkah_1. Tombol dinonaktifkan selama Langkah_2 sedang berjalan.
8. IF Langkah_1 gagal, THEN THE Analysis_Service SHALL tidak menjalankan Langkah_2, dan THE Rintisin_App SHALL menampilkan pesan galat dalam Bahasa Indonesia yang menyatakan bahwa Langkah_1 gagal serta tombol "Coba Lagi". Setiap klik tombol tersebut menjalankan ulang tepat satu Langkah_1 pada baris Module1_Analysis yang sama dengan input yang tersimpan, tanpa meminta pengguna mengisi ulang Idea_Form. Tombol dinonaktifkan selama Langkah_1 sedang berjalan.
9. THE Analysis_Service SHALL menggunakan system prompt Modul_1 berikut sebagai instruksi dasar pada Langkah_1 dan Langkah_2, ditambah definisi skema JSON yang relevan untuk setiap langkah: "Anda adalah Senior Konsultan Strategi Bisnis & Auditor Kelayakan UMKM Ekonomi Kreatif di Indonesia. Tugas Anda adalah mengaudit draf ide produk dan estimasi modal pengguna secara objektif, kritis, dan realistis sesuai kondisi pasar, rantai pasok, serta daya beli masyarakat Indonesia. Jangan memberikan pujian kosong. Gunakan asumsi harga bahan baku, biaya komisi platform e-commerce lokal, dan logistik Indonesia yang nyata. Anda WAJIB merespons HANYA dalam format JSON yang valid sesuai dengan skema yang ditentukan di bawah ini."
10. THE Analysis_Service SHALL menginstruksikan model, pada Langkah_1 dan Langkah_2, untuk menulis seluruh nilai teks dalam Bahasa Indonesia, serta mempertimbangkan logistik ekspedisi lokal, daya beli kota target, komisi marketplace/ojek online, dan perizinan NIB/PIRT/Halal yang relevan dengan Kategori_Ekraf pada input.
11. IF sebuah langkah (Langkah_1 atau Langkah_2) melebihi batas durasi 10 detik, gagal dipanggil melalui Groq_Client setelah Model_Fallback juga gagal, atau tidak menghasilkan data yang lolos Response_Guard, THEN THE Analysis_Service SHALL menandai status langkah tersebut sebagai gagal pada Module1_Analysis, tidak menyimpan hasil parsial langkah tersebut, dan mempertahankan input pengguna serta hasil langkah lain yang sudah tersimpan.
12. WHILE Langkah_2 sedang berjalan, THE Rintisin_App SHALL menampilkan indikator pemuatan pada area komponen Competitor Matrix dan GTM Readiness, sementara komponen Feasibility Auditor dan Target Market Mapper tetap ditampilkan.

### Requirement 6: Komponen AI Feasibility & Viability Auditor (Modul_1)

**User Story:** Sebagai founder, saya ingin melihat estimasi HPP, harga jual, margin, risiko operasional, dan tingkat kejenuhan tren, agar saya tahu apakah ide saya layak secara finansial.

#### Acceptance Criteria

1. WHEN Rintisin_App merender `feasibility_audit` dari hasil Langkah_1 pada Dashboard, THE Rintisin_App SHALL menampilkan `estimated_cogs_idr` dan `recommended_selling_price_idr` dalam format Rupiah Indonesia: awalan "Rp", satu spasi, nilai yang dibulatkan ke rupiah terdekat tanpa angka desimal, dan titik sebagai pemisah ribuan (contoh: "Rp 35.000"; nilai 0 ditampilkan sebagai "Rp 0").
2. WHEN Rintisin_App merender `feasibility_audit` dari hasil Langkah_1 pada Dashboard, THE Rintisin_App SHALL menampilkan `gross_margin_percentage` pada komponen Gauge/Radial Bar dengan batas skala minimum 0 dan maksimum 100, beserta label angka 1 desimal dengan koma sebagai pemisah desimal dan akhiran "%" (contoh: "42,5%").
3. WHEN Rintisin_App merender `feasibility_audit` dari hasil Langkah_1 pada Dashboard, THE Rintisin_App SHALL menampilkan `financial_viability_status` sebagai satu badge berlabel Bahasa Indonesia sesuai pemetaan di dokumen desain, sehingga setiap nilai `VIABLE`, `VIABLE_WITH_NOTES`, dan `NOT_VIABLE` menghasilkan label dan tampilan visual badge yang berbeda satu sama lain.
4. WHEN Rintisin_App merender `feasibility_audit` dari hasil Langkah_1 pada Dashboard dan `operational_risks` berisi minimal 1 item, THE Rintisin_App SHALL menampilkan `operational_risks` dalam tabel berkolom aspek (`aspect`), tingkat risiko (`risk_level`: `LOW`/`MEDIUM`/`HIGH`), dan mitigasi (`mitigation`), dengan tepat satu baris per item sesuai urutan dalam JSON dan tanpa pemotongan jumlah baris. Untuk `operational_risks` yang kosong, berlaku Requirement 12 kriteria 8.
5. WHEN Rintisin_App merender `feasibility_audit` dari hasil Langkah_1 pada Dashboard, THE Rintisin_App SHALL menampilkan `trend_sustainability` yang terdiri dari kategori tren (`category`) dengan label Bahasa Indonesia sesuai pemetaan di dokumen desain, `saturation_score` sebagai bilangan bulat dalam rentang 0–100, dan teks analisis (`analysis`) secara utuh.
6. IF `recommended_selling_price_idr` lebih besar dari 0 dan nilai `gross_margin_percentage` dari model berselisih lebih dari 1 poin persentase dari ((`recommended_selling_price_idr` − `estimated_cogs_idr`) ÷ `recommended_selling_price_idr` × 100), THEN THE Response_Guard SHALL mengganti `gross_margin_percentage` dengan hasil perhitungan tersebut, dibulatkan ke 1 angka desimal, lalu memotong (*clamp*) hasilnya ke rentang 0–100 sesuai Requirement 12 kriteria 4, sebelum hasil Langkah_1 disimpan ke Database.
7. IF selisih antara `gross_margin_percentage` dari model dan hasil perhitungan pada kriteria 6 kurang dari atau sama dengan 1 poin persentase, atau `recommended_selling_price_idr` bernilai 0, THEN THE Response_Guard SHALL mempertahankan nilai `gross_margin_percentage` dari model, dengan tetap menerapkan *clamp* ke rentang 0–100 sesuai Requirement 12 kriteria 4.

### Requirement 7: Komponen Smart Target Market & Positioning Mapper (Modul_1)

**User Story:** Sebagai founder, saya ingin mengetahui segmen pasar lokal paling potensial dan kanal distribusinya, agar anggaran pemasaran saya tepat sasaran.

#### Acceptance Criteria

1. WHEN hasil Langkah_1 telah lolos Response_Guard, THE Rintisin_App SHALL menampilkan `primary_segment` pada Dashboard dalam satu Card yang berisi empat bagian: label persona (`persona_label`), daya beli (`purchasing_power`), daftar pain point utama (`core_pain_points`) sebagai daftar butir sesuai urutan array dari model, dan perilaku pembelian (`buying_behavior`).
2. WHEN hasil Langkah_1 telah lolos Response_Guard, THE Rintisin_App SHALL menampilkan `effective_channels` pada Dashboard dalam Table dengan kolom nomor prioritas (`priority`), nama kanal (`channel_name`), dan strategi (`strategy`), dengan satu baris per elemen, diurutkan berdasarkan `priority` menaik sehingga baris pertama memiliki `priority` 1.
3. IF nilai `priority` pada `effective_channels`, setelah diurutkan menaik, tidak membentuk deret bilangan bulat tepat 1, 2, …, N (N = jumlah elemen `effective_channels`), termasuk karena ada nilai duplikat, ada celah nomor, atau deret tidak dimulai dari 1, THEN THE Response_Guard SHALL mengurutkan elemen berdasarkan nilai `priority` asli dari model secara menaik, mengurutkan elemen dengan nilai `priority` sama berdasarkan posisi indeksnya pada array dari model, lalu menomori ulang `priority` menjadi 1..N tanpa mengubah `channel_name` dan `strategy` maupun menghapus elemen.
4. IF `core_pain_points` berisi lebih dari 5 elemen atau `effective_channels` berisi lebih dari 5 elemen, THEN THE Response_Guard SHALL mempertahankan hanya 5 elemen pertama, yaitu 5 elemen pertama sesuai urutan array dari model untuk `core_pain_points` dan 5 elemen dengan `priority` 1–5 setelah penomoran ulang untuk `effective_channels`, sebelum data disimpan ke Module1_Analysis.
5. IF `core_pain_points` atau `effective_channels` berupa array kosong setelah diproses Response_Guard, THEN THE Rintisin_App SHALL menampilkan teks Nilai_Default yang menyatakan data tidak tersedia di posisi daftar atau Table tersebut, dan tetap menampilkan field lain dari `primary_segment` yang berisi nilai.

### Requirement 8: Komponen Product Concept vs Competitor Matrix (Modul_1)

**User Story:** Sebagai founder, saya ingin membandingkan konsep produk saya dengan pemain lokal yang sudah ada, agar saya dapat memposisikan produk tanpa terjebak perang harga.

#### Acceptance Criteria

1. WHEN hasil Langkah_2 yang lolos Response_Guard tersedia pada Module1_Analysis, THE Rintisin_App SHALL menampilkan `recommended_uvp` dalam satu Card tersendiri yang ditempatkan di atas `comparison_table`, selebar area komponen Competitor Matrix, dengan ukuran huruf teks UVP lebih besar daripada ukuran huruf isi `comparison_table`, dan dengan teks `recommended_uvp` ditampilkan utuh tanpa pemotongan.
2. WHEN hasil Langkah_2 yang lolos Response_Guard tersedia pada Module1_Analysis, THE Rintisin_App SHALL menampilkan `comparison_table` sebagai Table dengan tepat empat kolom berurutan: atribut, konsep pengguna, pemain lokal (*local incumbents*), dan keunggulan kompetitif, dengan satu baris untuk setiap entri `comparison_table` dalam urutan yang sama dengan data yang tersimpan.
3. THE Rintisin_App SHALL menampilkan seluruh teks setiap sel `comparison_table` tanpa pemotongan, dan pada lebar viewport kurang dari 768 piksel THE Rintisin_App SHALL membuat Table dapat digulir secara horizontal tanpa mengubah urutan atau jumlah kolom.
4. WHILE Langkah_2 sedang berjalan untuk Module1_Analysis yang ditampilkan, THE Rintisin_App SHALL menampilkan indikator pemuatan berbahasa Indonesia pada posisi Card `recommended_uvp` dan `comparison_table`, sambil tetap menampilkan hasil Langkah_1.
5. IF `comparison_table` berisi 0 entri, THEN THE Rintisin_App SHALL menampilkan keadaan kosong (*empty state*) berbahasa Indonesia sebagai pengganti Table dan tetap menampilkan Card `recommended_uvp`.

### Requirement 9: Komponen GTM Readiness Score & Action Plan (Modul_1)

**User Story:** Sebagai founder, saya ingin mengetahui skor kesiapan go-to-market dan langkah prioritas mingguan, agar saya tahu apa yang wajib diperbaiki sebelum produksi massal.

#### Acceptance Criteria

1. WHEN THE Rintisin_App merender komponen GTM Readiness dari objek `gtm_readiness`, THE Rintisin_App SHALL menampilkan `overall_score` pada Gauge/Radial Bar berskala 0–100. Busur Gauge/Radial Bar terisi sebanding dengan nilai `overall_score`, dan labelnya berupa bilangan bulat yang diikuti tanda "%" (contoh: "72%").
2. WHEN THE Rintisin_App merender komponen GTM Readiness, THE Rintisin_App SHALL menampilkan `readiness_verdict` tanpa perubahan teks sebagai teks putusan. Teks ini berada di dalam Card yang sama dengan Gauge/Radial Bar `overall_score` dan diletakkan bersebelahan dengan skor tersebut.
3. WHEN THE Rintisin_App merender komponen GTM Readiness, THE Rintisin_App SHALL menampilkan setiap elemen `mandatory_revisions` sebagai satu butir daftar periksa (*checklist*) bertanda kotak centang, dengan urutan butir sama dengan urutan elemen pada array.
4. WHEN THE Rintisin_App merender komponen GTM Readiness, THE Rintisin_App SHALL menampilkan setiap elemen `priority_action_plan` sebagai satu langkah yang memuat `step_number`, `phase`, dan `action`, diurutkan berdasarkan `step_number` secara menaik.
5. IF `priority_action_plan` berisi nilai `step_number` yang duplikat atau tidak berurutan, THEN THE Response_Guard SHALL menomori ulang `step_number` menjadi 1..N dengan mempertahankan urutan relatif dari model.
6. IF `mandatory_revisions` atau `priority_action_plan` berupa array kosong, THEN THE Rintisin_App SHALL menampilkan keadaan kosong (*empty state*) berbahasa Indonesia di posisi daftar yang kosong tersebut, dan tetap menampilkan Gauge/Radial Bar `overall_score` serta `readiness_verdict`.

### Requirement 10: Persistensi dan Riwayat Analisis Modul_1

**User Story:** Sebagai pengguna, saya ingin membuka kembali analisis ide produk yang pernah saya jalankan, agar saya tidak perlu mengulang analisis dan kuota AI tidak terbuang.

#### Acceptance Criteria

1. THE Database SHALL menyimpan setiap Module1_Analysis beserta `user_id` pemilik, keempat input Idea_Form (Draf Ide Produk, Kategori_Ekraf, Estimasi Modal Awal, Lokasi/Kota Target Pasar), hasil Langkah_1 (JSONB), hasil Langkah_2 (JSONB), status Langkah_1 dan status Langkah_2 (masing-masing bernilai salah satu dari: belum dijalankan, sedang diproses, berhasil, atau gagal), flag `is_degraded`, dan waktu pembuatan.
2. WHEN pengguna membuka halaman riwayat Modul_1, THE Rintisin_App SHALL menampilkan daftar yang hanya berisi Module1_Analysis milik pengguna aktif, diurutkan menurun berdasarkan waktu pembuatan. Setiap entri memuat waktu pembuatan, Kategori_Ekraf, Lokasi/Kota Target Pasar, maksimal 80 karakter pertama Draf Ide Produk, serta status Langkah_1 dan status Langkah_2.
3. WHEN pengguna membuka satu Module1_Analysis dari riwayat, THE Rintisin_App SHALL merender Dashboard dari JSON yang tersimpan tanpa memanggil Groq_Client dan tanpa mengubah baris Module1_Analysis tersebut. Komponen setiap langkah berstatus berhasil dirender dari hasil JSON-nya, penanda Hasil_Terdegradasi ditampilkan jika `is_degraded = true`, dan jika Langkah_2 berstatus gagal, hasil Langkah_1 ditampilkan bersama pesan galat Langkah_2 dan tombol "Coba Lagi Langkah 2" sesuai Requirement 5 kriteria 7.
4. WHEN pengguna memilih aksi hapus pada satu Module1_Analysis miliknya yang tidak memiliki langkah berstatus sedang diproses, THE Rintisin_App SHALL menampilkan dialog konfirmasi. Baris tersebut dihapus dari Database dan entrinya dihilangkan dari daftar riwayat tanpa memuat ulang halaman hanya setelah pengguna mengonfirmasi. Jika pengguna membatalkan, Database dan daftar riwayat tidak berubah.
5. IF pengguna belum memiliki satu pun Module1_Analysis, THEN THE Rintisin_App SHALL menampilkan pesan dalam Bahasa Indonesia bahwa riwayat masih kosong, beserta tautan ke Idea_Form.
6. IF Module1_Analysis yang dibuka tidak ditemukan di Database atau bukan milik pengguna aktif, THEN THE Rintisin_App SHALL menampilkan pesan galat dalam Bahasa Indonesia yang menyatakan analisis tidak tersedia, tanpa menampilkan data apa pun dari baris tersebut dan tanpa memanggil Groq_Client.
7. IF penghapusan Module1_Analysis gagal di Database, THEN THE Rintisin_App SHALL menampilkan pesan galat dalam Bahasa Indonesia yang menyatakan penghapusan gagal, serta tetap mempertahankan entri tersebut di daftar riwayat dan barisnya di Database.

### Requirement 11: Groq_Client dengan Auto-Fallback Model

**User Story:** Sebagai operator platform berbiaya nol, saya ingin sistem otomatis berpindah ke model cadangan saat kuota model utama habis, agar layanan tetap berjalan dalam batas Free Tier.

#### Acceptance Criteria

1. THE Groq_Client SHALL menyertakan `response_format: {"type": "json_object"}` pada setiap panggilan ke Model_Primer dan Model_Fallback, termasuk panggilan ulang ke Model_Fallback akibat auto-fallback.
2. WHEN Model_Primer mengembalikan HTTP 429, THE Groq_Client SHALL mengirim ulang permintaan ke Model_Fallback tepat satu kali, dengan pesan prompt, parameter, dan `response_format` yang identik dengan permintaan ke Model_Primer, tanpa percobaan ulang tambahan ke Model_Primer pada pemanggilan yang sama.
3. IF Model_Fallback mengembalikan HTTP 429, baik sebagai panggilan ulang auto-fallback maupun sebagai panggilan langsung pada Fase_Map, THEN THE Groq_Client SHALL menghentikan pemanggilan tanpa percobaan ulang lebih lanjut dan mengembalikan galat bertipe kuota.
4. IF total durasi satu pemanggilan Groq_Client, dihitung sejak permintaan pertama dikirim dan termasuk panggilan ulang ke Model_Fallback, mencapai 8 detik tanpa respons lengkap, THEN THE Groq_Client SHALL membatalkan panggilan yang sedang berjalan, tidak mengirim permintaan ke model lain, dan mengembalikan galat bertipe timeout dalam waktu kurang dari 10 detik sejak permintaan pertama dikirim.
5. IF Groq mengembalikan HTTP 5xx, HTTP 4xx selain 429, atau galat jaringan (koneksi gagal atau terputus sebelum respons lengkap diterima), THEN THE Groq_Client SHALL mengembalikan galat bertipe layanan tanpa mengirim ulang permintaan ke Model_Fallback.
6. WHEN Groq_Client mengembalikan galat bertipe layanan atau timeout, THE Rintisin_App SHALL menampilkan pesan galat dalam Bahasa Indonesia yang menyatakan layanan AI sedang tidak tersedia, tanpa memuat kode status HTTP, nama model, API key, isi respons mentah Groq, maupun stack trace.
7. WHEN Groq_Client mengembalikan galat bertipe kuota, THE Rintisin_App SHALL menampilkan pesan "Kuota AI sedang penuh. Silakan coba lagi beberapa saat lagi."
8. WHEN sebuah hasil analisis disimpan ke Database, THE Groq_Client SHALL mencatat nama model yang menghasilkan respons yang diterima (`openai/gpt-oss-120b` atau `openai/gpt-oss-20b`) secara terpisah untuk setiap panggilan AI, yaitu Langkah_1 dan Langkah_2 pada Module1_Analysis, serta Fase_Map per kompetitor dan Fase_Reduce pada Radar_Job.

### Requirement 12: Response_Guard — Validasi JSON Ketat dan Anti-Crash UI

**User Story:** Sebagai pengguna, saya ingin dashboard tetap tampil meskipun respons AI tidak sempurna, agar aplikasi tidak pernah crash di layar saya.

#### Acceptance Criteria

1. WHEN Groq_Client mengembalikan teks respons dari Groq, THE Response_Guard SHALL memprosesnya dengan urutan berikut sebelum data disimpan ke Database atau dirender oleh Rintisin_App: parse JSON, validasi dengan skema Zod yang sesuai untuk langkah atau fase tersebut, membuang field yang tidak didefinisikan dalam skema, konversi tipe (kriteria 3), *clamp* (kriteria 4), lalu pengisian Nilai_Default (kriteria 5).
2. IF teks respons Groq tidak dapat di-parse sebagai JSON dan sisa waktu permintaan server saat itu masih lebih besar atau sama dengan batas waktu panggilan Groq yang ditetapkan di dokumen desain (dalam batas 10 detik per permintaan server), THEN THE Response_Guard SHALL mengirim ulang permintaan yang sama melalui Groq_Client tepat satu kali, dengan maksimal 1 percobaan ulang (*retry*) per panggilan.
3. IF sebuah field pada respons JSON berisi string yang setelah spasi di awal dan akhir dihapus hanya terdiri dari digit dengan tanda minus opsional di depan dan maksimal satu titik desimal (misalnya `"85"` atau `"12.5"`) sementara skema mengharuskan tipe angka, atau berisi string `"true"`/`"false"` sementara skema mengharuskan tipe boolean, THEN THE Response_Guard SHALL mengonversi field tersebut ke tipe yang ditentukan skema tanpa menandai hasil sebagai Hasil_Terdegradasi; string dengan karakter lain (misalnya `"Rp 1.200.000"` atau `"85%"`) SHALL diperlakukan sebagai tidak valid.
4. IF field angka berskala 0–100 bernilai berhingga (*finite*) di bawah 0 atau di atas 100, THEN THE Response_Guard SHALL mengubah nilai di bawah 0 menjadi 0 dan nilai di atas 100 menjadi 100 tanpa menandai hasil sebagai Hasil_Terdegradasi, sedangkan nilai `NaN` atau tak berhingga SHALL diperlakukan sebagai tidak valid.
5. IF field wajib masih hilang atau tidak valid setelah langkah konversi tipe dan *clamp*, THEN THE Response_Guard SHALL mengisi hanya field tersebut dengan Nilai_Default, mempertahankan field lain yang valid, dan menetapkan flag `is_degraded = true` pada hasil sehingga hasil menjadi Hasil_Terdegradasi.
6. WHILE hasil yang ditampilkan memiliki flag `is_degraded = true`, THE Rintisin_App SHALL menampilkan pemberitahuan "Sebagian data analisis tidak lengkap" pada Dashboard, termasuk saat hasil dibuka dari riwayat; WHILE flag `is_degraded = false`, THE Rintisin_App SHALL tidak menampilkan pemberitahuan tersebut.
7. WHEN Rintisin_App membaca JSON hasil Modul_1 atau Modul_2 dari Database, THE Rintisin_App SHALL memvalidasi ulang JSON tersebut dengan skema Zod yang sama sebelum merender komponen Recharts.
8. WHEN sebuah array hasil (misalnya `operational_risks` atau `competitors_breakdown`) berisi 0 elemen, termasuk karena diisi Nilai_Default, THE Rintisin_App SHALL menampilkan keadaan kosong (*empty state*) berbahasa Indonesia sebagai pengganti grafik atau tabel, tanpa merender komponen Recharts untuk array tersebut.
9. FOR ALL objek hasil Modul_1 dan Modul_2 yang lolos skema Zod, serialisasi ke JSON lalu parse ulang dengan skema yang sama SHALL menghasilkan objek yang setara secara mendalam (*deep equal*) dengan objek awal (properti *round-trip*).
10. FOR ALL objek JSON sembarang (termasuk tipe salah, field hilang, field tambahan, dan nilai `null`), keluaran Response_Guard SHALL selalu lolos skema Zod target tanpa melempar *exception* dan tanpa memuat field yang tidak didefinisikan dalam skema (properti totalitas *anti-crash*).
11. IF teks respons Groq tetap tidak dapat di-parse sebagai JSON setelah satu kali percobaan ulang, atau percobaan ulang dilewati karena sisa waktu permintaan server lebih kecil dari batas waktu panggilan Groq yang ditetapkan di dokumen desain, THEN THE Response_Guard SHALL menghasilkan objek yang seluruh field wajibnya berisi Nilai_Default dan menetapkan flag `is_degraded = true`, tanpa melempar *exception* ke Rintisin_App.
12. IF JSON yang dibaca dari Database tidak lolos validasi ulang skema Zod, THEN THE Rintisin_App SHALL menerapkan aturan konversi tipe, *clamp*, dan Nilai_Default yang sama seperti kriteria 3–5 pada data yang akan dirender, menampilkan Dashboard beserta pemberitahuan "Sebagian data analisis tidak lengkap", dan tidak menampilkan halaman galat atau layar kosong.

### Requirement 13: Input dan Validasi Competitor_Form (Modul_2)

**User Story:** Sebagai pemilik toko fisik, saya ingin memasukkan hingga 3 URL Google Maps kompetitor, agar sistem dapat menganalisis ulasan pelanggan mereka.

#### Acceptance Criteria

1. THE Competitor_Form SHALL menampilkan 1 field URL kompetitor saat pertama kali dimuat, mengizinkan pengguna menambah field hingga total maksimal 3 field, dan tidak mengizinkan jumlah field kurang dari 1.
2. IF sebuah field URL yang tidak kosong, setelah spasi di awal dan akhir dihapus, tidak cocok dengan salah satu format Maps_URL atau panjangnya lebih dari 2.048 karakter, THEN THE Competitor_Form SHALL menolak pengiriman, menampilkan pesan validasi yang menunjukkan format URL tidak valid tepat pada field tersebut, dan mempertahankan nilai semua field yang sudah diisi pengguna.
3. IF dua atau lebih URL yang dikirim identik setelah spasi di awal dan akhir dihapus serta skema dan domain diubah menjadi huruf kecil, THEN THE Competitor_Form SHALL menolak pengiriman, menampilkan pesan URL duplikat pada setiap field yang duplikat, dan mempertahankan nilai semua field yang sudah diisi pengguna.
4. WHEN Rintisin_App menerima pengiriman Competitor_Form, THE Rintisin_App SHALL memvalidasi ulang jumlah URL (1–3), format Maps_URL, panjang URL (maksimal 2.048 karakter), dan duplikasi URL di sisi server dengan skema Zod yang sama dengan Competitor_Form sebelum membuat Radar_Job.
5. IF validasi sisi server pada kriteria 4 gagal, THEN THE Rintisin_App SHALL tidak membuat Radar_Job dan mengembalikan pesan kesalahan yang menunjukkan field URL mana yang tidak valid beserta alasannya, lalu Competitor_Form menampilkan pesan tersebut pada field terkait.
6. WHILE terdapat Radar_Job milik pengguna dengan Job_Status `PENDING`, `SCRAPING`, atau `ANALYZING`, THE Competitor_Form SHALL menonaktifkan tombol "Analisis 3 Kompetitor".
7. IF Rintisin_App menerima pengiriman Competitor_Form dari pengguna yang masih memiliki Radar_Job dengan Job_Status `PENDING`, `SCRAPING`, atau `ANALYZING`, THEN THE Rintisin_App SHALL menolak pengiriman tanpa membuat Radar_Job baru dan mengembalikan pesan kesalahan yang menunjukkan masih ada analisis yang sedang berjalan.
8. WHEN Radar_Job aktif milik pengguna mencapai Status_Terminal, THE Competitor_Form SHALL mengaktifkan kembali tombol "Analisis 3 Kompetitor" dalam waktu paling lama 5 detik setelah perubahan Job_Status diterima melalui Realtime_Channel.

### Requirement 14: Pembuatan dan Dispatch Radar_Job (Modul_2)

**User Story:** Sebagai pengguna, saya ingin analisis kompetitor berjalan di latar belakang, agar halaman tidak terkena batas waktu 10 detik Vercel.

#### Acceptance Criteria

1. WHEN pengguna menekan tombol "Analisis 3 Kompetitor" pada Competitor_Form yang berisi 1 hingga 3 Maps_URL valid, THE Rintisin_App SHALL membuat tepat satu Radar_Job di Database yang berisi `user_id` dari sesi Auth_Service pengguna yang sedang login (bukan dari input formulir), daftar Maps_URL sesuai urutan input, dan Job_Status `PENDING`.
2. WHEN Radar_Job berhasil dibuat di Database, THE Rintisin_App SHALL mengirim tepat satu permintaan dispatch berisi `radar_id` ke endpoint Scraper_Worker dengan header Worker_Secret, dan hanya menunggu respons penerimaan dari Scraper_Worker tanpa menunggu proses scraping, Pre_Filter, Fase_Map, atau Fase_Reduce selesai.
3. WHEN Rintisin_App menerima respons berstatus 2xx dari Scraper_Worker dalam waktu maksimal 5 detik sejak permintaan dispatch dikirim, THE Rintisin_App SHALL memperbarui Job_Status Radar_Job tersebut dari `PENDING` menjadi `SCRAPING`.
4. IF Scraper_Worker tidak merespons permintaan dispatch dalam waktu 5 detik sejak permintaan dikirim, atau merespons dengan status selain 2xx, atau koneksi ke Scraper_Worker gagal, THEN THE Rintisin_App SHALL memperbarui Job_Status menjadi `FAILED` dengan pesan galat "Server analisis sedang tidak tersedia. Silakan coba lagi.", tetap menyimpan baris Radar_Job beserta daftar Maps_URL-nya, dan tidak melakukan dispatch ulang secara otomatis.
5. THE Rintisin_App SHALL menjalankan seluruh proses scraping dan browser headless hanya di Scraper_Worker, dan tidak pernah di dalam route handler atau Server Action Next.js.
6. IF Database gagal menyimpan Radar_Job, THEN THE Rintisin_App SHALL tidak mengirim permintaan dispatch ke Scraper_Worker, menampilkan pesan galat yang menyatakan bahwa analisis gagal dimulai, dan mempertahankan Maps_URL yang telah diisi pengguna di Competitor_Form.
7. WHILE permintaan pembuatan dan dispatch Radar_Job sedang diproses, THE Rintisin_App SHALL menonaktifkan tombol "Analisis 3 Kompetitor" sehingga satu kali penekanan tombol menghasilkan maksimal satu Radar_Job.
8. WHEN Rintisin_App selesai memproses dispatch dengan hasil Job_Status `SCRAPING` atau `FAILED`, THE Rintisin_App SHALL mengembalikan `radar_id` dan Job_Status terkini ke antarmuka pengguna dalam waktu maksimal 8 detik sejak tombol "Analisis 3 Kompetitor" ditekan.

### Requirement 15: Autentikasi dan Keamanan Scraper_Worker

**User Story:** Sebagai operator platform, saya ingin endpoint worker yang terekspos publik terlindungi, agar pihak lain tidak dapat menyalahgunakan worker maupun kuota Groq.

#### Acceptance Criteria

1. IF permintaan ke Scraper_Worker tidak menyertakan Worker_Secret, menyertakan Worker_Secret kosong, atau menyertakan nilai yang tidak identik (peka huruf besar/kecil) dengan Worker_Secret di secrets environment Hugging Face Spaces, THEN THE Scraper_Worker SHALL menolak permintaan dengan HTTP 401 tanpa membaca atau memperbarui baris Radar_Job mana pun, tanpa memulai Akuisisi_Primer maupun Akuisisi_Fallback, dan tanpa memanggil GroqCloud API.
2. IF permintaan dengan Worker_Secret yang valid tidak menyertakan `radar_id`, menyertakan `radar_id` yang tidak ditemukan di Database, atau merujuk Radar_Job dengan Job_Status selain `PENDING` atau `SCRAPING`, THEN THE Scraper_Worker SHALL menolak permintaan dengan respons error yang menunjukkan Radar_Job tidak valid, tanpa memulai Akuisisi_Primer maupun Akuisisi_Fallback, tanpa memanggil GroqCloud API, dan tanpa mengubah Job_Status maupun kolom lain pada baris Radar_Job tersebut.
3. THE Scraper_Worker SHALL membatasi setiap penulisan ke tabel `module2_radars` hanya pada satu baris Radar_Job yang `radar_id`-nya sama dengan `radar_id` pada permintaan yang sedang diproses, sehingga baris Radar_Job lain tidak berubah.
4. WHILE Maps_URL_Parser mengikuti redirect shortlink, THE Maps_URL_Parser SHALL hanya mengikuti redirect berskema `https` yang hostname-nya persis salah satu dari `google.com`, `www.google.com`, `maps.google.com`, `maps.app.goo.gl`, atau `goo.gl`, dengan maksimal 5 redirect per Maps_URL.
5. THE Scraper_Worker SHALL membaca Worker_Secret, kredensial Database, dan GROQ API key hanya dari secrets environment Hugging Face Spaces, dan nilai ketiganya tidak tercantum di kode sumber folder `worker-scraper/` maupun di Docker image.
6. IF redirect shortlink mengarah ke URL dengan skema selain `https`, ke hostname di luar daftar pada kriteria 4, atau jumlah redirect melebihi 5, THEN THE Maps_URL_Parser SHALL menghentikan pengikutan redirect tanpa mengirim permintaan ke URL tujuan tersebut dan tanpa menghasilkan Feature_ID untuk Maps_URL tersebut.
7. IF Worker_Secret, kredensial Database, atau GROQ API key tidak tersedia atau bernilai kosong di secrets environment Hugging Face Spaces, THEN THE Scraper_Worker SHALL menolak setiap permintaan analisis tanpa memulai Akuisisi_Primer maupun Akuisisi_Fallback dan tanpa memanggil GroqCloud API.
8. THE Scraper_Worker SHALL tidak menyertakan nilai Worker_Secret, kredensial Database, maupun GROQ API key di body respons HTTP, pesan error, atau kolom Radar_Job mana pun.

### Requirement 16: Ekstraksi Feature_ID dari Maps_URL

**User Story:** Sebagai sistem, saya perlu mengidentifikasi tempat kompetitor secara pasti dari URL, agar ulasan yang diambil berasal dari bisnis yang tepat.

#### Acceptance Criteria

1. WHEN Maps_URL yang diterima berupa shortlink (`https://maps.app.goo.gl/...` atau `https://goo.gl/maps/...`), THE Maps_URL_Parser SHALL mengikuti redirect sampai mendapatkan URL Google Maps lengkap. Batasnya maksimal 5 lompatan redirect dan total waktu 10 detik per URL. URL Google Maps lengkap adalah URL dengan prefix `https://www.google.com/maps/` atau `https://maps.google.com/`.
2. WHEN URL Google Maps lengkap (dari input langsung atau hasil redirect pada kriteria 1) mengandung Feature_ID, THE Maps_URL_Parser SHALL mengekstrak tepat satu Feature_ID tanpa melakukan permintaan jaringan tambahan. Feature_ID valid berformat `0x<hex>:0x<hex>`, dengan setiap bagian `<hex>` terdiri dari 1–16 digit heksadesimal. Hasil ekstraksi dinormalisasi ke huruf kecil. Jika URL mengandung lebih dari satu Feature_ID, yang dipakai adalah kemunculan pertama.
3. IF redirect shortlink melebihi 5 lompatan, melebihi total waktu 10 detik, gagal karena galat jaringan, atau berakhir di URL yang bukan URL Google Maps lengkap, THEN THE Maps_URL_Parser SHALL menandai kompetitor tersebut gagal dengan alasan "URL Google Maps tidak dapat dikenali" dan tidak mengembalikan Feature_ID.
4. IF URL Google Maps lengkap tidak mengandung substring yang cocok dengan format Feature_ID valid, THEN THE Maps_URL_Parser SHALL menandai kompetitor tersebut gagal dengan alasan "URL Google Maps tidak dapat dikenali" dan tidak mengembalikan Feature_ID.
5. WHEN Maps_URL_Formatter menerima Feature_ID valid, THE Maps_URL_Formatter SHALL menghasilkan URL kanonik berprefix `https://www.google.com/maps/place/` yang memuat Feature_ID tersebut dalam huruf kecil. Untuk Feature_ID yang sama, URL yang dihasilkan selalu identik.
6. IF Maps_URL_Formatter menerima nilai yang tidak memenuhi format Feature_ID valid, THEN THE Maps_URL_Formatter SHALL menolak nilai tersebut dengan error yang menyatakan Feature_ID tidak valid dan tidak menghasilkan URL.
7. FOR ALL Feature_ID yang valid, memformat Feature_ID dengan Maps_URL_Formatter lalu mem-parse hasilnya dengan Maps_URL_Parser SHALL menghasilkan Feature_ID yang sama dengan bentuk huruf kecil dari Feature_ID asal (properti *round-trip*), tanpa permintaan jaringan.

### Requirement 17: Akuisisi Ulasan Zero-Cost

**User Story:** Sebagai operator platform berbiaya nol, saya ingin ulasan kompetitor diambil tanpa API berbayar, agar biaya operasional tetap Rp 0.

#### Acceptance Criteria

1. WHEN Scraper_Worker mulai memproses sebuah kompetitor dalam Radar_Job yang berstatus `SCRAPING`, THE Scraper_Worker SHALL mengambil ulasan kompetitor tersebut menggunakan Akuisisi_Primer dengan parameter urutan Terbaru dan Rating Terendah. Pengambilan dihentikan saat 150 ulasan terkumpul atau saat sumber tidak lagi mengembalikan ulasan baru. Hasil sebanyak 10 hingga 150 ulasan diterima tanpa menjalankan Akuisisi_Fallback.
2. IF Akuisisi_Primer untuk sebuah kompetitor mengalami galat jaringan, menerima respons yang tidak dapat diurai menjadi data ulasan, tidak selesai dalam 30 detik, atau mengembalikan kurang dari 10 ulasan, THEN THE Scraper_Worker SHALL menjalankan Akuisisi_Fallback untuk kompetitor tersebut dan maksimal 1 kali per kompetitor.
3. WHILE Akuisisi_Fallback berjalan, THE Scraper_Worker SHALL memblokir semua permintaan aset gambar (png, jpg, jpeg, webp), aset font, dan tile peta, sehingga tidak ada satu pun permintaan untuk jenis aset tersebut yang diselesaikan.
4. WHILE Akuisisi_Fallback berjalan, THE Scraper_Worker SHALL melakukan scroll otomatis pada panel ulasan maksimal 15 kali dan minimal 10 kali. Scroll boleh dihentikan sebelum batas minimal hanya jika 150 ulasan telah terkumpul. Setelah scroll ke-10, scroll dihentikan jika satu kali scroll tidak menambah ulasan baru.
5. WHEN akuisisi ulasan sebuah kompetitor selesai melalui Akuisisi_Primer atau Akuisisi_Fallback, THE Scraper_Worker SHALL menyertakan nama tempat dan rata-rata rating (angka 1,0–5,0) kompetitor tersebut, yang diambil dari data tempat hasil akuisisi yang sama.
6. THE Scraper_Worker SHALL menjalankan Akuisisi_Primer dan Akuisisi_Fallback tanpa memanggil Google Places API maupun API atau layanan pihak ketiga lain yang memerlukan pembayaran atau kunci API berbayar.
7. IF Akuisisi_Fallback untuk sebuah kompetitor mengalami galat, tidak selesai dalam 120 detik, atau mengembalikan 0 ulasan setelah Akuisisi_Primer juga gagal sesuai kriteria 2, THEN THE Scraper_Worker SHALL menandai kompetitor tersebut gagal beserta alasan yang menyebutkan kategori kegagalan (tempat tidak ditemukan, akses diblokir, batas waktu terlampaui, atau tidak ada ulasan). Pemrosesan kompetitor lain dalam Radar_Job yang sama tetap dilanjutkan.
8. IF Akuisisi_Fallback mengembalikan 1 hingga 9 ulasan untuk sebuah kompetitor, THEN THE Scraper_Worker SHALL memakai himpunan ulasan dengan jumlah terbanyak di antara hasil Akuisisi_Primer dan Akuisisi_Fallback, lalu meneruskannya ke Pre_Filter tanpa menandai kompetitor tersebut gagal.
9. IF nama tempat atau rata-rata rating sebuah kompetitor tidak tersedia pada data tempat hasil akuisisi, THEN THE Scraper_Worker SHALL mengosongkan field yang tidak tersedia, tetap meneruskan ulasan yang terkumpul ke Pre_Filter, dan tidak menandai kompetitor tersebut gagal.

### Requirement 18: Pre_Filter Deterministik Sebelum LLM

**User Story:** Sebagai operator platform, saya ingin ulasan dibersihkan dan diringkas sebelum dikirim ke LLM, agar konsumsi token turun lebih dari 80% dan kualitas analisis meningkat.

#### Acceptance Criteria

1. WHEN Scraper_Worker menyerahkan kumpulan ulasan mentah sebuah kompetitor ke Pre_Filter, THE Pre_Filter SHALL memproses ulasan per kompetitor dengan urutan tahapan tetap: (a) pembersihan menjadi Ulasan_Bersih, (b) normalisasi teks dengan Text_Normalizer, (c) penyaringan ulasan pendek, (d) penghapusan duplikat, dan (e) pembentukan Sampel_Terstratifikasi.
2. WHEN Pre_Filter membersihkan sebuah ulasan mentah, THE Pre_Filter SHALL menghasilkan Ulasan_Bersih yang hanya berisi rating bilangan bulat 1–5 dan teks ulasan. Nama pengguna, URL foto, ID ulasan, ID pengguna, dan tag HTML dibuang, sedangkan teks di antara tag HTML dipertahankan. Tanggal ulasan hanya dipakai untuk pengurutan internal dan tidak disertakan dalam Ulasan_Bersih yang dikirim ke LLM.
3. IF sebuah ulasan mentah tidak memiliki rating, atau rating-nya bukan bilangan bulat dalam rentang 1–5, THEN THE Pre_Filter SHALL membuang ulasan tersebut dan melanjutkan pemrosesan ulasan lainnya tanpa galat.
4. WHEN Text_Normalizer memproses sebuah string teks, THE Text_Normalizer SHALL lebih dulu menghapus seluruh karakter emoji, lalu meringkas setiap rangkaian 3 atau lebih karakter huruf identik yang berurutan menjadi 1 huruf (contoh: "laaaamaaa bangeeet" menjadi "lama banget"), mempertahankan huruf ganda (2 huruf berurutan, misalnya "tunggu"), membiarkan angka dan tanda baca tanpa perubahan, meringkas spasi berurutan menjadi 1 spasi, dan memangkas spasi di awal dan akhir teks.
5. FOR ALL string teks, menerapkan Text_Normalizer dua kali SHALL menghasilkan keluaran yang sama dengan menerapkannya sekali (properti idempoten).
6. IF teks sebuah ulasan setelah dinormalisasi kosong atau berisi 3 kata atau kurang, dengan kata didefinisikan sebagai rangkaian karakter non-spasi yang dipisahkan spasi (misalnya "Mantap", "Enak banget", "Good", "Biasa aja"), THEN THE Pre_Filter SHALL membuang ulasan tersebut. Ulasan dengan 4 kata atau lebih dipertahankan.
7. IF dua atau lebih ulasan pada kompetitor yang sama memiliki teks yang identik setelah dinormalisasi (perbandingan tidak peka huruf besar/kecil, tanpa memperhatikan perbedaan rating), THEN THE Pre_Filter SHALL mempertahankan tepat 1 ulasan, yaitu yang tanggalnya paling baru, dan membuang ulasan lainnya.
8. WHEN Pre_Filter membentuk Sampel_Terstratifikasi untuk sebuah kompetitor, THE Pre_Filter SHALL menetapkan kuota 40 ulasan untuk strata kritis (rating 1–3 dengan panjang teks ternormalisasi lebih dari 30 karakter, termasuk spasi) dan kuota 40 ulasan untuk strata positif (rating 4–5 dengan panjang teks ternormalisasi lebih dari 40 karakter, termasuk spasi), serta mengecualikan ulasan yang tidak memenuhi syarat kedua strata.
9. WHEN Pre_Filter memilih ulasan dari setiap strata, THE Pre_Filter SHALL mengurutkan strata kritis dari teks ternormalisasi terpanjang (jika panjangnya sama, dari tanggal terbaru) dan strata positif dari tanggal terbaru (jika tanggalnya sama, sesuai urutan masukan), lalu mengambil ulasan dari urutan teratas.
10. IF salah satu strata memiliki kurang dari 40 ulasan yang memenuhi syarat, THEN THE Pre_Filter SHALL mengambil seluruh ulasan strata tersebut dan mengisi sisa kuota hingga total 80 ulasan dengan ulasan berikutnya dari strata lainnya sesuai urutan pada kriteria 9, sampai total mencapai 80 atau ulasan strata lainnya habis.
11. FOR ALL kumpulan ulasan masukan, Sampel_Terstratifikasi SHALL berisi tepat min(80, jumlah ulasan yang memenuhi syarat kedua strata) ulasan, hanya berisi ulasan yang berasal dari kumpulan masukan tersebut, dan memuat setiap ulasan paling banyak 1 kali (properti invarian).
12. IF Sampel_Terstratifikasi sebuah kompetitor berisi 0 ulasan setelah Pre_Filter, THEN THE Scraper_Worker SHALL menandai kompetitor tersebut gagal dengan alasan "Ulasan informatif tidak cukup" dan tidak menyertakan kompetitor tersebut ke Fase_Map.

### Requirement 19: Analisis Map-Reduce (Modul_2)

**User Story:** Sebagai pengguna, saya ingin ulasan beberapa kompetitor dianalisis secara efisien lalu digabungkan menjadi satu analisis celah, agar saya mendapat gambaran kompetisi yang utuh.

#### Acceptance Criteria

1. WHEN Pre_Filter menghasilkan Sampel_Terstratifikasi berisi minimal 1 ulasan untuk kompetitor pertama dalam Radar_Job, THE Scraper_Worker SHALL memperbarui Job_Status dari `SCRAPING` menjadi `ANALYZING` tepat satu kali, sebelum panggilan Fase_Map pertama dikirim.
2. WHILE Job_Status adalah `ANALYZING`, THE Scraper_Worker SHALL menjalankan Fase_Map secara paralel dengan satu panggilan Model_Fallback per kompetitor yang tidak ditandai gagal (tidak termasuk percobaan ulang sesuai Requirement 12), dengan masukan hanya Sampel_Terstratifikasi milik kompetitor tersebut, untuk menghasilkan daftar kekuatan, daftar kelemahan, skor aspek berskala 0–100, dan keluhan utama.
3. WHEN setiap kompetitor yang diproses Fase_Map sudah memiliki keluaran Fase_Map yang tervalidasi atau sudah ditandai gagal, dan minimal 1 keluaran Fase_Map tervalidasi tersedia, THE Scraper_Worker SHALL menjalankan tepat satu Fase_Reduce menggunakan Model_Primer, dengan masukan gabungan keluaran Fase_Map berukuran paling banyak 1.000 token, untuk menghasilkan `market_overview`, `competitors_breakdown`, dan `steal_the_market_playbook`.
4. IF Model_Primer mengembalikan HTTP 429 pada Fase_Reduce, THEN THE Scraper_Worker SHALL mengirim ulang permintaan Fase_Reduce dengan masukan yang sama ke Model_Fallback sebanyak satu kali.
5. THE Scraper_Worker SHALL memvalidasi setiap keluaran Fase_Map sebelum dipakai sebagai masukan Fase_Reduce, dan setiap keluaran Fase_Reduce sebelum disimpan ke Radar_Job, dengan skema yang setara dengan skema Zod Modul_2. Validasi ini menerapkan aturan perbaikan, satu kali percobaan ulang, *clamp* 0–100, dan Nilai_Default yang sama dengan Requirement 12, lalu menetapkan `is_degraded = true` pada Radar_Job jika minimal 1 field diisi Nilai_Default.
6. THE Scraper_Worker SHALL menetapkan `total_reviews_analyzed` sebagai bilangan bulat 0–240 yang sama dengan jumlah ulasan dalam Sampel_Terstratifikasi seluruh kompetitor yang keluaran Fase_Map-nya tervalidasi. Nilai `total_reviews_analyzed` dari LLM SHALL diabaikan.
7. THE Scraper_Worker SHALL menyusun `competitors_breakdown` dengan tepat satu entri untuk setiap kompetitor yang keluaran Fase_Map-nya tervalidasi, lalu menimpa `competitor_name` dan `avg_rating` (rentang 0,0–5,0) pada setiap entri dengan nama tempat dan rata-rata rating dari data hasil akuisisi (Requirement 17). Nilai kedua field tersebut dari LLM SHALL diabaikan.
8. IF jumlah nilai `positive`, `neutral`, dan `negative` pada `sentiment_distribution` tidak sama dengan 100, THEN THE Scraper_Worker SHALL menormalisasi ketiga nilai tersebut menjadi bilangan bulat 0–100 yang berjumlah tepat 100 tanpa mengubah urutan besar-kecil relatifnya. Jika ketiga nilai bernilai 0, THE Scraper_Worker SHALL menerapkan Nilai_Default dan menandai hasil sebagai Hasil_Terdegradasi.
9. THE Scraper_Worker SHALL menyertakan instruksi pada setiap prompt Fase_Map dan Fase_Reduce agar model menulis seluruh nilai teks dalam Bahasa Indonesia yang profesional dan dapat langsung ditindaklanjuti.
10. IF panggilan Fase_Map untuk sebuah kompetitor mengembalikan galat atau HTTP 429, atau keluarannya tetap tidak dapat di-parse sebagai JSON setelah satu kali percobaan ulang, THEN THE Scraper_Worker SHALL menandai kompetitor tersebut gagal dengan alasan berbahasa Indonesia yang menyatakan analisis ulasan gagal, lalu mengecualikan kompetitor tersebut dari masukan Fase_Reduce, `competitors_breakdown`, dan `total_reviews_analyzed`.
11. IF Fase_Map gagal untuk seluruh kompetitor dalam Radar_Job, THEN THE Scraper_Worker SHALL memperbarui Job_Status menjadi `FAILED` dengan pesan galat berbahasa Indonesia yang menyebutkan alasan per kompetitor, tanpa menjalankan Fase_Reduce.
12. IF permintaan ulang Fase_Reduce ke Model_Fallback juga mengembalikan HTTP 429 atau galat, THEN THE Scraper_Worker SHALL memperbarui Job_Status menjadi `FAILED` dengan pesan galat berbahasa Indonesia yang menyatakan analisis gabungan gagal, tanpa menyimpan hasil Fase_Reduce parsial ke Radar_Job.

### Requirement 20: Penyelesaian dan Kegagalan Radar_Job

**User Story:** Sebagai pengguna, saya ingin tahu dengan jelas apakah analisis kompetitor berhasil atau gagal beserta alasannya, agar saya bisa mengambil tindakan selanjutnya.

#### Acceptance Criteria

1. WHEN Fase_Reduce menghasilkan JSON yang lolos validasi Response_Guard (termasuk Hasil_Terdegradasi), THE Scraper_Worker SHALL menyimpan JSON hasil, flag `is_degraded`, dan Job_Status `COMPLETED` ke Radar_Job dalam satu operasi update, sehingga tidak ada kondisi tersimpan di mana Job_Status `COMPLETED` tanpa JSON hasil atau JSON hasil tanpa Job_Status `COMPLETED`.
2. IF seluruh kompetitor dalam Radar_Job gagal, yaitu setiap kompetitor gagal pada Akuisisi_Primer dan Akuisisi_Fallback, atau Pre_Filter menghasilkan 0 Ulasan_Bersih untuk kompetitor tersebut, THEN THE Scraper_Worker SHALL tidak menjalankan Fase_Map maupun Fase_Reduce dan SHALL memperbarui Job_Status menjadi `FAILED` dengan pesan galat berbahasa Indonesia yang menyebutkan, untuk setiap kompetitor, Maps_URL yang diinput pengguna beserta alasan kegagalannya (gagal mengambil ulasan atau tidak ada ulasan yang memenuhi kriteria).
3. IF sebagian kompetitor gagal sesuai definisi pada kriteria 2 dan minimal 1 kompetitor berhasil, THEN THE Scraper_Worker SHALL menjalankan Fase_Map dan Fase_Reduce hanya untuk kompetitor yang berhasil, dan SHALL menyimpan ke Radar_Job daftar kompetitor yang gagal, yang berisi Maps_URL yang diinput pengguna dan alasan kegagalan berbahasa Indonesia untuk setiap kompetitor tersebut.
4. IF terjadi galat tak tertangani di Scraper_Worker setelah dispatch diterima, THEN THE Scraper_Worker SHALL memperbarui Job_Status menjadi `FAILED` dengan pesan galat umum berbahasa Indonesia yang tidak memuat *stack trace*, nama *exception*, path file, maupun nilai Worker_Secret.
5. IF Job_Status yang tersimpan pada sebuah Radar_Job belum berupa Status_Terminal dan sudah lewat lebih dari 300 detik sejak Radar_Job dibuat, THEN THE Rintisin_App SHALL menampilkan Radar_Job tersebut sebagai `FAILED` dengan pesan "Analisis melebihi batas waktu. Silakan coba lagi." Kondisi ini berlaku saat halaman dimuat dan juga saat pengguna sedang melihat halaman pada detik ke-300, tanpa perlu menunggu event dari Realtime_Channel.
6. WHILE Job_Status sebuah Radar_Job adalah `FAILED` (tersimpan maupun karena batas waktu pada kriteria 5), THE Rintisin_App SHALL menampilkan pesan galat beserta tombol "Coba Lagi". Saat tombol ditekan, Rintisin_App SHALL membuat tepat 1 Radar_Job baru dengan Job_Status `PENDING`, berisi seluruh Maps_URL yang sama dengan urutan yang sama seperti Radar_Job asal, tanpa mengubah Radar_Job asal, lalu menampilkan status Radar_Job baru tersebut kepada pengguna.
7. IF panggilan Fase_Reduce gagal mengembalikan respons dari Model_Primer maupun Model_Fallback, THEN THE Scraper_Worker SHALL memperbarui Job_Status menjadi `FAILED` dengan pesan galat berbahasa Indonesia yang menyatakan bahwa analisis AI gagal diselesaikan, dan SHALL tidak menyimpan JSON hasil parsial ke Radar_Job.
8. WHILE Job_Status sebuah Radar_Job adalah `COMPLETED` dan daftar kompetitor yang gagal pada Radar_Job tersebut berisi minimal 1 entri, THE Rintisin_App SHALL menampilkan setiap kompetitor yang gagal (Maps_URL dan alasan kegagalannya) di Dashboard bersama hasil analisis kompetitor yang berhasil.
9. IF pembuatan Radar_Job baru melalui tombol "Coba Lagi" gagal, THEN THE Rintisin_App SHALL menampilkan pesan galat berbahasa Indonesia yang menyatakan bahwa percobaan ulang gagal, SHALL tetap menampilkan Radar_Job asal beserta tombol "Coba Lagi", dan SHALL menonaktifkan tombol tersebut selama permintaan pembuatan masih diproses agar tidak terbentuk lebih dari 1 Radar_Job baru per tekan.

### Requirement 21: Pelacakan Status Real-Time (Modul_2)

**User Story:** Sebagai pengguna, saya ingin melihat progres analisis kompetitor secara langsung, agar saya tahu tahapan yang sedang berjalan tanpa me-refresh halaman.

#### Acceptance Criteria

1. WHEN pengguna membuka halaman sebuah Radar_Job, THE Rintisin_App SHALL membaca baris Radar_Job tersebut satu kali dari Database dan menampilkan indikator progres empat tahap berurutan `PENDING` → `SCRAPING` → `ANALYZING` → `COMPLETED`/`FAILED`. Setiap Job_Status memiliki tepat satu label Bahasa Indonesia, dan tahap selesai, tahap aktif, serta tahap belum berjalan dibedakan melalui teks atau ikon, tidak hanya melalui warna.
2. WHILE Radar_Job yang sedang ditampilkan belum mencapai Status_Terminal, THE Rintisin_App SHALL mempertahankan tepat satu langganan Realtime_Channel yang difilter berdasarkan `radar_id` Radar_Job tersebut, tanpa melakukan polling berkala ke Database.
3. WHEN Realtime_Channel menerima perubahan Job_Status untuk `radar_id` yang sedang ditampilkan, THE Rintisin_App SHALL memperbarui indikator progres dalam waktu maksimal 2 detik sejak perubahan diterima, tanpa memuat ulang halaman. Perubahan yang Job_Status-nya berada pada tahap lebih awal daripada Job_Status yang sedang ditampilkan (urutan: `PENDING` < `SCRAPING` < `ANALYZING` < Status_Terminal) SHALL diabaikan.
4. WHEN Realtime_Channel terhubung kembali setelah koneksi terputus, THE Rintisin_App SHALL membaca baris Radar_Job satu kali dari Database, menampilkan Job_Status hasil pembacaan tersebut pada indikator progres, dan menghapus pemberitahuan koneksi terputus.
5. WHEN Radar_Job yang ditampilkan mencapai Status_Terminal, atau pengguna meninggalkan halaman Radar_Job tersebut, THE Rintisin_App SHALL berhenti berlangganan Realtime_Channel untuk Radar_Job tersebut, sehingga tidak ada langganan aktif yang tersisa untuk `radar_id` itu.
6. WHEN Job_Status yang ditampilkan menjadi `COMPLETED`, baik dari pembacaan awal, pembacaan sinkronisasi, maupun Realtime_Channel, THE Rintisin_App SHALL memvalidasi JSON hasil Radar_Job dengan skema Zod, lalu merender komponen Gap Analysis Matrix dan Steal-the-Market Playbook dari JSON yang lolos validasi, tanpa memuat ulang halaman.
7. IF Realtime_Channel terputus saat Radar_Job yang ditampilkan belum mencapai Status_Terminal, THEN THE Rintisin_App SHALL menampilkan pemberitahuan berbahasa Indonesia bahwa koneksi pembaruan status terputus, paling lambat 5 detik setelah pemutusan terdeteksi. Selama itu, indikator progres tetap menampilkan Job_Status terakhir yang diketahui, dan Job_Status tidak diubah menjadi `FAILED` hanya karena koneksi terputus.
8. IF pembacaan baris Radar_Job pada kriteria 1 atau 4 gagal, THEN THE Rintisin_App SHALL mengulang pembacaan maksimal 3 kali dengan jeda 5 detik sambil tetap menampilkan Job_Status terakhir yang diketahui. Jika seluruh percobaan gagal, Rintisin_App SHALL menampilkan pesan galat berbahasa Indonesia bahwa status analisis tidak dapat dimuat.
9. IF JSON hasil Radar_Job berstatus `COMPLETED` tidak lolos validasi skema Zod, THEN THE Rintisin_App SHALL menerapkan aturan pemulihan Requirement 12 kriteria 12 (konversi tipe, *clamp*, Nilai_Default) dan merender Gap Analysis Matrix serta Steal-the-Market Playbook beserta pemberitahuan "Sebagian data analisis tidak lengkap", sambil tetap menampilkan Job_Status `COMPLETED` pada indikator progres.

### Requirement 22: Komponen Automated Competitor Gap Analysis Matrix (Modul_2)

**User Story:** Sebagai pemilik toko, saya ingin membandingkan sentimen dan skor aspek para kompetitor secara visual, agar saya bisa melihat di mana mereka lemah.

#### Acceptance Criteria

1. WHEN Dashboard Modul_2 ditampilkan untuk Radar_Job dengan Job_Status `COMPLETED`, THE Rintisin_App SHALL menampilkan Card `market_overview` yang memuat `total_reviews_analyzed` sebagai bilangan bulat dengan pemisah ribuan titik (contoh: "1.240"), `dominant_market_complaint` sebagai teks keluhan pasar yang dominan, dan `unmet_customer_need` sebagai teks kebutuhan pelanggan yang belum terpenuhi.
2. WHEN Dashboard Modul_2 ditampilkan untuk Radar_Job dengan Job_Status `COMPLETED`, THE Rintisin_App SHALL menampilkan tabel `competitors_breakdown` dengan tepat satu baris untuk setiap elemen `competitors_breakdown` (1–3 baris, sesuai urutan array), yang memuat kolom `competitor_name`, `avg_rating` pada skala 0–5 dengan 1 angka desimal, `sentiment_distribution` sebagai tiga nilai persen bilangan bulat berlabel positif, netral, dan negatif (contoh: "62%"), `core_strengths` sebagai daftar butir, dan `exploitable_weaknesses` sebagai daftar butir.
3. WHEN Dashboard Modul_2 ditampilkan untuk Radar_Job dengan Job_Status `COMPLETED`, THE Rintisin_App SHALL menampilkan Radar Chart dengan tepat 4 sumbu yang mewakili `product_quality`, `pricing_value`, `service_speed`, dan `ambience_facility` dengan label sumbu berbahasa Indonesia, rentang sumbu tetap 0–100 terlepas dari nilai data, dan satu seri data per elemen `competitors_breakdown` (maksimal 3 seri) yang memplot nilai `aspect_scores` tanpa diubah.
4. IF Radar_Job dengan Job_Status `COMPLETED` menyimpan daftar kompetitor gagal yang berisi minimal 1 kompetitor, THEN THE Rintisin_App SHALL menampilkan daftar tersebut di atas tabel `competitors_breakdown` dan Radar Chart, dengan setiap butir memuat Maps_URL yang diinput pengguna dan alasan kegagalan berbahasa Indonesia, serta tidak menampilkan kompetitor gagal tersebut sebagai baris tabel maupun seri Radar Chart.
5. IF `core_strengths` atau `exploitable_weaknesses` pada sebuah elemen `competitors_breakdown` berupa array kosong, THEN THE Rintisin_App SHALL menampilkan teks Nilai_Default "Data tidak tersedia" pada sel tersebut dan tetap menampilkan baris kompetitor beserta kolom lainnya.
6. THE Rintisin_App SHALL memberi setiap seri Radar Chart warna garis yang berbeda satu sama lain dan menampilkan legenda yang mengidentifikasi setiap seri dengan `competitor_name`, dalam urutan yang sama dengan baris tabel `competitors_breakdown`.
7. IF daftar kompetitor gagal pada Radar_Job kosong atau tidak ada, THEN THE Rintisin_App SHALL tidak menampilkan bagian daftar kompetitor gagal pada Dashboard Modul_2.

### Requirement 23: Komponen Exploitable Weakness & Steal-the-Market Playbook (Modul_2)

**User Story:** Sebagai pemilik toko, saya ingin strategi operasional dan hook pemasaran yang siap pakai berdasarkan kelemahan kompetitor, agar saya bisa merebut pelanggan mereka.

#### Acceptance Criteria

1. WHEN Dashboard Modul_2 menampilkan Radar_Job dengan Job_Status `COMPLETED`, THE Rintisin_App SHALL menampilkan tepat satu Card untuk setiap item `steal_the_market_playbook` sesuai urutan item dalam array. Setiap Card berisi tiga bagian berlabel Bahasa Indonesia, yaitu `target_weakness`, `actionable_strategy`, dan `marketing_hook`, dan teks setiap bagian ditampilkan utuh tanpa dipotong.
2. WHEN pengguna menekan tombol salin pada sebuah Card, THE Rintisin_App SHALL menyalin nilai `marketing_hook` dari Card tersebut ke clipboard secara persis, tanpa label, tanpa teks tambahan, dan tanpa mengubah isi teks.
3. WHEN penyalinan `marketing_hook` ke clipboard berhasil, THE Rintisin_App SHALL menampilkan konfirmasi "Tersalin" pada tombol salin Card tersebut selama 2 detik sejak penekanan terakhir, lalu mengembalikan tombol ke keadaan awal tanpa memengaruhi tombol salin pada Card lain.
4. IF penyalinan ke clipboard gagal (misalnya izin clipboard ditolak atau API clipboard browser tidak tersedia), THEN THE Rintisin_App SHALL menampilkan pesan galat berbahasa Indonesia yang menyatakan teks gagal disalin, tidak menampilkan konfirmasi "Tersalin", dan tetap menampilkan isi Card tanpa perubahan.
5. IF array `steal_the_market_playbook` kosong, THEN THE Rintisin_App SHALL menampilkan keadaan kosong (*empty state*) berbahasa Indonesia sebagai pengganti daftar Card dan tidak menampilkan tombol salin.

### Requirement 24: Riwayat Radar_Job Modul_2

**User Story:** Sebagai pengguna, saya ingin membuka kembali hasil analisis kompetitor sebelumnya, agar saya dapat memantau strategi tanpa menjalankan ulang scraping.

#### Acceptance Criteria

1. WHEN pengguna yang sudah login membuka halaman riwayat Modul_2, THE Rintisin_App SHALL menampilkan daftar yang hanya berisi Radar_Job milik pengguna tersebut. Daftar ini paling banyak memuat 20 entri per halaman dan diurutkan menurun berdasarkan waktu pembuatan. Setiap entri memuat tanggal dan jam pembuatan, jumlah URL (1–3), dan Job_Status.
2. WHEN pengguna membuka Radar_Job berstatus `COMPLETED` dari riwayat, THE Rintisin_App SHALL merender Dashboard dari JSON yang tersimpan di Database tanpa memanggil Scraper_Worker maupun Groq_Client.
3. WHEN pengguna memilih aksi hapus pada Radar_Job miliknya yang telah mencapai Status_Terminal, THE Rintisin_App SHALL menampilkan dialog konfirmasi. Rintisin_App tidak menghapus baris apa pun sebelum pengguna mengonfirmasi. Jika pengguna membatalkan dialog, Radar_Job dan daftar riwayat tidak berubah.
4. WHEN pengguna mengonfirmasi penghapusan pada dialog konfirmasi, THE Rintisin_App SHALL menghapus baris Radar_Job tersebut dari Database dan menghilangkan entrinya dari daftar riwayat tanpa memuat ulang halaman.
5. IF penghapusan gagal di Database, atau Job_Status Radar_Job tersebut bukan Status_Terminal saat penghapusan diproses, THEN THE Rintisin_App SHALL mempertahankan baris Radar_Job tanpa perubahan dan menampilkan pesan galat yang menjelaskan bahwa penghapusan gagal.
6. IF pengguna meminta untuk membuka atau menghapus Radar_Job yang bukan miliknya, THEN THE Rintisin_App SHALL menampilkan indikasi bahwa data tidak ditemukan, tanpa menampilkan data Radar_Job tersebut dan tanpa menghapus baris apa pun.

### Requirement 25: Kepatuhan Arsitektur Zero-Cost

**User Story:** Sebagai operator platform, saya ingin seluruh layanan berjalan di tier gratis, agar biaya bulanan tetap Rp 0.

#### Acceptance Criteria

1. THE Rintisin_App SHALL dapat di-build dan di-deploy di Vercel Hobby tanpa memerlukan fitur, add-on, atau konfigurasi yang hanya tersedia pada paket berbayar Vercel.
2. THE Rintisin_App SHALL menyelesaikan setiap invokasi Server Action dan API Route dalam waktu maksimal 10 detik sejak permintaan diterima, termasuk seluruh panggilan Groq_Client, Auth_Service, dan Database yang terjadi di dalam invokasi tersebut.
3. THE Rintisin_App SHALL mendelegasikan Akuisisi_Primer, Akuisisi_Fallback, Pre_Filter, Fase_Map, dan Fase_Reduce Modul_2 ke Scraper_Worker, sehingga tidak satu pun dari proses tersebut dijalankan di dalam invokasi Server Action atau API Route.
4. THE Rintisin_App SHALL mengirim permintaan jaringan keluar hanya ke layanan berikut: GroqCloud Free Tier, Supabase Free Tier, Vercel Hobby, dan Scraper_Worker di Hugging Face Spaces gratis, dengan setiap layanan tersebut berjalan pada paket bertagihan Rp 0 per bulan.
5. THE Scraper_Worker SHALL mengirim permintaan jaringan keluar hanya ke GroqCloud Free Tier, Supabase Free Tier, dan domain Google Maps yang digunakan oleh Maps_URL_Parser, Akuisisi_Primer, serta Akuisisi_Fallback.
6. THE Scraper_Worker SHALL dikemas sebagai image Docker yang di-build dari folder `worker-scraper/` dan dapat berjalan di Hugging Face Spaces gratis (2 vCPU, 16 GB RAM), dengan penggunaan memori puncak tidak melebihi 16 GB saat memproses satu Radar_Job berisi 3 Maps_URL menggunakan Akuisisi_Fallback.
7. THE Rintisin_App SHALL tidak mencantumkan Playwright maupun binary browser headless sebagai dependensinya, sehingga output build Next.js yang di-deploy ke Vercel Hobby tidak memuat modul Playwright atau binary browser headless.

## Lampiran A: Skema JSON Referensi

Skema berikut menjadi dasar skema Zod. Detail tipe, Nilai_Default, dan pemetaan label Bahasa Indonesia ditetapkan di dokumen desain.

### Modul_1 — Langkah_1

- `feasibility_audit`
  - `estimated_cogs_idr`: number (≥ 0)
  - `recommended_selling_price_idr`: number (≥ 0)
  - `gross_margin_percentage`: number (0–100)
  - `financial_viability_status`: enum `VIABLE` | `VIABLE_WITH_NOTES` | `NOT_VIABLE`
  - `operational_risks[]`: `{ aspect: string, risk_level: LOW | MEDIUM | HIGH, mitigation: string }`
  - `trend_sustainability`: `{ category: string (contoh: "EVERGREEN_NICHE"; daftar enum lengkap ditetapkan di desain), saturation_score: integer 0–100, analysis: string }`
- `target_market_mapper`
  - `primary_segment`: `{ persona_label: string, purchasing_power: string, core_pain_points: string[], buying_behavior: string }`
  - `effective_channels[]`: `{ channel_name: string, strategy: string, priority: integer ≥ 1 }`

### Modul_1 — Langkah_2

- `competitor_matrix`
  - `recommended_uvp`: string
  - `comparison_table[]`: `{ attribute: string, user_concept: string, local_incumbents: string, competitive_advantage: string }`
- `gtm_readiness`
  - `overall_score`: integer 0–100
  - `readiness_verdict`: string (contoh: "SIAP UJI PASAR TERBATAS (BETA LAUNCH)")
  - `mandatory_revisions`: string[]
  - `priority_action_plan[]`: `{ step_number: integer ≥ 1, phase: string, action: string }`

### Modul_2 — Hasil Fase_Reduce

- `market_overview`: `{ total_reviews_analyzed: integer ≥ 0, dominant_market_complaint: string, unmet_customer_need: string }`
- `competitors_breakdown[]`
  - `competitor_name`: string
  - `avg_rating`: number (0–5)
  - `sentiment_distribution`: `{ positive, neutral, negative }` (integer 0–100, jumlah = 100)
  - `core_strengths`: string[]
  - `exploitable_weaknesses`: string[]
  - `aspect_scores`: `{ product_quality, pricing_value, service_speed, ambience_facility }` (integer 0–100)
- `steal_the_market_playbook[]`: `{ target_weakness: string, actionable_strategy: string, marketing_hook: string }`
