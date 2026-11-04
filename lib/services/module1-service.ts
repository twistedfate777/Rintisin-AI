import {
  AI_SERVICE_ERROR_MESSAGE,
  callGroqJson,
  toUserAiErrorMessage,
  type GroqChatRequest,
  type GroqChatResponse,
  type GroqMessage,
} from "@/lib/ai/groq-client";
import type {
  GroqModelId,
  IdeaInput,
  KategoriEkraf,
  Module1Analysis,
  Step1Result,
  Step2Result,
  StepStatus,
} from "@/lib/types";
import {
  guardStep1Response,
  guardStep2Response,
  guardStoredStep1,
  guardStoredStep2,
  MIN_RETRY_BUDGET_MS,
} from "@/lib/validation/response-guard";

// ============================================================================
// Constants & System Prompt (Requirement 5.2, 5.4, 5.6, 5.9, 5.10)
// ============================================================================

export const MODULE1_MAX_TOKENS = 4096;
export const SERVER_STEP_DEADLINE_MS = 25_000;

/**
 * Exact system prompt required by Requirement 5.9.
 */
export const MODULE1_BASE_SYSTEM_PROMPT =
  "Anda adalah Senior Konsultan Strategi Bisnis & Auditor Kelayakan UMKM Ekonomi Kreatif di Indonesia. Tugas Anda adalah mengaudit draf ide produk dan estimasi modal pengguna secara objektif, kritis, dan realistis sesuai kondisi pasar, rantai pasok, serta daya beli masyarakat Indonesia. Jangan memberikan pujian kosong. Gunakan asumsi harga bahan baku, biaya komisi platform e-commerce lokal, dan logistik Indonesia yang nyata. Anda WAJIB merespons HANYA dalam format JSON yang valid sesuai dengan skema yang ditentukan di bawah ini.";

const LICENSING_BY_CATEGORY: Record<KategoriEkraf, string> = {
  KULINER: "NIB, PIRT, Sertifikasi Halal BPJPH, dan izin edar BPOM (untuk pangan olahan berisiko/beku)",
  FASHION: "NIB, pendaftaran merek HKI (DJKI), dan standar label SNI tekstil/pakaian bila relevan",
  KRIYA: "NIB, pendaftaran desain industri/merek HKI, dan SVLK/dokumen bahan baku lokal bila relevan",
  BEAUTY: "NIB, notifikasi BPOM kosmetik, CPKB/maklon resmi, dan Sertifikasi Halal",
};

const STEP1_JSON_SCHEMA_SPEC = `{
  "feasibility_audit": {
    "estimated_cogs_idr": number (bilangan bulat >= 0, estimasi HPP per unit dalam Rupiah),
    "recommended_selling_price_idr": number (bilangan bulat >= 0, rekomendasi harga jual per unit dalam Rupiah),
    "gross_margin_percentage": number (0-100, hingga 1 desimal, wajib sesuai rumus ((recommended_selling_price_idr - estimated_cogs_idr) / recommended_selling_price_idr) * 100),
    "financial_viability_status": "VIABLE" | "VIABLE_WITH_NOTES" | "NOT_VIABLE",
    "operational_risks": [
      {
        "aspect": string (Bahasa Indonesia),
        "risk_level": "LOW" | "MEDIUM" | "HIGH",
        "mitigation": string (langkah mitigasi praktis Bahasa Indonesia)
      }
    ],
    "trend_sustainability": {
      "category": "EVERGREEN_NICHE" | "EVERGREEN_MASS" | "RISING_TREND" | "FAD_PEAKING" | "DECLINING",
      "saturation_score": integer (0-100),
      "analysis": string (analisis tren Bahasa Indonesia)
    }
  },
  "target_market_mapper": {
    "primary_segment": {
      "persona_label": string (Bahasa Indonesia),
      "purchasing_power": string (daya beli sesuai kota target dalam Bahasa Indonesia),
      "core_pain_points": string[] (maksimal 5 butir Bahasa Indonesia),
      "buying_behavior": string (Bahasa Indonesia)
    },
    "effective_channels": [
      {
        "channel_name": string (Bahasa Indonesia),
        "strategy": string (strategi eksekusi Bahasa Indonesia),
        "priority": integer (1..N berurutan mulai dari 1, maksimal 5 kanal)
      }
    ]
  }
}`;

