# Rintisin AI — Audit Codebase & Roadmap Implementasi (`implementation_plan.md`)

> **Dokumen Sumber Kebenaran:** [`.kiro/specs/rintisin-ai/requirements.md`](file:///d:/rintisin-ai/.kiro/specs/rintisin-ai/requirements.md)  
> **Status Audit:** Read-Only Architecture & Gap Analysis  
> **Stack Terpasang (`package.json`):** Next.js `16.4.2` (App Router), React `19.3.0`, TypeScript `^5`, Tailwind CSS `^4`, Shadcn UI / `@base-ui/react` (`1.9.0`), Recharts (`3.10.1`), Zod (`4.6.7`), Supabase (`@supabase/ssr: ^0.12.7`, `@supabase/supabase-js: ^2.118.0`), Sonner (`2.0.8`), Vitest (`4.1.12`), Fast-Check (`4.10.2`).

---

## 1. Executive Summary & Audit Status

Secara keseluruhan, tingkat penyelesaian proyek saat ini berada pada estimasi **~42%**.

Seluruh lapisan **antarmuka pengguna (UI), visualisasi grafik (Recharts), komponen laporan Modul 1 & Modul 2, utilitas pemformatan Bahasa Indonesia, serta validasi formulir sisi klien (Zod)** telah selesai dibangun dengan kualitas sangat baik dan sudah memiliki pengujian awal (`vitest` + `fast-check`). Namun, **seluruh lapisan backend, persistensi database (Supabase PostgreSQL + RLS + Realtime), integrasi AI (`Groq_Client` + `Response_Guard`), serta microservice Python (`worker-scraper/`) masih belum diimplementasikan (0%)** dan saat ini disimulasikan menggunakan penyimpanan memori sementara di [`lib/mock/store.ts`](file:///d:/rintisin-ai/lib/mock/store.ts).

### Tabel Ringkasan Status Modul

| Area / Modul | Referensi Requirement | Status | Estimasi | Catatan Status |
| :--- | :--- | :--- | :---: | :--- |
| **Fondasi Tipe, Format & Label Bahasa Indonesia** | Req 3.2, 3.3, 3.8, 6.1, 6.2 | **Completed** | 100% | [`lib/types.ts`](file:///d:/rintisin-ai/lib/types.ts), [`lib/format.ts`](file:///d:/rintisin-ai/lib/format.ts), [`lib/labels.ts`](file:///d:/rintisin-ai/lib/labels.ts), [`lib/numbers.ts`](file:///d:/rintisin-ai/lib/numbers.ts) lengkap beserta unit/property test di [`lib/format.test.ts`](file:///d:/rintisin-ai/lib/format.test.ts). |
| **Skema Validasi Input Form (Auth, Modul 1, Modul 2)** | Req 1.1, 1.5, 4.1–4.5, 13.1–13.3 | **Completed** | 100% | [`lib/validation/auth-form.ts`](file:///d:/rintisin-ai/lib/validation/auth-form.ts), [`lib/validation/idea-form.ts`](file:///d:/rintisin-ai/lib/validation/idea-form.ts), [`lib/validation/competitor-form.ts`](file:///d:/rintisin-ai/lib/validation/competitor-form.ts) + test di [`lib/validation/validation.test.ts`](file:///d:/rintisin-ai/lib/validation/validation.test.ts). |
| **Komponen Visual & Layout Dashboard (Modul 1 & 2)** | Req 3, 6, 7, 8, 9, 22, 23 | **Completed** | 95% | Seluruh Card, Table, [`Gauge`](file:///d:/rintisin-ai/components/charts/gauge.tsx), [`AspectRadar`](file:///d:/rintisin-ai/components/charts/aspect-radar.tsx), [`Playbook`](file:///d:/rintisin-ai/components/dashboard/module2/playbook.tsx), dan empty/error states sudah sesuai spesifikasi. Hanya perlu melepas `DemoSwitcher` saat produksi. |
| **Autentikasi & Proteksi Rute (Supabase Auth)** | Req 1.1–1.7 | **In Progress (Partial)** | 35% | UI [`LoginForm`](file:///d:/rintisin-ai/components/auth/auth-forms.tsx#L48-L121) & [`RegisterForm`](file:///d:/rintisin-ai/components/auth/auth-forms.tsx#L123-L191) sudah ada, tetapi masih memakai akun demo statis (`demo@rintisin.id`). Belum ada klien Supabase SSR, middleware redirect, atau logout sesi nyata. |
| **Eksekusi Berantai 2 Langkah & Riwayat Modul 1** | Req 4.6–4.10, 5, 10 | **In Progress (Partial)** | 45% | State UI 2 langkah, skeleton, dan tombol retry sudah jalan di [`use-module1-run.ts`](file:///d:/rintisin-ai/components/dashboard/module1/use-module1-run.ts) di atas [`module1Store`](file:///d:/rintisin-ai/lib/mock/store.ts#L36). Belum ada `Analysis_Service` (Server Actions/API) dan query database Supabase. |
| **Dispatch Job, Pelacakan Status & Riwayat Modul 2** | Req 13.4–13.8, 14, 20, 21, 24 | **In Progress (Partial)** | 40% | Stepper 4 tahap ([`JobStepper`](file:///d:/rintisin-ai/components/dashboard/module2/job-stepper.tsx)), timeout 300 detik ([`useEffectiveJob`](file:///d:/rintisin-ai/components/dashboard/module2/use-radar-run.ts#L65-L82)), dan UI riwayat sudah ada, tetapi masih berbasis timer mock. Belum ada endpoint dispatch maupun langganan `Realtime_Channel`. |
| **Database Schema, RLS & Isolasi Data (Supabase)** | Req 2.1–2.7, 10.1, 14.1 | **Not Started** | 0% | Belum ada file migrasi SQL (`module1_analyses`, `module2_radars`), kebijakan RLS (`auth.uid() = user_id`), maupun konfigurasi publikasi Supabase Realtime. |
| **`Groq_Client` & `Response_Guard` (AI Resilience)** | Req 6.6–6.7, 7.3–7.4, 9.5, 11, 12 | **Not Started** | 0% | Belum ada klien HTTP Groq dengan auto-fallback HTTP 429 (`openai/gpt-oss-120b` → `openai/gpt-oss-20b`), batas timeout 8 detik, maupun pipeline `Response_Guard` (koersi tipe, clamp, perbaikan domain, `Nilai_Default`, `is_degraded`). |
| **`worker-scraper/` (Python FastAPI + Scraper + Map-Reduce)** | Req 15, 16, 17, 18, 19, 20, 25 | **Not Started** | 0% | Folder `worker-scraper/` belum ada sama sekali di repositori. Seluruh pipeline `Maps_URL_Parser`, `Akuisisi_Primer`, `Akuisisi_Fallback`, `Pre_Filter`, `Fase_Map`, dan `Fase_Reduce` belum dibuat. |

---

## 2. Gap Analysis (Current Codebase vs. `requirements.md`)

Berdasarkan pemeriksaan menyeluruh terhadap setiap file di `app/`, `components/`, `lib/`, dan konfigurasi proyek, berikut adalah daftar diskrepansi dan celah teknis antara kode saat ini dan [`.kiro/specs/rintisin-ai/requirements.md`](file:///d:/rintisin-ai/.kiro/specs/rintisin-ai/requirements.md):

### A. Autentikasi, Sesi & Keamanan Environment (Requirement 1 & 2)
- **Autentikasi Masih Mock:** [`components/auth/auth-forms.tsx`](file:///d:/rintisin-ai/components/auth/auth-forms.tsx#L12-L16) memvalidasi login menggunakan konstanta `DEMO_EMAIL = "demo@rintisin.id"` dan `DEMO_PASSWORD = "rintisin123"` dengan simulasi `sleep(500)`. Belum ada pemanggilan `supabase.auth.signInWithPassword` atau `supabase.auth.signUp`.
- **Tidak Ada Proteksi Rute Server / Middleware:** [`app/(app)/dashboard/layout.tsx`](file:///d:/rintisin-ai/app/(app)/dashboard/layout.tsx#L4) memiliki komentar `// TODO(auth): redirect to /masuk?next=… when there is no Supabase session (Req 1.2). Mock: always signed in.` dan tidak ada `middleware.ts` / `proxy.ts` di root untuk mencegat akses tanpa sesi ke `/dashboard/**` sebelum render (Req 1.2).
- **Profil & Logout di Shell Masih Statis:** [`components/shell/app-shell.tsx`](file:///d:/rintisin-ai/components/shell/app-shell.tsx#L11-L38) menampilkan `MOCK_ACCOUNT` (`rini.wulandari@contoh.id`) dan fungsi `signOut()` hanya memanggil `router.push("/masuk")` tanpa memanggil `supabase.auth.signOut()` untuk mengakhiri sesi (Req 1.7).
- **Klien Supabase Belum Dibuat:** Paket `@supabase/ssr` dan `@supabase/supabase-js` sudah terinstal di [`package.json`](file:///d:/rintisin-ai/package.json#L14-L15), tetapi belum ada satupun file inisialisasi browser client, server client, maupun service-role client di dalam `lib/`.
- **Ketidaksesuaian Konfigurasi `.env`:**
  - Model AI telah disesuaikan di [`.env`](file:///d:/rintisin-ai/.env#L23-L24) dan [`requirements.md`](file:///d:/rintisin-ai/.kiro/specs/rintisin-ai/requirements.md) menjadi `GROQ_PRIMARY_MODEL="openai/gpt-oss-120b"` (`Model_Primer`) dan `GROQ_FALLBACK_MODEL="openai/gpt-oss-20b"` (`Model_Fallback`).
  - `SUPABASE_SERVICE_ROLE_KEY` (disebutkan di Requirement 2.4) telah disiapkan di `.env`.

### B. Database, Skema Tabel & Row Level Security (Requirement 2, 10, 14, 24)
- **Seluruh Persistensi Berbasis In-Memory Store:** [`lib/mock/store.ts`](file:///d:/rintisin-ai/lib/mock/store.ts) menyimpan `module1Store` dan `radarStore` di memori browser (`useSyncExternalStore`) menggunakan data statis dari [`lib/mock/module1.ts`](file:///d:/rintisin-ai/lib/mock/module1.ts) dan [`lib/mock/module2.ts`](file:///d:/rintisin-ai/lib/mock/module2.ts). Semua perubahan hilang saat halaman di-refresh.
- **Tidak Ada Skema SQL / Migrasi Supabase:** Belum ada definisi DDL untuk tabel `module1_analyses` (`Module1_Analysis`) dan `module2_radars` (`Radar_Job`) beserta foreign key `user_id NOT NULL REFERENCES auth.users(id)`, kolom pelacakan model AI per langkah/fase (Req 11.8), kebijakan RLS (`SELECT`, `INSERT`, `UPDATE`, `DELETE` khusus pemilik baris), dan publikasi `supabase_realtime` pada `module2_radars` (Req 2.1–2.7).
- **Tipe Data `Module1Analysis` dan `RadarJob` Belum Memuat Metadata Server:** Di [`lib/types.ts`](file:///d:/rintisin-ai/lib/types.ts#L94-L161), interface `Module1Analysis` dan `RadarJob` belum mencantumkan `user_id` maupun kolom nama model AI (`step1_model`, `step2_model`, `map_models`, `reduce_model`) yang diwajibkan oleh Requirement 11.8.

### C. AI Engine: `Groq_Client` & `Response_Guard` (Requirement 6, 7, 9, 11, 12)
- **`Groq_Client` Belum Ada:** Tidak ada modul server-side untuk memanggil GroqCloud API dengan `response_format: { type: "json_object" }` (Req 11.1), mekanisme auto-fallback 1x ke `openai/gpt-oss-20b` saat `openai/gpt-oss-120b` mengembalikan HTTP 429 (Req 11.2), penanganan galat kuota HTTP 429 pada fallback dengan pesan spesifik `"Kuota AI sedang penuh. Silakan coba lagi beberapa saat lagi."` (Req 11.3, 11.7), maupun pembatalan panggilan otomatis (`AbortController`) pada batas 8 detik (Req 11.4).
- **`Response_Guard` Belum Ada:** Belum ada skema Zod output AI dan fungsi guard untuk memproses respons LLM maupun memvalidasi ulang JSON dari database sebelum dirender ke Recharts (Req 12.1–12.12). Aturan spesifik yang belum diimplementasikan meliputi:
  - Percobaan ulang (*retry*) 1x jika teks respons gagal di-parse sebagai JSON selama sisa waktu server mencukupi (Req 12.2).
  - Konversi string numerik murni (`"85"`, `"-12.5"`) ke `number` dan `"true"`/`"false"` ke `boolean` tanpa menandai `is_degraded = true`, sementara string berformat seperti `"Rp 1.200.000"` atau `"85%"` ditolak sebagai tidak valid (Req 12.3).
  - Clamping nilai berhingga pada skala 0–100 tanpa menandai `is_degraded = true` (Req 12.4).
  - Koreksi otomatis `gross_margin_percentage` jika selisihnya `> 1` poin persentase terhadap `((recommended_selling_price_idr - estimated_cogs_idr) / recommended_selling_price_idr) * 100` (Req 6.6–6.7).
  - Pengurutan dan penomoran ulang `priority` pada `effective_channels` menjadi `1..N` serta pemotongan maksimal 5 elemen pertama pada `core_pain_points` dan `effective_channels` (Req 7.3–7.4).
  - Penomoran ulang `step_number` pada `priority_action_plan` menjadi `1..N` (Req 9.5).
  - Pengisian `Nilai_Default` hanya pada field yang hilang/tidak valid disertai penetapan `is_degraded = true` (Req 12.5, 12.11).

### D. Modul 1 — LokalTrend Radar (Requirement 4, 5, 10)
- **Tidak Ada `Analysis_Service` Server-Side:** [`components/dashboard/module1/use-module1-run.ts`](file:///d:/rintisin-ai/components/dashboard/module1/use-module1-run.ts) menjalankan `runStep1` dan `runStep2` di browser menggunakan `sleep(1500)` dan `sleep(2000)` serta mengembalikan objek statis `mockStep1` / `mockStep2`.
- **Belum Ada System Prompt & Chaining Langkah 1 → Langkah 2:** System prompt wajib pada Requirement 5.9 dan instruksi konteks lokal Indonesia (ekspedisi, daya beli kota target, komisi marketplace/ojol, perizinan NIB/PIRT/Halal sesuai `Kategori_Ekraf` pada Requirement 5.10) dengan batas `max_tokens: 1200` per langkah belum diimplementasikan.
- **Prop `serverError` Belum Diteruskan ke `IdeaForm`:** [`components/dashboard/module1/idea-form.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/idea-form.tsx#L30-L38) sudah menerima prop `serverError?: string | null`, tetapi [`components/dashboard/module1/lokaltrend-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/lokaltrend-screen.tsx#L72) belum meneruskan error dari server ke `<IdeaForm />` (Req 4.9, 4.10).
- **Penanganan Galat Hapus Riwayat Modul 1:** Di [`components/dashboard/module1/history-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/history-screen.tsx#L50-L54), aksi hapus langsung memanggil `module1Store.remove(row.id)` tanpa penanganan kegagalan database yang wajib mempertahankan baris dan menampilkan pesan galat Bahasa Indonesia (Req 10.7).

### E. Modul 2 — PetaSaingan Ekraf & Real-Time Tracking (Requirement 13, 14, 20, 21, 24)
- **Tidak Ada Server Endpoint Pembuatan & Dispatch `Radar_Job`:** Belum ada Server Action / Route Handler yang memvalidasi ulang `competitorFormSchema` di sisi server (Req 13.4), memeriksa apakah pengguna masih memiliki `Radar_Job` berstatus non-terminal (`PENDING`, `SCRAPING`, `ANALYZING`) sebelum mengizinkan job baru (Req 13.7), menyimpan baris `PENDING` ke `module2_radars` (Req 14.1), dan men-dispatch `{ radar_id }` ke `SCRAPER_WORKER_URL` dengan header `WORKER_SECRET` dan timeout 5 detik (Req 14.2–14.4).
- **Tidak Ada Langganan Supabase `Realtime_Channel`:** [`components/dashboard/module2/use-radar-run.ts`](file:///d:/rintisin-ai/components/dashboard/module2/use-radar-run.ts) masih memakai timer lokal. Belum ada langganan `postgres_changes` yang difilter per `radar_id` (Req 21.2), pengabaian status mundur (`PENDING < SCRAPING < ANALYZING < Status_Terminal`, Req 21.3), sinkronisasi ulang saat reconnect (Req 21.4), banner peringatan saat koneksi terputus dalam ≤ 5 detik (Req 21.7), maupun retry pembacaan awal/reconnect maksimal 3 kali dengan jeda 5 detik (Req 21.8).
- **Paginasi & Validasi Hapus Riwayat Modul 2:** [`components/dashboard/module2/history-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module2/history-screen.tsx#L39) memotong `useRadarRows().slice(0, 20)` di memori klien dan belum memverifikasi ulang `Status_Terminal` di sisi server/database saat menghapus (Req 24.1, 24.5).

### F. Layanan `worker-scraper/` (Requirement 15, 16, 17, 18, 19, 20, 25)
- **Direktori `worker-scraper/` Belum Ada:** Seluruh komponen microservice Python FastAPI yang didelegasikan ke Hugging Face Spaces (Dockerized) belum mulai ditulis:
  - Autentikasi header `WORKER_SECRET` peka huruf besar/kecil dan validasi `radar_id` (Req 15).
  - `Maps_URL_Parser` (resolver shortlink dengan whitelist domain & maks 5 redirect, ekstraktor `Feature_ID` `0x<hex>:0x<hex>`) dan `Maps_URL_Formatter` (Req 15.4, 15.6, 16).
  - `Akuisisi_Primer` via RPC `listugcposts` (`curl_cffi`/`httpx`, batas 30 detik, target 10–150 ulasan) dan `Akuisisi_Fallback` via Playwright Chromium headless dengan pemblokiran aset gambar/font/tile peta serta 10–15 auto-scroll (Req 17).
  - Pipeline deterministik `Pre_Filter` & `Text_Normalizer` beserta `Sampel_Terstratifikasi` kuota 40 kritis + 40 positif (Req 18).
  - Eksekusi `Fase_Map` paralel (`openai/gpt-oss-20b`) dan `Fase_Reduce` (`openai/gpt-oss-120b` dengan fallback 429), penimpaan deterministik `total_reviews_analyzed`, `competitor_name`, `avg_rating`, serta normalisasi `sentiment_distribution` agar berjumlah tepat 100 (Req 19 & 20).

---

## 3. Prioritized Implementation Roadmap (Phased Checklist)

Urutan pengerjaan di bawah ini disusun berdasarkan dependensi arsitektural agar aplikasi dapat beralih dari mode mock ke produksi secara sistematis tanpa merusak komponen UI yang sudah berjalan.

### Phase 1 (P0 — Critical Blockers): Skema Database, RLS, Autentikasi Supabase & Guard Rute

- [x] **1.1. Buat Skema Database PostgreSQL, Kebijakan RLS & Konfigurasi Realtime**
  - **Target Files/Directories:**
    - Buat baru: `supabase/migrations/0001_init_rintisin_schema.sql`
    - Perbarui: [`lib/types.ts`](file:///d:/rintisin-ai/lib/types.ts)
    - Perbarui: [`.env`](file:///d:/rintisin-ai/.env) (tambahkan placeholder `SUPABASE_SERVICE_ROLE_KEY` dan sesuaikan `GROQ_PRIMARY_MODEL="openai/gpt-oss-120b"` dan `GROQ_FALLBACK_MODEL="openai/gpt-oss-20b"`)
  - **Technical Implementation Details:**
    - Definisikan tabel `public.module1_analyses` dengan kolom: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `product_idea TEXT NOT NULL`, `category TEXT NOT NULL`, `initial_capital_idr BIGINT NOT NULL`, `target_city TEXT NOT NULL`, `step1_status TEXT NOT NULL DEFAULT 'IDLE'`, `step2_status TEXT NOT NULL DEFAULT 'IDLE'`, `step1_result JSONB`, `step2_result JSONB`, `step1_model TEXT`, `step2_model TEXT`, `is_degraded BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
    - Definisikan tabel `public.module2_radars` dengan kolom: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `maps_urls JSONB NOT NULL`, `status TEXT NOT NULL DEFAULT 'PENDING'`, `result JSONB`, `failed_competitors JSONB NOT NULL DEFAULT '[]'::jsonb`, `error_message TEXT`, `map_models JSONB`, `reduce_model TEXT`, `is_degraded BOOLEAN NOT NULL DEFAULT FALSE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
    - Aktifkan `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` pada kedua tabel dan buat policy `SELECT`, `INSERT`, `UPDATE`, `DELETE` untuk role `authenticated` dengan `USING (auth.uid() = user_id)` dan `WITH CHECK (auth.uid() = user_id)` (Req 2.1, 2.2, 2.5–2.7).
    - Tambahkan `ALTER PUBLICATION supabase_realtime ADD TABLE public.module2_radars;` agar `Realtime_Channel` mengirimkan event perubahan baris sesuai kebijakan RLS (Req 2.3).

- [x] **1.2. Implementasi Klien Supabase SSR (Browser, Server & Middleware/Proxy)**
  - **Target Files/Directories:**
    - Buat baru: `lib/supabase/client.ts`
    - Buat baru: `lib/supabase/server.ts`
    - Buat baru: `middleware.ts` (atau `proxy.ts` sesuai konvensi Next.js 16)
  - **Technical Implementation Details:**
    - Gunakan `@supabase/ssr` (`createBrowserClient` di `lib/supabase/client.ts` dan `createServerClient` dengan `cookies()` dari `next/headers` di `lib/supabase/server.ts`).
    - Buat helper `requireAuthenticatedUser()` di `lib/supabase/server.ts` yang memanggil `supabase.auth.getUser()` dan mengembalikan objek user atau melempar respons/status HTTP 401 untuk dipakai di semua Server Actions / API Routes (Req 1.3).
    - Di `middleware.ts`, periksa sesi pengguna pada seluruh rute `/dashboard/:path*`. Jika sesi tidak valid, arahkan pengguna ke `/masuk?next=<encoded_pathname_and_search>` sebelum halaman dirender (Req 1.2).

- [x] **1.3. Hubungkan Formulir Login, Registrasi & Shell dengan Supabase Auth**
  - **Target Files/Directories:**
    - Perbarui: [`components/auth/auth-forms.tsx`](file:///d:/rintisin-ai/components/auth/auth-forms.tsx)
    - Perbarui: [`app/(app)/dashboard/layout.tsx`](file:///d:/rintisin-ai/app/(app)/dashboard/layout.tsx)
    - Perbarui: [`components/shell/app-shell.tsx`](file:///d:/rintisin-ai/components/shell/app-shell.tsx)
  - **Technical Implementation Details:**
    - Pertahankan validasi awal menggunakan [`validateAuthForm`](file:///d:/rintisin-ai/lib/validation/auth-form.ts#L19-L32) (Zod).
    - Pada `LoginForm`, ganti blok mock `DEMO_EMAIL` dengan `supabase.auth.signInWithPassword({ email: result.data.email, password: result.data.password })`. Jika gagal, tetap tampilkan konstanta `LOGIN_FAILED` yang identik untuk email tidak terdaftar maupun sandi salah, pertahankan state `email`, dan kosongkan `password` (Req 1.4). Jika berhasil, arahkan ke `safeNext(params.get("next"))` dan panggil `router.refresh()` (Req 1.6).
    - Pada `RegisterForm`, panggil `supabase.auth.signUp({ email: result.data.email, password: result.data.password })`, tangani galat dalam Bahasa Indonesia tanpa membocorkan error mentah (Req 1.1, 1.5, 3.7).
    - Pada `app/(app)/dashboard/layout.tsx`, verifikasi sesi server-side sebagai pengaman lapis kedua, dan teruskan email pengguna aktif ke [`AppShell`](file:///d:/rintisin-ai/components/shell/app-shell.tsx).
    - Pada `AppShell`, ganti `MOCK_ACCOUNT` dengan email sesi pengguna dan perbarui fungsi `signOut()` agar memanggil `await supabase.auth.signOut()` sebelum `router.push("/masuk")` dan `router.refresh()` (Req 1.7).

---

### Phase 2 (P0 — Core AI Infrastructure): `Groq_Client` & `Response_Guard`

- [x] **2.1. Bangun `Groq_Client` Server-Only dengan Auto-Fallback & Timeout 8 Detik**
  - **Target Files/Directories:**
    - Buat baru: `lib/ai/groq-client.ts`
    - Buat baru: `lib/ai/groq-client.test.ts`
  - **Technical Implementation Details:**
    - Tetapkan konstanta `PRIMARY_MODEL = "openai/gpt-oss-120b"` dan `FALLBACK_MODEL = "openai/gpt-oss-20b"` (Req 11.8). Pastikan file ini hanya berjalan di server (jangan pernah mengimpor `GROQ_API_KEY` ke komponen `"use client"`, Req 2.4).
    - Setiap permintaan ke `https://api.groq.com/openai/v1/chat/completions` wajib menyertakan `response_format: { type: "json_object" }` (Req 11.1).
    - Gunakan satu `AbortController` dengan batas waktu total **8.000 ms** sejak permintaan pertama dikirim, mencakup potensi panggilan ulang ke `Model_Fallback` (Req 11.4). Jika melewati 8 detik, batalkan request dan kembalikan error bertipe `TIMEOUT`.
    - Jika panggilan ke `Model_Primer` mengembalikan HTTP `429`, otomatis kirim ulang permintaan dengan prompt, `max_tokens`, dan `response_format` yang identik ke `Model_Fallback` tepat 1 kali (Req 11.2).
    - Jika `Model_Fallback` mengembalikan HTTP `429` (baik saat fallback maupun panggilan langsung), hentikan percobaan dan kembalikan error bertipe `QUOTA` yang dipetakan ke pesan UI `"Kuota AI sedang penuh. Silakan coba lagi beberapa saat lagi."` (Req 11.3, 11.7).
    - Jika menerima HTTP 5xx, HTTP 4xx selain 429, atau galat jaringan, langsung kembalikan error bertipe `SERVICE` tanpa fallback, yang dipetakan ke pesan Bahasa Indonesia bahwa layanan AI sedang tidak tersedia (Req 11.5, 11.6).
    - Kembalikan `{ rawText: string, modelUsed: "openai/gpt-oss-120b" | "openai/gpt-oss-20b" }` pada setiap respons sukses (Req 11.8).

- [x] **2.2. Bangun `Response_Guard` & Skema Zod Output Modul 1 & Modul 2**
  - **Target Files/Directories:**
    - Buat baru: `lib/validation/response-guard.ts`
    - Buat baru: `lib/validation/response-guard.test.ts`
  - **Technical Implementation Details:**
    - Gunakan `zod` (`4.6.7`) dan utilitas [`clampScore`](file:///d:/rintisin-ai/lib/numbers.ts#L4-L7), [`clampRating`](file:///d:/rintisin-ai/lib/numbers.ts#L10-L13), serta [`grossMargin`](file:///d:/rintisin-ai/lib/numbers.ts#L16-L19) untuk mendefinisikan skema dan `Nilai_Default` per field bagi `Step1Result`, `Step2Result`, dan `Module2Result` (Lampiran A `requirements.md`).
    - Implementasikan pipeline urutan tetap (Req 12.1):
      1. **Parse JSON & Retry 1x:** Jika `JSON.parse` gagal dan sisa anggaran waktu server mencukupi, panggil ulang `Groq_Client` tepat 1 kali (Req 12.2). Jika tetap gagal di-parse atau waktu tidak cukup, kembalikan objek penuh `Nilai_Default` dengan `is_degraded: true` tanpa melempar exception (Req 12.11).
      2. **Pembuangan Field Asing:** Buang seluruh properti yang tidak didefinisikan di skema.
      3. **Konversi Tipe (Req 12.3):** Jika field bertipe angka menerima string yang setelah `.trim()` cocok dengan `/^-?\d+(\.\d+)?$/`, konversi ke `Number` tanpa menandai `is_degraded = true`. Jika field boolean menerima `"true"`/`"false"`, konversi ke boolean tanpa menandai `is_degraded = true`. String seperti `"Rp 35.000"` atau `"85%"` ditolak sebagai tidak valid.
      4. **Clamp 0–100 (Req 12.4):** Untuk field skor/persentase 0–100 (`gross_margin_percentage`, `saturation_score`, `overall_score`, `aspect_scores.*`, `sentiment_distribution.*`) yang bernilai `Number.isFinite`, potong ke `[0, 100]` tanpa menandai `is_degraded = true`. Nilai `NaN` atau `±Infinity` diperlakukan sebagai tidak valid.
      5. **Aturan Perbaikan Domain Spesifik:**
         - **Margin Kotor (Req 6.6–6.7):** Jika `recommended_selling_price_idr > 0` dan `Math.abs(gross_margin_percentage - ((price - cogs) / price) * 100) > 1`, ganti `gross_margin_percentage` dengan `grossMargin(price, cogs)` (dibulatkan 1 desimal & di-clamp 0–100).
         - **Target Market Mapper (Req 7.3–7.4):** Urutkan `effective_channels` berdasarkan `priority` asli secara menaik (stabil terhadap indeks awal), nomori ulang `priority` menjadi `1..N`, lalu potong `core_pain_points` dan `effective_channels` masing-masing maksimal 5 elemen pertama.
         - **GTM Action Plan (Req 9.5):** Urutkan dan nomori ulang `step_number` pada `priority_action_plan` menjadi `1..N`.
      6. **Pengisian `Nilai_Default` (Req 12.5):** Untuk setiap field wajib yang masih hilang atau tidak valid setelah langkah di atas, isi hanya field tersebut dengan `Nilai_Default` (mis. `0`, `"Data tidak tersedia"`, `[]`) dan tetapkan `is_degraded = true`.
    - Sediakan fungsi `guardStoredResult()` untuk memvalidasi ulang JSON yang dibaca dari Supabase sebelum dirender oleh komponen Recharts (Req 12.7, 12.12).

---

### Phase 3 (P1 — Primary Feature): Modul 1 — LokalTrend Radar Backend & Persistence

- [x] **3.1. Implementasi `Analysis_Service` (Eksekusi Berantai Langkah 1 & Langkah 2)**
  - **Target Files/Directories:**
    - Buat baru: `lib/services/module1-service.ts`
    - Buat baru: `app/api/module1/step1/route.ts` (atau Server Action di `lib/actions/module1.ts`)
    - Buat baru: `app/api/module1/step2/route.ts`
  - **Technical Implementation Details:**
    - Verifikasi sesi autentikasi di awal setiap permintaan; tolak dengan HTTP 401 jika tidak valid tanpa menyentuh DB atau `Groq_Client` (Req 1.3).
    - **Endpoint Langkah 1:**
      - Jika menerima analisis baru, validasi ulang input dengan [`validateIdeaForm`](file:///d:/rintisin-ai/lib/validation/idea-form.ts#L42-L55) (Zod) di sisi server (Req 4.4, 4.6, 4.9). Buat 1 baris `module1_analyses` dengan `step1_status = 'RUNNING'` dan `step2_status = 'IDLE'` (Req 5.1). Jika merupakan retry Langkah 1 (menerima `analysis_id`), gunakan input yang sudah tersimpan di baris tersebut (Req 5.8).
      - Panggil `Groq_Client` dengan `max_tokens: 1200` (Req 5.2), menggunakan system prompt persis dari Requirement 5.9 dan instruksi konteks lokal Indonesia (logistik ekspedisi lokal, daya beli `target_city`, komisi marketplace/ojol, serta perizinan NIB/PIRT/Halal sesuai `category`, Req 5.10).
      - Validasi output dengan `Response_Guard` (`Step1Result`). Simpan `step1_result`, `step1_model`, `is_degraded`, dan `step1_status = 'SUCCESS'` ke database (Req 5.3, 11.8). Jika gagal atau melewati batas 10 detik, tandai `step1_status = 'FAILED'` tanpa menyimpan hasil parsial (Req 5.11).
    - **Endpoint Langkah 2:**
      - Terima `analysis_id`, pastikan baris milik pengguna aktif dan `step1_status === 'SUCCESS'` (Req 5.4). Tandai `step2_status = 'RUNNING'`.
      - Bangun konteks prompt Langkah 2 yang diturunkan **hanya** dari `step1_result` yang tersimpan di database (Req 5.4), panggil `Groq_Client` dengan system prompt Requirement 5.9–5.10 dan `max_tokens: 1200`.
      - Validasi output dengan `Response_Guard` (`Step2Result`). Simpan `step2_result`, `step2_model`, `is_degraded = existing_degraded || step2_degraded`, dan `step2_status = 'SUCCESS'` tanpa mengubah `step1_result` (Req 5.5). Jika gagal, tandai `step2_status = 'FAILED'` dan pertahankan `step1_result` (Req 5.7, 5.11).

- [x] **3.2. Hubungkan UI LokalTrend Radar, Riwayat & Detail ke Backend Nyata**
  - **Target Files/Directories:**
    - Perbarui: [`components/dashboard/module1/use-module1-run.ts`](file:///d:/rintisin-ai/components/dashboard/module1/use-module1-run.ts)
    - Perbarui: [`components/dashboard/module1/lokaltrend-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/lokaltrend-screen.tsx)
    - Perbarui: [`components/dashboard/module1/history-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/history-screen.tsx)
    - Perbarui: [`components/dashboard/module1/detail-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/detail-screen.tsx)
    - Perbarui: [`components/dashboard/home-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/home-screen.tsx)
  - **Technical Implementation Details:**
    - Di [`use-module1-run.ts`](file:///d:/rintisin-ai/components/dashboard/module1/use-module1-run.ts), ganti simulasi `sleep()` dan `module1Store` dengan pemanggilan berurutan ke endpoint Langkah 1 lalu Langkah 2. Saat Langkah 1 berhasil, segera perbarui state `analysis` agar [`FeasibilityAuditor`](file:///d:/rintisin-ai/components/dashboard/module1/feasibility-auditor.tsx) dan [`TargetMarketMapper`](file:///d:/rintisin-ai/components/dashboard/module1/target-market-mapper.tsx) langsung dirender sementara Langkah 2 menampilkan [`Step2Skeleton`](file:///d:/rintisin-ai/components/dashboard/module1/module1-report.tsx#L86-L105) (Req 5.3, 5.12).
    - Teruskan pesan galat validasi/server dari `useModule1Run` ke prop `serverError` pada [`IdeaForm`](file:///d:/rintisin-ai/components/dashboard/module1/idea-form.tsx#L33) di [`lokaltrend-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/lokaltrend-screen.tsx#L72) (Req 4.9, 4.10).
    - Di [`history-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/history-screen.tsx) dan [`detail-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/detail-screen.tsx), ambil data dari tabel `module1_analyses` milik pengguna aktif (diurutkan `created_at DESC`, Req 10.2). Saat detail dibuka, jalankan `guardStoredResult()` sebelum render tanpa memanggil `Groq_Client` (Req 10.3, 12.7).
    - Pada aksi hapus di [`history-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/history-screen.tsx#L50-L54), panggil operasi DELETE ke Supabase (hanya diizinkan jika tidak ada langkah berstatus `RUNNING`, Req 10.4). Jika gagal, tampilkan toast error `sonner` (`"Penghapusan analisis gagal. Silakan coba lagi."`) dan pertahankan baris di daftar riwayat (Req 10.7).

---

### Phase 4 (P1 — Primary Feature): Modul 2 — Dispatch, Realtime Tracking & `worker-scraper/`

- [x] **4.1. Implementasi Endpoint Pembuatan & Dispatch `Radar_Job` di Next.js**
  - **Target Files/Directories:**
    - Buat baru: `lib/services/module2-service.ts`
    - Buat baru: `app/api/module2/dispatch/route.ts` (atau Server Action di `lib/actions/module2.ts`)
  - **Technical Implementation Details:**
    - Verifikasi sesi pengguna aktif (HTTP 401 jika tidak login, Req 1.3).
    - Validasi ulang input `urls` di sisi server menggunakan [`validateCompetitorForm`](file:///d:/rintisin-ai/lib/validation/competitor-form.ts#L61-L72) (Zod: 1–3 URL, format `Maps_URL`, maks 2.048 karakter, deteksi duplikat case-insensitive pada skema & host, Req 13.4–13.5).
    - Periksa di tabel `module2_radars` apakah pengguna aktif masih memiliki baris dengan `status IN ('PENDING', 'SCRAPING', 'ANALYZING')`. Jika ada, tolak permintaan tanpa membuat job baru dan kembalikan pesan galat bahwa masih ada analisis yang sedang berjalan (Req 13.7).
    - Simpan baris `Radar_Job` baru dengan `user_id` dari sesi, `maps_urls`, dan `status = 'PENDING'` (Req 14.1). Jika insert gagal, kembalikan pesan galat tanpa memanggil worker (Req 14.6).
    - Kirim HTTP POST berisi `{ radar_id }` ke `${ process.env.SCRAPER_WORKER_URL }/dispatch` dengan header `X-Worker-Secret: process.env.WORKER_SECRET` dan timeout `AbortController` **5.000 ms** (Req 14.2).
    - Jika worker merespons HTTP 2xx dalam ≤ 5 detik, perbarui `status = 'SCRAPING'` di database (Req 14.3). Jika timeout, status non-2xx, atau gagal koneksi, perbarui `status = 'FAILED'` dengan `error_message = "Server analisis sedang tidak tersedia. Silakan coba lagi."` tanpa retry otomatis (Req 14.4). Kembalikan `{ radar_id, status }` ke klien dalam total waktu ≤ 8 detik (Req 14.8).

- [x] **4.2. Implementasi Langganan Supabase `Realtime_Channel` & Sinkronisasi Modul 2**
  - **Target Files/Directories:**
    - Perbarui: [`components/dashboard/module2/use-radar-run.ts`](file:///d:/rintisin-ai/components/dashboard/module2/use-radar-run.ts)
    - Perbarui: [`components/dashboard/module2/radar-job-view.tsx`](file:///d:/rintisin-ai/components/dashboard/module2/radar-job-view.tsx)
    - Perbarui: [`components/dashboard/module2/petasaingan-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module2/petasaingan-screen.tsx)
    - Perbarui: [`components/dashboard/module2/history-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module2/history-screen.tsx)
    - Perbarui: [`components/dashboard/module2/detail-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module2/detail-screen.tsx)
  - **Technical Implementation Details:**
    - Saat halaman `Radar_Job` dibuka, baca baris `module2_radars` 1 kali dari Supabase. Jika pembacaan gagal, ulangi maksimal 3 kali dengan jeda 5 detik sebelum menampilkan pesan galat Bahasa Indonesia (Req 21.1, 21.8).
    - Selama `status` belum berupa `Status_Terminal` (`COMPLETED` / `FAILED`), buka tepat 1 langganan Supabase Realtime `postgres_changes` (`event: 'UPDATE'`, `table: 'module2_radars'`, `filter: \`id=eq.${radarId}\``) tanpa melakukan polling berkala (Req 21.2).
    - Terapkan urutan monotonik `PENDING < SCRAPING < ANALYZING < COMPLETED/FAILED`: abaikan event yang statusnya lebih awal daripada status yang sedang ditampilkan (Req 21.3).
    - Pantau status koneksi channel: jika terputus saat job belum terminal, tampilkan banner peringatan Bahasa Indonesia bahwa koneksi pembaruan status terputus dalam ≤ 5 detik tanpa mengubah status job menjadi `FAILED` (Req 21.7). Saat channel terhubung kembali, baca ulang baris dari database 1 kali dan hapus banner peringatan (Req 21.4).
    - Hentikan langganan (`supabase.removeChannel`) segera saat job mencapai `Status_Terminal` atau komponen unmount (Req 21.5), dan pastikan tombol `"Analisis 3 Kompetitor"` aktif kembali dalam ≤ 5 detik setelah `Status_Terminal` diterima (Req 13.8).
    - Saat `status === 'COMPLETED'`, validasi `result` dengan `guardStoredResult()` (`Response_Guard` Zod Modul 2) sebelum merender [`Module2Report`](file:///d:/rintisin-ai/components/dashboard/module2/module2-report.tsx) (Req 21.6, 21.9).
    - Pada [`history-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module2/history-screen.tsx), baca maksimal 20 baris per halaman (`ORDER BY created_at DESC LIMIT 20`, Req 24.1) dan pastikan operasi hapus memverifikasi ulang `Status_Terminal` di database serta menangani kegagalan hapus dengan mempertahankan baris dan menampilkan toast error Bahasa Indonesia (Req 24.3–24.5).

- [x] **4.3. Bangun Microservice `worker-scraper/` (FastAPI, Maps Parser, Scraper, Pre-Filter & Map-Reduce)**
  - **Target Files/Directories:**
    - Buat baru: `worker-scraper/Dockerfile`
    - Buat baru: `worker-scraper/requirements.txt`
    - Buat baru: `worker-scraper/app/main.py` (Endpoint FastAPI & verifikasi `WORKER_SECRET`)
    - Buat baru: `worker-scraper/app/url_parser.py` (`Maps_URL_Parser` & `Maps_URL_Formatter`)
    - Buat baru: `worker-scraper/app/scraper.py` (`Akuisisi_Primer` & `Akuisisi_Fallback`)
    - Buat baru: `worker-scraper/app/pre_filter.py` (`Pre_Filter`, `Text_Normalizer`, `Sampel_Terstratifikasi`)
    - Buat baru: `worker-scraper/app/map_reduce.py` (`Fase_Map`, `Fase_Reduce`, & worker `Response_Guard`)
  - **Technical Implementation Details:**
    - **Keamanan & Isolasi Worker (Req 15 & 25):** Verifikasi `WORKER_SECRET` peka huruf besar/kecil (tolak HTTP 401 jika salah/kosong, Req 15.1). Tolak jika `radar_id` tidak ada atau berstatus selain `PENDING`/`SCRAPING` (Req 15.2). Batasi semua penulisan ke tabel `module2_radars` hanya pada baris dengan `id == radar_id` (Req 15.3). Jangan pernah mencantumkan Playwright di `package.json` Next.js (Req 25.7).
    - **`Maps_URL_Parser` & `Maps_URL_Formatter` (Req 15.4, 15.6, 16):** Ikuti redirect shortlink hanya untuk skema `https` dan hostname persis `google.com`, `www.google.com`, `maps.google.com`, `maps.app.goo.gl`, atau `goo.gl` (maks 5 lompatan, batas 10 detik). Ekstrak kemunculan pertama `Feature_ID` dengan regex `0x[0-9a-fA-F]{1,16}:0x[0-9a-fA-F]{1,16}`, normalisasi ke huruf kecil. Sediakan `format_maps_url(feature_id)` yang menghasilkan URL kanonik `https://www.google.com/maps/place/...` yang memenuhi properti round-trip (Req 16.5–16.7).
    - **Akuisisi Ulasan Zero-Cost (Req 17):**
      - `Akuisisi_Primer`: Panggil RPC internal `https://www.google.com/maps/rpc/listugcposts` via `curl_cffi`/`httpx` (urutan Terbaru & Rating Terendah, maks 150 ulasan, batas 30 detik). Jika menghasilkan ≥ 10 ulasan, lewati fallback (Req 17.1).
      - `Akuisisi_Fallback`: Jika primer gagal atau `< 10` ulasan, jalankan Playwright Chromium headless maks 1x per kompetitor (batas 120 detik), blokir semua request gambar (`png`, `jpg`, `jpeg`, `webp`), font, dan tile peta, serta lakukan auto-scroll panel ulasan 10–15 kali (Req 17.2–17.4). Jika fallback menghasilkan 1–9 ulasan, gunakan himpunan terbanyak antara primer dan fallback (Req 17.8). Ambil `competitor_name` dan `avg_rating` dari data tempat (Req 17.5, 17.9).
    - **`Pre_Filter` Deterministik (Req 18):** Jalankan berurutan:
      1. Bersihkan ulasan menjadi `[rating 1..5, teks]` tanpa metadata pengguna/HTML (Req 18.2–18.3).
      2. `Text_Normalizer`: hapus seluruh emoji, ringkas ≥ 3 huruf identik berurutan menjadi 1 huruf (pertahankan 2 huruf ganda seperti `"tunggu"`), ringkas spasi berurutan, dan pastikan bersifat idempoten (Req 18.4–18.5).
      3. Buang ulasan dengan `<= 3` kata setelah normalisasi (Req 18.6).
      4. Hapus duplikat teks (case-insensitive) dengan mempertahankan ulasan bertanggal terbaru (Req 18.7).
      5. Bentuk `Sampel_Terstratifikasi` maks 80 ulasan: kuota 40 strata kritis (rating 1–3, `> 30` karakter, diurutkan dari terpanjang lalu terbaru) dan kuota 40 strata positif (rating 4–5, `> 40` karakter, diurutkan dari terbaru), dengan pengisian sisa kuota lintas strata jika salah satu strata `< 40` ulasan (Req 18.8–18.12).
    - **Analisis Map-Reduce & Penyelesaian Job (Req 19 & 20):**
      - Perbarui `status = 'ANALYZING'` tepat 1 kali saat sampel kompetitor pertama siap (Req 19.1).
      - Jalankan `Fase_Map` secara paralel per kompetitor menggunakan `openai/gpt-oss-20b` (Req 19.2).
      - Jalankan 1 panggilan `Fase_Reduce` menggunakan `openai/gpt-oss-120b` (dengan auto-fallback 1x ke `openai/gpt-oss-20b` pada HTTP 429, input maks 1.000 token, Req 19.3–19.4).
      - Timpa `total_reviews_analyzed` dengan jumlah aktual ulasan di `Sampel_Terstratifikasi` kompetitor yang lolos `Fase_Map`, timpa `competitor_name` dan `avg_rating` dari data akuisisi, serta normalisasi `sentiment_distribution` (`positive + neutral + negative == 100`) (Req 19.6–19.8).
      - Simpan `result`, `failed_competitors`, `is_degraded`, nama model, dan `status = 'COMPLETED'` dalam satu operasi update atomik ke `module2_radars` (Req 20.1–20.3).

---

### Phase 5 (P2 & P3 — Polish, Cleanup & Property-Based Verification)

- [x] **5.1. Bersihkan Komponen Demo & Mock Store dari Rute Produksi**
  - **Target Files/Directories:**
    - Perbarui: [`components/dashboard/module1/lokaltrend-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module1/lokaltrend-screen.tsx)
    - Perbarui: [`components/dashboard/module2/petasaingan-screen.tsx`](file:///d:/rintisin-ai/components/dashboard/module2/petasaingan-screen.tsx)
    - Perbarui: [`components/shell/app-shell.tsx`](file:///d:/rintisin-ai/components/shell/app-shell.tsx)
    - Perbarui: [`components/auth/auth-forms.tsx`](file:///d:/rintisin-ai/components/auth/auth-forms.tsx)
  - **Technical Implementation Details:**
    - Hapus render `<DemoSwitcher />` dari halaman `/dashboard/lokaltrend` dan `/dashboard/petasaingan`, hapus catatan `"Mode demo: semua hasil di aplikasi ini adalah data contoh."` dari sidebar [`AppShell`](file:///d:/rintisin-ai/components/shell/app-shell.tsx#L82-L84), serta hapus kotak kredensial demo dari [`LoginForm`](file:///d:/rintisin-ai/components/auth/auth-forms.tsx#L109-L112).
    - Pastikan tidak ada komponen produksi yang masih mengimpor [`lib/mock/store.ts`](file:///d:/rintisin-ai/lib/mock/store.ts) (file mock hanya boleh dipakai oleh unit/component test).

- [x] **5.2. Tulis Suite Pengujian Unit & Property-Based Testing (`vitest` & `fast-check`)**
  - **Target Files/Directories:**
    - Buat baru: `lib/validation/response-guard.test.ts`
    - Buat baru: `lib/ai/groq-client.test.ts`
    - Buat baru: `worker-scraper/tests/test_pre_filter.py`
    - Buat baru: `worker-scraper/tests/test_url_parser.py`
  - **Technical Implementation Details:**
    - Gunakan `vitest` (`4.1.12`) dan `fast-check` (`4.10.2`) untuk menguji properti formal yang diminta di `requirements.md`:
      - **Properti Round-Trip Skema Zod (Req 12.9):** `fc.assert` bahwa untuk setiap objek valid `Step1Result`, `Step2Result`, dan `Module2Result`, `JSON.parse(JSON.stringify(obj))` yang divalidasi ulang menghasilkan objek yang `deepEqual` dengan objek asal.
      - **Properti Totalitas Anti-Crash `Response_Guard` (Req 12.10):** `fc.assert` menggunakan `fc.anything()` / `fc.jsonValue()` bahwa `Response_Guard` tidak pernah melempar exception, selalu menghasilkan objek yang lolos skema Zod target, tidak memuat field asing, dan selalu menandai `is_degraded = true` bila field wajib diisi `Nilai_Default`.
      - **Aturan Perbaikan Margin & Penomoran Ulang (Req 6.6–6.7, 7.3–7.4, 9.5):** Uji batas selisih `<= 1%` vs `> 1%` pada `gross_margin_percentage`, penomoran ulang `priority` 1..N dan pemotongan maks 5 elemen pada `effective_channels`/`core_pain_points`, serta penomoran ulang `step_number` 1..N pada `priority_action_plan`.
      - **Properti `Pre_Filter` & `Maps_URL` di Worker (Req 16.7, 18.5, 18.11):** Uji properti round-trip `Maps_URL_Formatter` → `Maps_URL_Parser`, properti idempoten `Text_Normalizer(Text_Normalizer(s)) === Text_Normalizer(s)`, dan properti invarian kuota `Sampel_Terstratifikasi` (`min(80, eligible)`).
    - Jalankan `npm run test`, `npm run lint`, dan `npm run build` untuk memastikan kepatuhan penuh terhadap Vercel Hobby build (Req 25.1, 25.7).

---

## 4. Recommended Next Immediate Action

### Tugas Pertama yang Harus Dieksekusi Selanjutnya:
> **Jalankan Task 2.2 & Task 2.1 (atau mulai dari Task 1.1 & 1.2 jika ingin menyambungkan Supabase terlebih dahulu): Bangun `Response_Guard` (`lib/validation/response-guard.ts`) beserta Property-Based Tests-nya (`lib/validation/response-guard.test.ts`), diikuti oleh `Groq_Client` (`lib/ai/groq-client.ts`) dan Klien Supabase (`lib/supabase/`).**

### Mengapa Ini Titik Awal Paling Logis:
1. **Zero External Blocker & Langsung Dapat Diverifikasi Lokal:** `Response_Guard` dan `Groq_Client` hanya bergantung pada pustaka yang sudah terpasang (`zod`, `vitest`, `fast-check`) dan menjadi fondasi bersama yang dibutuhkan oleh **Modul 1** (validasi output Langkah 1 & Langkah 2), **Modul 2** (validasi ulang JSON dari database sebelum dirender Recharts), serta spesifikasi referensi untuk `worker-scraper/`.
2. **Menyelesaikan Kontrak Data di Seluruh Aplikasi:** Dengan menyelesaikan `lib/validation/response-guard.ts` dan `lib/supabase/` (`client.ts`, `server.ts`, migrasi SQL `0001_init_rintisin_schema.sql`), seluruh Server Actions / API Routes untuk Autentikasi (Phase 1), Modul 1 (Phase 3), dan Modul 2 (Phase 4) dapat langsung dihubungkan ke komponen UI yang sudah selesai tanpa perlu mengubah struktur komponen dashboard.

**Contoh Prompt Berikutnya untuk Developer:**
> *"Implementasikan Phase 1 (Task 1.1–1.3) dan Phase 2 (Task 2.1–2.2) dari `implementation_plan.md`: buat migrasi SQL Supabase beserta RLS, inisialisasi klien Supabase SSR & middleware proteksi rute `/dashboard`, hubungkan `auth-forms.tsx` & `app-shell.tsx` ke Supabase Auth, lalu bangun `lib/ai/groq-client.ts` dan `lib/validation/response-guard.ts` lengkap dengan unit & property-based test Vitest/Fast-Check."*
