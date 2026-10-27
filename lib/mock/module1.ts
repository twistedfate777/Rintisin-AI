// TEMPORARY MOCK DATA. Replace with Supabase reads and the Groq-backed Analysis_Service.
// Nothing in this file is real output; it mirrors the example JSON from the product brief.

import type { IdeaInput, Module1Analysis, Step1Result, Step2Result } from "@/lib/types";
import { grossMargin } from "@/lib/numbers";

const COGS = 18_000;
const PRICE = 35_000;

export const mockStep1: Step1Result = {
  feasibility_audit: {
    estimated_cogs_idr: COGS,
    recommended_selling_price_idr: PRICE,
    // (35.000 − 18.000) ÷ 35.000 × 100 = 48,57… → 48,6
    gross_margin_percentage: grossMargin(PRICE, COGS),
    financial_viability_status: "VIABLE_WITH_NOTES",
    operational_risks: [
      {
        aspect: "Logistik & Pengiriman",
        risk_level: "HIGH",
        mitigation:
          "Gunakan kemasan vakum berlapis aluminium foil karena produk rentan tengik di suhu ruang pengiriman reguler >3 hari.",
      },
      {
        aspect: "Masa Simpan (Shelf Life)",
        risk_level: "MEDIUM",
        mitigation:
          "Tanpa pengawet buatan, batas aman konsumsi hanya 14 hari; wajib terapkan sistem Pre-Order (Made to Order) di bulan pertama.",
      },
    ],
    trend_sustainability: {
      category: "EVERGREEN_NICHE",
      saturation_score: 65,
      analysis:
        "Pasar sambal kemas sudah padat pemain besar, namun segmen sambal rendah natrium/healthy condiment masih sangat terbuka di kota Tier-1.",
    },
  },
  target_market_mapper: {
    primary_segment: {
      persona_label: "Pekerja Urban Sadar Kesehatan (24-35 Tahun)",
      purchasing_power: "Menengah ke Atas (Pengeluaran F&B > Rp 2.000.000/bulan)",
      core_pain_points: [
        "Bosan dengan makanan diet yang hambar",
        "Khawatir kandungan MSG dan minyak berlebih pada sambal kemasan biasa",
      ],
      buying_behavior:
        "Membeli berdasarkan ulasan komposisi gizi (nutrition facts) dan rekomendasi kreator kebugaran/kesehatan.",
    },
    effective_channels: [
      {
        channel_name: "TikTok Shop & Reels (Organic Content)",
        strategy: "Edukasi bedah komposisi kalori dibanding sambal konvensional.",
        priority: 1,
      },
      {
        channel_name: "Kemitraan Katering Diet Lokal",
        strategy: "Bundling sachet sampel gratis ke pelanggan katering sehat mingguan.",
        priority: 2,
      },
    ],
  },
};

export const mockStep2: Step2Result = {
  competitor_matrix: {
    recommended_uvp:
      "Sambal Nusantara rendah kalori pertama dengan takaran saji terukur (kalori tertulis jelas per sendok makan) menggunakan minyak kelapa murni.",
    comparison_table: [
      {
        attribute: "Bahan Dasar Minyak",
        user_concept: "Minyak Kelapa (Virgin Coconut Oil)",
        local_incumbents: "Minyak Sawit Curah / Kemasan Standar",
        competitive_advantage:
          "Tidak memicu radang tenggorokan dan tidak meninggalkan lapisan minyak beku.",
      },
      {
        attribute: "Rentang Harga (150g)",
        user_concept: "Rp 35.000 - Rp 42.000",
        local_incumbents: "Rp 18.000 - Rp 25.000",
        competitive_advantage:
          "Hindari perang harga dengan masuk ke kategori produk fungsional/kesehatan, bukan sembako harian.",
      },
    ],
  },
  gtm_readiness: {
    overall_score: 74,
    readiness_verdict: "SIAP UJI PASAR TERBATAS (BETA LAUNCH)",
    mandatory_revisions: [
      "Ubah kemasan dari toples kaca (berat di ongkir) menjadi standing pouch retort food-grade untuk menekan biaya pengiriman hingga 40%.",
      "Cetak label informasi nilai gizi sederhana di bagian depan kemasan sebagai pembeda visual utama.",
    ],
    priority_action_plan: [
      {
        step_number: 1,
        phase: "Validasi Produk (Minggu 1-2)",
        action:
          "Produksi 30 pak sampel ukuran 50g dan bagikan ke komunitas gym/lari lokal untuk menguji ketahanan rasa dan kemasan.",
      },
      {
        step_number: 2,
        phase: "Perizinan & Legalitas Dasar (Minggu 3)",
        action:
          "Urus NIB dan pendaftaran PIRT melalui OSS secara gratis sebelum membuka etalase di marketplace.",
      },
    ],
  },
};

/** A Langkah 1 result where the guard had to fill defaults: empty lists, a default text. */
export const mockStep1Degraded: Step1Result = {
  feasibility_audit: {
    ...mockStep1.feasibility_audit,
    operational_risks: [],
    trend_sustainability: {
      category: "UNKNOWN_CODE",
      saturation_score: 65,
      analysis: "Data tidak tersedia",
    },
  },
  target_market_mapper: {
    primary_segment: { ...mockStep1.target_market_mapper.primary_segment, core_pain_points: [] },
    effective_channels: [],
  },
};

/** A Langkah 2 result with every list empty, for the empty states. */
export const mockStep2Empty: Step2Result = {
  competitor_matrix: { ...mockStep2.competitor_matrix, comparison_table: [] },
  gtm_readiness: {
    ...mockStep2.gtm_readiness,
    mandatory_revisions: [],
    priority_action_plan: [],
  },
};

export const mockIdeaInput: IdeaInput = {
  product_idea:
    "Sambal bawang rendah kalori dalam kemasan 150g, dimasak dengan minyak kelapa murni tanpa MSG dan tanpa pengawet, dengan takaran kalori per sendok tertulis di label.",
  category: "KULINER",
  initial_capital_idr: 15_000_000,
  target_city: "Jakarta Selatan",
};

export const mockModule1History: Module1Analysis[] = [
  {
    id: "lt-7f3a21",
    created_at: "2026-10-18T07:22:00.000Z",
    input: mockIdeaInput,
    step1_status: "SUCCESS",
    step2_status: "SUCCESS",
    step1_result: mockStep1,
    step2_result: mockStep2,
    is_degraded: false,
  },
  {
    id: "lt-52c9e0",
    created_at: "2026-10-12T03:05:00.000Z",
    input: {
      product_idea:
        "Sabun mandi padat dari ampas kopi Gayo bekas kedai, dengan minyak zaitun dan tanpa pewangi sintetis, dijual per batang 100g.",
      category: "BEAUTY",
      initial_capital_idr: 8_500_000,
      target_city: "Yogyakarta",
    },
    step1_status: "FAILED",
    step2_status: "IDLE",
    step1_result: null,
    step2_result: null,
    is_degraded: false,
  },
];

// Figures that must agree (app-screens §2.1).
console.assert(
  mockStep1.feasibility_audit.gross_margin_percentage === 48.6,
  "mock margin must equal (price − cogs) ÷ price"
);