const STEP2_JSON_SCHEMA_SPEC = `{
  "competitor_matrix": {
    "recommended_uvp": string (rekomendasi nilai jual unik dalam Bahasa Indonesia),
    "comparison_table": [
      {
        "attribute": string (atribut pembanding dalam Bahasa Indonesia),
        "user_concept": string (konsep produk pengguna dalam Bahasa Indonesia),
        "local_incumbents": string (kondisi pemain lokal saat ini dalam Bahasa Indonesia),
        "competitive_advantage": string (keunggulan kompetitif dalam Bahasa Indonesia)
      }
    ]
  },
  "gtm_readiness": {
    "overall_score": integer (0-100),
    "readiness_verdict": string (putusan kesiapan dalam Bahasa Indonesia, contoh: "SIAP UJI PASAR TERBATAS (BETA LAUNCH)"),
    "mandatory_revisions": string[] (daftar revisi wajib sebelum produksi massal dalam Bahasa Indonesia),
    "priority_action_plan": [
      {
        "step_number": integer (1..N berurutan mulai dari 1),
        "phase": string (fase/minggu dalam Bahasa Indonesia),
        "action": string (langkah aksi konkret dalam Bahasa Indonesia)
      }
    ]
  }
}`;

/**
 * Builds messages for Modul_1 Langkah_1 (Requirement 5.2, 5.9, 5.10).
 */
export function buildStep1Messages(input: IdeaInput): GroqMessage[] {
  const licensingContext = LICENSING_BY_CATEGORY[input.category];
  return [
    {
      role: "system",
      content: `${MODULE1_BASE_SYSTEM_PROMPT}\n\nKetentuan Tambahan Wajib:\n1. Seluruh nilai teks WAJIB ditulis dalam Bahasa Indonesia yang profesional, tajam, dan praktis.\n2. Pertimbangkan logistik ekspedisi lokal Indonesia, daya beli spesifik di ${input.target_city}, potongan komisi marketplace/ojek online di Indonesia, serta perizinan yang relevan untuk kategori ${input.category} (${licensingContext}).\n3. Respons JSON Anda WAJIB memiliki KEDUA kunci level atas ("feasibility_audit" DAN "target_market_mapper") secara lengkap. Jangan mengosongkan "target_market_mapper", "primary_segment" (persona_label, purchasing_power, core_pain_points minimal 3 butir, buying_behavior), maupun "effective_channels" (minimal 3 kanal distribusi).\n\nSkema JSON Wajib (wajib memuat feasibility_audit dan target_market_mapper secara utuh):\n${STEP1_JSON_SCHEMA_SPEC}`,
    },
    {
      role: "user",
      content: JSON.stringify({
        product_idea: input.product_idea,
        category: input.category,
        initial_capital_idr: input.initial_capital_idr,
        target_city: input.target_city,
      }),
    },
  ];
}

/**
 * Builds a concise summary derived strictly from the stored Langkah_1 result (Requirement 5.4)
 * and constructs messages for Modul_1 Langkah_2 (Requirement 5.4, 5.9, 5.10).
 */
export function summarizeStep1ForStep2(step1Result: Step1Result) {
  return {
    feasibility_summary: {
      estimated_cogs_idr: step1Result.feasibility_audit.estimated_cogs_idr,
      recommended_selling_price_idr: step1Result.feasibility_audit.recommended_selling_price_idr,
      gross_margin_percentage: step1Result.feasibility_audit.gross_margin_percentage,
      financial_viability_status: step1Result.feasibility_audit.financial_viability_status,
      trend_category: step1Result.feasibility_audit.trend_sustainability.category,
      saturation_score: step1Result.feasibility_audit.trend_sustainability.saturation_score,
      key_risks: step1Result.feasibility_audit.operational_risks.map((r) => ({
        aspect: r.aspect,
        risk_level: r.risk_level,
      })),
    },
    target_market_summary: {
      persona_label: step1Result.target_market_mapper.primary_segment.persona_label,
      purchasing_power: step1Result.target_market_mapper.primary_segment.purchasing_power,
      core_pain_points: step1Result.target_market_mapper.primary_segment.core_pain_points,
      top_channels: step1Result.target_market_mapper.effective_channels.map((c) => c.channel_name),
    },
  };
}

