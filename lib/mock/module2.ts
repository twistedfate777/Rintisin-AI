// TEMPORARY MOCK DATA. Replace with Supabase reads of module2_radars filled by the Scraper_Worker.
// Kopi Senja Utama comes from the product brief; the other two competitors are invented samples.

import type {
  CompetitorBreakdown,
  FailedCompetitor,
  Module2Result,
  PlaybookItem,
  RadarJob,
} from "@/lib/types";

export const mockUrls = [
  "https://maps.app.goo.gl/kopiSenjaUtama01",
  "https://www.google.com/maps/place/Ruang+Seduh+Kalibata/@-6.2551,106.8541,17z",
  "https://maps.app.goo.gl/kedaiKopiTetangga7",
];

interface SampledCompetitor {
  breakdown: CompetitorBreakdown;
  /** Reviews in this competitor's Sampel_Terstratifikasi (≤ 80). */
  sampleSize: number;
}

const competitors: SampledCompetitor[] = [
  {
    sampleSize: 80,
    breakdown: {
      competitor_name: "Kopi Senja Utama",
      avg_rating: 4.3,
      sentiment_distribution: { positive: 68, neutral: 12, negative: 20 },
      core_strengths: [
        "Rasa kopi konsisten dan creamy",
        "Harga terjangkau untuk mahasiswa (Rp 15.000 - Rp 22.000)",
      ],
      exploitable_weaknesses: [
        "AC ruang indoor sering dikeluhkan panas saat siang hari",
        "Koneksi Wi-Fi sering mati sehingga pelanggan WFC kecewa",
        "Staf kasir dinilai kurang ramah saat antrean panjang",
      ],
      aspect_scores: {
        product_quality: 85,
        pricing_value: 90,
        service_speed: 45,
        ambience_facility: 50,
      },
    },
  },
  {
    sampleSize: 80,
    breakdown: {
      competitor_name: "Ruang Seduh Kalibata",
      avg_rating: 4.5,
      sentiment_distribution: { positive: 74, neutral: 14, negative: 12 },
      core_strengths: [
        "Ruang indoor luas dan sejuk, cocok untuk kerja seharian",
        "Pilihan biji kopi lokal single origin berganti tiap bulan",
      ],
      exploitable_weaknesses: [
        "Harga kopi susu Rp 28.000 - Rp 35.000 dinilai mahal untuk pelanggan harian",
        "Pesanan ojek online menumpuk saat jam makan siang, rata-rata menunggu 30 menit",
      ],
      aspect_scores: {
        product_quality: 88,
        pricing_value: 52,
        service_speed: 40,
        ambience_facility: 86,
      },
    },
  },
  {
    sampleSize: 64,
    breakdown: {
      competitor_name: "Kedai Kopi Tetangga",
      avg_rating: 4.1,
      sentiment_distribution: { positive: 58, neutral: 17, negative: 25 },
      core_strengths: [
        "Lokasi di pinggir jalan utama, mudah dijangkau ojek online",
        "Buka sampai pukul 01.00 setiap hari",
      ],
      exploitable_weaknesses: [
        "Gelas plastik takeaway sering bocor di perjalanan",
        "Rasa kopi susu tidak konsisten antar barista",
        "Parkir motor hanya muat 6 unit dan sering penuh",
      ],
      aspect_scores: {
        product_quality: 62,
        pricing_value: 78,
        service_speed: 55,
        ambience_facility: 38,
      },
    },
  },
];

