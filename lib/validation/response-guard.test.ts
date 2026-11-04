import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { mockStep1, mockStep2 } from "@/lib/mock/module1";
import { mockResultFull } from "@/lib/mock/module2";
import {
  DEFAULT_SENTIMENT,
  DEFAULT_TEXT,
  coerceBoolean,
  coerceFiniteNumber,
  guardModule2Object,
  guardStep1Object,
  guardStep1Response,
  guardStep2Object,
  guardStep2Response,
  guardStoredModule2,
  guardStoredStep1,
  guardStoredStep2,
  module2ResultSchema,
  step1ResultSchema,
  step2ResultSchema,
} from "@/lib/validation/response-guard";

describe("Type Coercion & Clamping (Requirement 12.3, 12.4)", () => {
  it("coerces clean numeric strings and boolean strings without marking degraded (Req 12.3)", () => {
    expect(coerceFiniteNumber("85")).toEqual({ ok: true, value: 85 });
    expect(coerceFiniteNumber(" -12.5 ")).toEqual({ ok: true, value: -12.5 });
    expect(coerceFiniteNumber("Rp 1.200.000")).toEqual({ ok: false });
    expect(coerceFiniteNumber("85%")).toEqual({ ok: false });
    expect(coerceFiniteNumber("1e5")).toEqual({ ok: false });
    expect(coerceFiniteNumber("")).toEqual({ ok: false });

    expect(coerceBoolean("true")).toEqual({ ok: true, value: true });
    expect(coerceBoolean(" false ")).toEqual({ ok: true, value: false });
    expect(coerceBoolean("yes")).toEqual({ ok: false });
  });

  it("clamps finite 0–100 numbers and coerces numeric strings without setting is_degraded = true (Req 12.3, 12.4)", () => {
    const raw = {
      feasibility_audit: {
        ...mockStep1.feasibility_audit,
        estimated_cogs_idr: "18000",
        recommended_selling_price_idr: "35000",
        gross_margin_percentage: "48.6",
        trend_sustainability: {
          ...mockStep1.feasibility_audit.trend_sustainability,
          saturation_score: 145, // above 100 -> clamped to 100 without degradation
        },
      },
      target_market_mapper: mockStep1.target_market_mapper,
    };

    const result = guardStep1Object(raw);
    expect(result.is_degraded).toBe(false);
    expect(result.data.feasibility_audit.estimated_cogs_idr).toBe(18000);
    expect(result.data.feasibility_audit.recommended_selling_price_idr).toBe(35000);
    expect(result.data.feasibility_audit.trend_sustainability.saturation_score).toBe(100);
    expect(step1ResultSchema.safeParse(result.data).success).toBe(true);
  });
});