export function buildStep2Messages(input: IdeaInput, step1Result: Step1Result): GroqMessage[] {
  const licensingContext = LICENSING_BY_CATEGORY[input.category];
  const step1Summary = summarizeStep1ForStep2(step1Result);

  return [
    {
      role: "system",
      content: `${MODULE1_BASE_SYSTEM_PROMPT}\n\nKetentuan Tambahan Wajib:\n1. Seluruh nilai teks WAJIB ditulis dalam Bahasa Indonesia yang profesional, tajam, dan praktis.\n2. Pertimbangkan logistik ekspedisi lokal Indonesia, daya beli spesifik di ${input.target_city}, potongan komisi marketplace/ojek online di Indonesia, serta perizinan yang relevan untuk kategori ${input.category} (${licensingContext}).\n3. Respons JSON Anda WAJIB memiliki KEDUA kunci level atas ("competitor_matrix" DAN "gtm_readiness") secara lengkap. Jangan mengosongkan "gtm_readiness" (overall_score 1-100, readiness_verdict, mandatory_revisions minimal 2 butir, dan priority_action_plan minimal 3 langkah).\n\nSkema JSON Wajib (wajib memuat competitor_matrix dan gtm_readiness secara utuh):\n${STEP2_JSON_SCHEMA_SPEC}`,
    },
    {
      role: "user",
      content: JSON.stringify({
        input: {
          product_idea: input.product_idea,
          category: input.category,
          initial_capital_idr: input.initial_capital_idr,
          target_city: input.target_city,
        },
        step1_context: step1Summary,
      }),
    },
  ];
}

// ============================================================================
// Database Row Mapping (Requirement 10.1, 10.3, 12.7, 12.12)
// ============================================================================

export interface Module1DbRow {
  id: string;
  user_id: string;
  product_idea: string;
  category: KategoriEkraf;
  initial_capital_idr: number | string;
  target_city: string;
  step1_status: StepStatus;
  step2_status: StepStatus;
  step1_result: unknown | null;
  step2_result: unknown | null;
  step1_model?: GroqModelId | null;
  step2_model?: GroqModelId | null;
  is_degraded: boolean;
  created_at: string;
}

/**
 * Maps a raw database row from `public.module1_analyses` to `Module1Analysis`,
 * re-validating stored JSON through Response_Guard before rendering (Requirement 12.7, 12.12).
 */
export function mapDbRowToModule1Analysis(row: Module1DbRow): Module1Analysis {
  let isDegraded = Boolean(row.is_degraded);
  let step1Result: Step1Result | null = null;
  let step2Result: Step2Result | null = null;

  if (row.step1_status === "SUCCESS" && row.step1_result !== null && row.step1_result !== undefined) {
    const guarded1 = guardStoredStep1(row.step1_result, isDegraded);
    step1Result = guarded1.data;
    isDegraded = isDegraded || guarded1.is_degraded;
  }

  if (row.step2_status === "SUCCESS" && row.step2_result !== null && row.step2_result !== undefined) {
    const guarded2 = guardStoredStep2(row.step2_result, isDegraded);
    step2Result = guarded2.data;
    isDegraded = isDegraded || guarded2.is_degraded;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    input: {
      product_idea: row.product_idea,
      category: row.category,
      initial_capital_idr: Number(row.initial_capital_idr),
      target_city: row.target_city,
    },
    step1_status: row.step1_status,
    step2_status: row.step2_status,
    step1_result: step1Result,
    step2_result: step2Result,
    step1_model: row.step1_model ?? null,
    step2_model: row.step2_model ?? null,
    is_degraded: isDegraded,
  };
}