const playbook: PlaybookItem[] = [
  {
    target_weakness: "Layanan lambat & kemasan takeaway kompetitor sering bocor",
    actionable_strategy:
      "Terapkan garansi 'Saji 5 Menit untuk Menu Kopi Susu' dan gunakan cup sealer otomatis (bukan tutup cembung biasa) sebagai nilai jual utama di aplikasi pesan-antar.",
    marketing_hook: "Kopi Creamy Tanpa Antre Lama & Dijamin Anti Tumpah Sampai Tujuan!",
  },
  {
    target_weakness:
      "Harga kopi susu kompetitor premium (Rp 28.000 - Rp 35.000) terasa berat untuk pelanggan harian",
    actionable_strategy:
      "Luncurkan paket langganan 10 cup kopi susu seharga Rp 170.000 (Rp 17.000 per cup) yang ditebus lewat QR di kasir, khusus pekerja kantor dalam radius 2 km.",
    marketing_hook: "Ngopi Tiap Hari Tanpa Mikir Dompet: Rp 17.000 per Cup dengan Paket Langganan!",
  },
  {
    target_weakness: "Wi-Fi tidak stabil dan ruang indoor panas di kedai kompetitor",
    actionable_strategy:
      "Sediakan zona kerja 12 kursi dengan colokan di setiap meja, Wi-Fi fiber 100 Mbps dengan modem 4G cadangan, dan tulis hasil uji kecepatan harian di papan depan kedai.",
    marketing_hook: "WFC Anti Putus: Wi-Fi 100 Mbps, AC Dingin, Colokan di Setiap Meja.",
  },
];

/** Builds a result from the competitors that succeeded; the total is summed from their samples. */
function buildResult(included: SampledCompetitor[], items: PlaybookItem[]): Module2Result {
  return {
    market_overview: {
      total_reviews_analyzed: included.reduce((sum, c) => sum + c.sampleSize, 0),
      dominant_market_complaint:
        "Waktu tunggu penyajian sangat lama saat jam sibuk (di atas 25 menit) dan area parkir motor tidak memadai.",
      unmet_customer_need:
        "Pelanggan mencari tempat dengan kecepatan saji tinggi (grab-and-go) dan opsi kemasan anti-tumpah untuk ojek online.",
    },
    competitors_breakdown: included.map((c) => c.breakdown),
    steal_the_market_playbook: items,
  };
}

/** A result for a mock run over `count` URLs (1–3), so the competitor count matches the input. */
export function mockResultFor(count: number): Module2Result {
  const n = Math.min(3, Math.max(1, count));
  return buildResult(competitors.slice(0, n), playbook.slice(0, n));
}

export const mockResultFull = buildResult(competitors, playbook);
export const mockResultPartial = buildResult(competitors.slice(0, 2), playbook.slice(0, 2));
export const mockResultEmptyPlaybook = buildResult(competitors, []);

export const mockFailedCompetitors: FailedCompetitor[] = [
  { maps_url: mockUrls[2], reason: "URL Google Maps tidak dapat dikenali" },
];

export const DISPATCH_ERROR = "Server analisis sedang tidak tersedia. Silakan coba lagi.";
export const TIMEOUT_ERROR = "Analisis melebihi batas waktu. Silakan coba lagi.";

export const mockRadarHistory: RadarJob[] = [
  {
    id: "ps-91d4b7",
    created_at: "2026-10-18T09:05:00.000Z",
    maps_urls: mockUrls,
    status: "COMPLETED",
    result: mockResultFull,
    failed_competitors: [],
    error_message: null,
    is_degraded: false,
  },
  {
    id: "ps-3e70a2",
    created_at: "2026-10-16T12:40:00.000Z",
    maps_urls: mockUrls,
    status: "COMPLETED",
    result: mockResultPartial,
    failed_competitors: mockFailedCompetitors,
    error_message: null,
    is_degraded: false,
  },
  {
    id: "ps-0b58f1",
    created_at: "2026-10-15T02:18:00.000Z",
    maps_urls: mockUrls.slice(0, 2),
    status: "FAILED",
    result: null,
    failed_competitors: [],
    error_message: DISPATCH_ERROR,
    is_degraded: false,
  },
];

// Figures that must agree (app-screens §2.1).
for (const c of competitors) {
  const s = c.breakdown.sentiment_distribution;
  console.assert(s.positive + s.neutral + s.negative === 100, `${c.breakdown.competitor_name}: sentiment must sum to 100`);
  console.assert(c.sampleSize <= 80, "a stratified sample holds at most 80 reviews");
}
console.assert(mockResultFull.market_overview.total_reviews_analyzed === 224, "80 + 80 + 64 = 224");
console.assert(mockResultPartial.market_overview.total_reviews_analyzed === 160, "80 + 80 = 160");