describe("Domain Repairs in Response_Guard (Requirements 6.6–6.7, 7.3–7.4, 9.5, 19.8)", () => {
  it("replaces gross_margin_percentage when discrepancy > 1 percentage point, and keeps it when <= 1 (Req 6.6, 6.7)", () => {
    // True margin for 35,000 and 18,000 is 48.571...% (48.6%)
    const closeMargin = guardStep1Object({
      ...mockStep1,
      feasibility_audit: {
        ...mockStep1.feasibility_audit,
        gross_margin_percentage: 49.2, // |49.2 - 48.571| = 0.628 <= 1 -> kept as 49.2
      },
    });
    expect(closeMargin.data.feasibility_audit.gross_margin_percentage).toBe(49.2);

    const farMargin = guardStep1Object({
      ...mockStep1,
      feasibility_audit: {
        ...mockStep1.feasibility_audit,
        gross_margin_percentage: 70.0, // |70 - 48.571| > 1 -> replaced with 48.6
      },
    });
    expect(farMargin.data.feasibility_audit.gross_margin_percentage).toBe(48.6);
  });

  it("sorts effective_channels by priority (ties broken by index), renumbers 1..N, and caps lists at 5 (Req 7.3, 7.4)", () => {
    const raw = {
      ...mockStep1,
      target_market_mapper: {
        primary_segment: {
          ...mockStep1.target_market_mapper.primary_segment,
          core_pain_points: ["P1", "P2", "P3", "P4", "P5", "P6", "P7"],
        },
        effective_channels: [
          { channel_name: "C-Tie-First", strategy: "S1", priority: 5 },
          { channel_name: "C-Lowest", strategy: "S2", priority: 2 },
          { channel_name: "C-Tie-Second", strategy: "S3", priority: 5 },
          { channel_name: "C4", strategy: "S4", priority: 10 },
          { channel_name: "C5", strategy: "S5", priority: 20 },
          { channel_name: "C6-Dropped", strategy: "S6", priority: 30 },
        ],
      },
    };

    const guarded = guardStep1Object(raw);
    expect(guarded.is_degraded).toBe(false);
    expect(guarded.data.target_market_mapper.primary_segment.core_pain_points).toEqual([
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
    ]);
    expect(guarded.data.target_market_mapper.effective_channels).toEqual([
      { channel_name: "C-Lowest", strategy: "S2", priority: 1 },
      { channel_name: "C-Tie-First", strategy: "S1", priority: 2 },
      { channel_name: "C-Tie-Second", strategy: "S3", priority: 3 },
      { channel_name: "C4", strategy: "S4", priority: 4 },
      { channel_name: "C5", strategy: "S5", priority: 5 },
    ]);
  });

  it("renumbers priority_action_plan step_number to 1..N while keeping relative model order (Req 9.5)", () => {
    const raw = {
      ...mockStep2,
      gtm_readiness: {
        ...mockStep2.gtm_readiness,
        priority_action_plan: [
          { step_number: 3, phase: "Fase A", action: "Aksi A" },
          { step_number: 3, phase: "Fase B", action: "Aksi B" },
          { step_number: 9, phase: "Fase C", action: "Aksi C" },
        ],
      },
    };

    const guarded = guardStep2Object(raw);
    expect(guarded.is_degraded).toBe(false);
    expect(guarded.data.gtm_readiness.priority_action_plan.map((s) => s.step_number)).toEqual([1, 2, 3]);
    expect(guarded.data.gtm_readiness.priority_action_plan.map((s) => s.phase)).toEqual([
      "Fase A",
      "Fase B",
      "Fase C",
    ]);
  });

  it("normalizes sentiment_distribution to sum to 100 and marks all-zero sentiment as degraded (Req 19.8)", () => {
    const nonNormalized = guardModule2Object({
      ...mockResultFull,
      competitors_breakdown: [
        {
          ...mockResultFull.competitors_breakdown[0],
          sentiment_distribution: { positive: 60, neutral: 20, negative: 10 }, // sum = 90
        },
      ],
    });
    const dist = nonNormalized.data.competitors_breakdown[0].sentiment_distribution;
    expect(dist.positive + dist.neutral + dist.negative).toBe(100);
    expect(dist.positive).toBeGreaterThan(dist.neutral);
    expect(dist.neutral).toBeGreaterThan(dist.negative);
    expect(nonNormalized.is_degraded).toBe(false);

    const allZero = guardModule2Object({
      ...mockResultFull,
      competitors_breakdown: [
        {
          ...mockResultFull.competitors_breakdown[0],
          sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
        },
      ],
    });
    expect(allZero.is_degraded).toBe(true);
    expect(allZero.data.competitors_breakdown[0].sentiment_distribution).toEqual(DEFAULT_SENTIMENT);
  });
});