// ============================================================================
// Step 1 & Step 2 Execution Engine (Requirement 5.2–5.11, 11.8, 12.1–12.11)
// ============================================================================

export type GroqCaller = (req: GroqChatRequest) => Promise<GroqChatResponse>;

export type StepExecutionOutcome<T> =
  | {
      ok: true;
      result: T;
      modelUsed: GroqModelId;
      isDegraded: boolean;
    }
  | {
      ok: false;
      userError: string;
    };

export async function runModule1Step1Ai(
  input: IdeaInput,
  caller: GroqCaller = callGroqJson,
  deadlineMs = SERVER_STEP_DEADLINE_MS
): Promise<StepExecutionOutcome<Step1Result>> {
  const startedAt = Date.now();
  const messages = buildStep1Messages(input);

  try {
    const firstCall = await caller({
      messages,
      maxTokens: MODULE1_MAX_TOKENS,
    });

    const elapsedAfterFirst = Date.now() - startedAt;
    if (elapsedAfterFirst > deadlineMs) {
      return { ok: false, userError: AI_SERVICE_ERROR_MESSAGE };
    }

    const remainingTimeMs = Math.max(0, deadlineMs - elapsedAfterFirst);
    const guarded = await guardStep1Response({
      rawText: firstCall.rawText,
      modelUsed: firstCall.modelUsed,
      remainingTimeMs,
      minRetryBudgetMs: MIN_RETRY_BUDGET_MS,
      retryCall: () =>
        caller({
          messages,
          maxTokens: MODULE1_MAX_TOKENS,
          timeoutMs: Math.min(8_000, Math.max(1_000, deadlineMs - (Date.now() - startedAt))),
        }),
    });

    if (Date.now() - startedAt > deadlineMs) {
      return { ok: false, userError: AI_SERVICE_ERROR_MESSAGE };
    }

    return {
      ok: true,
      result: guarded.data,
      modelUsed: guarded.modelUsed,
      isDegraded: guarded.is_degraded,
    };
  } catch (err) {
    return {
      ok: false,
      userError: toUserAiErrorMessage(err),
    };
  }
}

export async function runModule1Step2Ai(
  input: IdeaInput,
  step1Result: Step1Result,
  caller: GroqCaller = callGroqJson,
  deadlineMs = SERVER_STEP_DEADLINE_MS
): Promise<StepExecutionOutcome<Step2Result>> {
  const startedAt = Date.now();
  const messages = buildStep2Messages(input, step1Result);

  try {
    const firstCall = await caller({
      messages,
      maxTokens: MODULE1_MAX_TOKENS,
    });

    const elapsedAfterFirst = Date.now() - startedAt;
    if (elapsedAfterFirst > deadlineMs) {
      return { ok: false, userError: AI_SERVICE_ERROR_MESSAGE };
    }

    const remainingTimeMs = Math.max(0, deadlineMs - elapsedAfterFirst);
    const guarded = await guardStep2Response({
      rawText: firstCall.rawText,
      modelUsed: firstCall.modelUsed,
      remainingTimeMs,
      minRetryBudgetMs: MIN_RETRY_BUDGET_MS,
      retryCall: () =>
        caller({
          messages,
          maxTokens: MODULE1_MAX_TOKENS,
          timeoutMs: Math.min(8_000, Math.max(1_000, deadlineMs - (Date.now() - startedAt))),
        }),
    });

    if (Date.now() - startedAt > deadlineMs) {
      return { ok: false, userError: AI_SERVICE_ERROR_MESSAGE };
    }

    return {
      ok: true,
      result: guarded.data,
      modelUsed: guarded.modelUsed,
      isDegraded: guarded.is_degraded,
    };
  } catch (err) {
    return {
      ok: false,
      userError: toUserAiErrorMessage(err),
    };
  }
}