describe("JSON Parse Retry & Degradation (Requirement 12.2, 12.11)", () => {
  it("retries once via retryCall when initial text is invalid JSON and remaining time budget suffices (Req 12.2)", async () => {
    const retryCall = vi.fn().mockResolvedValueOnce({
      rawText: JSON.stringify(mockStep1),
      modelUsed: "openai/gpt-oss-20b" as const,
    });

    const out = await guardStep1Response({
      rawText: "{broken json",
      modelUsed: "openai/gpt-oss-120b",
      remainingTimeMs: 5000,
      retryCall,
    });

    expect(retryCall).toHaveBeenCalledTimes(1);
    expect(out.retried).toBe(true);
    expect(out.is_degraded).toBe(false);
    expect(out.modelUsed).toBe("openai/gpt-oss-20b");
    expect(out.data).toEqual(mockStep1);
  });

  it("skips retry when remaining time budget is too low and returns Nilai_Default with is_degraded = true (Req 12.11)", async () => {
    const retryCall = vi.fn();

    const out = await guardStep1Response({
      rawText: "not json at all",
      modelUsed: "openai/gpt-oss-120b",
      remainingTimeMs: 500,
      minRetryBudgetMs: 2000,
      retryCall,
    });

    expect(retryCall).not.toHaveBeenCalled();
    expect(out.retried).toBe(false);
    expect(out.is_degraded).toBe(true);
    expect(out.data.feasibility_audit.trend_sustainability.analysis).toBe(DEFAULT_TEXT);
    expect(step1ResultSchema.safeParse(out.data).success).toBe(true);
  });

  it("retries once and merges when initial JSON omits target_market_mapper or gtm_readiness", async () => {
    const step1Retry = vi.fn().mockResolvedValueOnce({
      rawText: JSON.stringify(mockStep1),
      modelUsed: "openai/gpt-oss-120b" as const,
    });

    const out1 = await guardStep1Response({
      rawText: JSON.stringify({ feasibility_audit: mockStep1.feasibility_audit }),
      modelUsed: "openai/gpt-oss-120b",
      remainingTimeMs: 5000,
      retryCall: step1Retry,
    });

    expect(step1Retry).toHaveBeenCalledTimes(1);
    expect(out1.retried).toBe(true);
    expect(out1.data.target_market_mapper).toEqual(mockStep1.target_market_mapper);

    const step2Retry = vi.fn().mockResolvedValueOnce({
      rawText: JSON.stringify(mockStep2),
      modelUsed: "openai/gpt-oss-120b" as const,
    });

    const out2 = await guardStep2Response({
      rawText: JSON.stringify({ competitor_matrix: mockStep2.competitor_matrix }),
      modelUsed: "openai/gpt-oss-120b",
      remainingTimeMs: 5000,
      retryCall: step2Retry,
    });

    expect(step2Retry).toHaveBeenCalledTimes(1);
    expect(out2.retried).toBe(true);
    expect(out2.data.gtm_readiness).toEqual(mockStep2.gtm_readiness);
  });

  it("unwraps flattened or aliased target_market_mapper and gtm_readiness keys", () => {
    const flattenedStep1 = guardStep1Object({
      feasibility_audit: mockStep1.feasibility_audit,
      primary_segment: mockStep1.target_market_mapper.primary_segment,
      effective_channels: mockStep1.target_market_mapper.effective_channels,
    });
    expect(flattenedStep1.data.target_market_mapper).toEqual(mockStep1.target_market_mapper);

    const flattenedStep2 = guardStep2Object({
      competitor_matrix: mockStep2.competitor_matrix,
      ...mockStep2.gtm_readiness,
    });
    expect(flattenedStep2.data.gtm_readiness).toEqual(mockStep2.gtm_readiness);
  });
});

describe("Property-Based Tests: Round-Trip & Anti-Crash Totality (Requirement 12.9, 12.10)", () => {
  it("satisfies JSON round-trip deep equality for all valid Step1, Step2, and Module2 results (Req 12.9)", () => {
    expect(step1ResultSchema.parse(JSON.parse(JSON.stringify(mockStep1)))).toEqual(mockStep1);
    expect(step2ResultSchema.parse(JSON.parse(JSON.stringify(mockStep2)))).toEqual(mockStep2);
    expect(module2ResultSchema.parse(JSON.parse(JSON.stringify(mockResultFull)))).toEqual(mockResultFull);

    fc.assert(
      fc.property(fc.jsonValue(), (arbitraryJson) => {
        const s1 = guardStep1Object(arbitraryJson).data;
        const s2 = guardStep2Object(arbitraryJson).data;
        const m2 = guardModule2Object(arbitraryJson).data;

        expect(step1ResultSchema.parse(JSON.parse(JSON.stringify(s1)))).toEqual(s1);
        expect(step2ResultSchema.parse(JSON.parse(JSON.stringify(s2)))).toEqual(s2);
        expect(module2ResultSchema.parse(JSON.parse(JSON.stringify(m2)))).toEqual(m2);
      }),
      { numRuns: 100 }
    );
  });

  it("never throws on arbitrary inputs, strips unknown keys, and always passes strict Zod schemas (Req 12.10)", () => {
    fc.assert(
      fc.property(fc.anything(), (anyInput) => {
        const g1 = guardStoredStep1(anyInput);
        const g2 = guardStoredStep2(anyInput);
        const gm2 = guardStoredModule2(anyInput);

        expect(step1ResultSchema.safeParse(g1.data).success).toBe(true);
        expect(step2ResultSchema.safeParse(g2.data).success).toBe(true);
        expect(module2ResultSchema.safeParse(gm2.data).success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
