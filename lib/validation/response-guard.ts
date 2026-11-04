import { z } from "zod";
import { clampRating, clampScore, grossMargin } from "@/lib/numbers";
import type {
  ActionStep,
  AspectScores,
  ComparisonRow,
  CompetitorBreakdown,
  EffectiveChannel,
  FeasibilityAudit,
  GroqModelId,
  Module2Result,
  OperationalRisk,
  PlaybookItem,
  RiskLevel,
  SentimentDistribution,
  Step1Result,
  Step2Result,
  TargetMarketMapper,
  ViabilityStatus,
} from "@/lib/types";

// ============================================================================
// Nilai_Default Constants (Glossary & Requirement 12.5, 12.11)
// ============================================================================

export const DEFAULT_TEXT = "Data tidak tersedia";
export const DEFAULT_NUMBER = 0;
export const DEFAULT_VIABILITY_STATUS: ViabilityStatus = "VIABLE_WITH_NOTES";
export const DEFAULT_RISK_LEVEL: RiskLevel = "MEDIUM";
export const DEFAULT_SENTIMENT: SentimentDistribution = {
  positive: 34,
  neutral: 33,
  negative: 33,
};

const VIABILITY_VALUES: readonly ViabilityStatus[] = ["VIABLE", "VIABLE_WITH_NOTES", "NOT_VIABLE"];
const RISK_VALUES: readonly RiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

// ============================================================================
// Target Zod Schemas (Lampiran A & Requirement 12.1, 12.7, 12.9, 12.10)
// ============================================================================

export const operationalRiskSchema = z
  .object({
    aspect: z.string().min(1),
    risk_level: z.enum(["LOW", "MEDIUM", "HIGH"]),
    mitigation: z.string().min(1),
  })
  .strict();

export const feasibilityAuditSchema = z
  .object({
    estimated_cogs_idr: z.number().finite().min(0),
    recommended_selling_price_idr: z.number().finite().min(0),
    gross_margin_percentage: z.number().finite().min(0).max(100),
    financial_viability_status: z.enum(["VIABLE", "VIABLE_WITH_NOTES", "NOT_VIABLE"]),
    operational_risks: z.array(operationalRiskSchema),
    trend_sustainability: z
      .object({
        category: z.string().min(1),
        saturation_score: z.number().int().min(0).max(100),
        analysis: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const effectiveChannelSchema = z
  .object({
    channel_name: z.string().min(1),
    strategy: z.string().min(1),
    priority: z.number().int().min(1),
  })
  .strict();

export const targetMarketMapperSchema = z
  .object({
    primary_segment: z
      .object({
        persona_label: z.string().min(1),
        purchasing_power: z.string().min(1),
        core_pain_points: z.array(z.string().min(1)).max(5),
        buying_behavior: z.string().min(1),
      })
      .strict(),
    effective_channels: z.array(effectiveChannelSchema).max(5),
  })
  .strict();

export const step1ResultSchema = z
  .object({
    feasibility_audit: feasibilityAuditSchema,
    target_market_mapper: targetMarketMapperSchema,
  })
  .strict();

export const comparisonRowSchema = z
  .object({
    attribute: z.string().min(1),
    user_concept: z.string().min(1),
    local_incumbents: z.string().min(1),
    competitive_advantage: z.string().min(1),
  })
  .strict();

export const actionStepSchema = z
  .object({
    step_number: z.number().int().min(1),
    phase: z.string().min(1),
    action: z.string().min(1),
  })
  .strict();

export const step2ResultSchema = z
  .object({
    competitor_matrix: z
      .object({
        recommended_uvp: z.string().min(1),
        comparison_table: z.array(comparisonRowSchema),
      })
      .strict(),
    gtm_readiness: z
      .object({
        overall_score: z.number().int().min(0).max(100),
        readiness_verdict: z.string().min(1),
        mandatory_revisions: z.array(z.string().min(1)),
        priority_action_plan: z.array(actionStepSchema),
      })
      .strict(),
  })
  .strict();

export const sentimentDistributionSchema = z
  .object({
    positive: z.number().int().min(0).max(100),
    neutral: z.number().int().min(0).max(100),
    negative: z.number().int().min(0).max(100),
  })
  .strict()
  .refine((s) => s.positive + s.neutral + s.negative === 100, {
    message: "Sentiment distribution must sum to 100",
  });

export const aspectScoresSchema = z
  .object({
    product_quality: z.number().int().min(0).max(100),
    pricing_value: z.number().int().min(0).max(100),
    service_speed: z.number().int().min(0).max(100),
    ambience_facility: z.number().int().min(0).max(100),
  })
  .strict();

export const competitorBreakdownSchema = z
  .object({
    competitor_name: z.string().min(1),
    avg_rating: z.number().finite().min(0).max(5),
    sentiment_distribution: sentimentDistributionSchema,
    core_strengths: z.array(z.string().min(1)),
    exploitable_weaknesses: z.array(z.string().min(1)),
    aspect_scores: aspectScoresSchema,
  })
  .strict();

export const playbookItemSchema = z
  .object({
    target_weakness: z.string().min(1),
    actionable_strategy: z.string().min(1),
    marketing_hook: z.string().min(1),
  })
  .strict();

export const module2ResultSchema = z
  .object({
    market_overview: z
      .object({
        total_reviews_analyzed: z.number().int().min(0).max(240),
        dominant_market_complaint: z.string().min(1),
        unmet_customer_need: z.string().min(1),
      })
      .strict(),
    competitors_breakdown: z.array(competitorBreakdownSchema).max(3),
    steal_the_market_playbook: z.array(playbookItemSchema),
  })
  .strict();

// ============================================================================
// Primitive Coercion, Clamping & Fallback Helpers (Requirement 12.3, 12.4, 12.5)
// ============================================================================

const NUMERIC_STRING_PATTERN = /^-?\d+(\.\d+)?$/;

interface GuardTracker {
  degraded: boolean;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function asRecord(value: unknown, tracker: GuardTracker): Record<string, unknown> {
  if (isPlainRecord(value)) {
    return value;
  }
  tracker.degraded = true;
  return {};
}

/**
 * Requirement 12.3: Coerces numeric strings matching `/^-?\d+(\.\d+)?$/` after trimming
 * without marking `is_degraded = true`. Rejects formatted strings like "Rp 1.200.000" or "85%".
 */
export function coerceFiniteNumber(value: unknown): { ok: true; value: number } | { ok: false } {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return { ok: true, value: Object.is(value, -0) ? 0 : value };
    }
    return { ok: false };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (NUMERIC_STRING_PATTERN.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return { ok: true, value: Object.is(parsed, -0) ? 0 : parsed };
      }
    }
  }
  return { ok: false };
}

/**
 * Requirement 12.3: Coerces "true" / "false" strings after trimming to boolean
 * without marking `is_degraded = true`.
 */
export function coerceBoolean(value: unknown): { ok: true; value: boolean } | { ok: false } {
  if (typeof value === "boolean") return { ok: true, value };
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "true") return { ok: true, value: true };
    if (trimmed === "false") return { ok: true, value: false };
  }
  return { ok: false };
}

function guardNonEmptyString(value: unknown, tracker: GuardTracker, fallback = DEFAULT_TEXT): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  tracker.degraded = true;
  return fallback;
}

function guardEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  tracker: GuardTracker
): T {
  if (typeof value === "string") {
    const trimmed = value.trim() as T;
    if (allowed.includes(trimmed)) return trimmed;
  }
  tracker.degraded = true;
  return fallback;
}

function guardNonNegativeNumber(
  value: unknown,
  tracker: GuardTracker,
  integer = true,
  fallback = DEFAULT_NUMBER
): number {
  const coerced = coerceFiniteNumber(value);
  if (!coerced.ok || coerced.value < 0) {
    tracker.degraded = true;
    return fallback;
  }
  const normalized = integer ? Math.round(coerced.value) : coerced.value;
  return Object.is(normalized, -0) ? 0 : normalized;
}

/**
 * Requirement 12.4: Finite numbers on 0–100 scale are clamped to [0, 100] WITHOUT marking
 * the result as degraded. NaN, Infinity, or non-numeric values get Nilai_Default and mark degraded.
 */
function guardScore0To100(
  value: unknown,
  tracker: GuardTracker,
  integer = true,
  fallback = DEFAULT_NUMBER
): { value: number; wasValid: boolean } {
  const coerced = coerceFiniteNumber(value);
  if (!coerced.ok) {
    tracker.degraded = true;
    return { value: fallback, wasValid: false };
  }
  const clamped = clampScore(coerced.value);
  const finalValue = integer ? Math.round(clamped) : Math.round(clamped * 10) / 10;
  return { value: Object.is(finalValue, -0) ? 0 : finalValue, wasValid: true };
}

function guardStringArray(value: unknown, tracker: GuardTracker, maxItems?: number): string[] {
  if (!Array.isArray(value)) {
    tracker.degraded = true;
    return [];
  }
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim().length > 0) {
      result.push(item.trim());
    } else {
      tracker.degraded = true;
    }
  }
  return typeof maxItems === "number" ? result.slice(0, maxItems) : result;
}

// ============================================================================
// Domain-Specific Guard Implementations
// ============================================================================

export interface GuardResult<T> {
  data: T;
  is_degraded: boolean;
}

/**
 * Guards and repairs Step1Result (Requirement 6.6, 6.7, 7.3, 7.4, 12.1–12.5).
 */
export function guardStep1Object(raw: unknown): GuardResult<Step1Result> {
  const tracker: GuardTracker = { degraded: false };
  const root = asRecord(raw, tracker);

  // 1. feasibility_audit
  const auditRaw = asRecord(root.feasibility_audit, tracker);
  const cogs = guardNonNegativeNumber(auditRaw.estimated_cogs_idr, tracker, true, DEFAULT_NUMBER);
  const price = guardNonNegativeNumber(
    auditRaw.recommended_selling_price_idr,
    tracker,
    true,
    DEFAULT_NUMBER
  );
  const marginGuard = guardScore0To100(auditRaw.gross_margin_percentage, tracker, false, DEFAULT_NUMBER);

  // Requirement 6.6 & 6.7: recalculate gross_margin_percentage if price > 0 and difference > 1 percentage point.
  let finalMargin = marginGuard.value;
  if (price > 0) {
    const exactFormulaMargin = ((price - cogs) / price) * 100;
    if (!marginGuard.wasValid || Math.abs(marginGuard.value - exactFormulaMargin) > 1) {
      finalMargin = grossMargin(price, cogs);
    }
  }

  const viabilityStatus = guardEnum(
    auditRaw.financial_viability_status,
    VIABILITY_VALUES,
    DEFAULT_VIABILITY_STATUS,
    tracker
  );

  const operationalRisks: OperationalRisk[] = [];
  if (!Array.isArray(auditRaw.operational_risks)) {
    tracker.degraded = true;
  } else {
    for (const item of auditRaw.operational_risks) {
      const row = asRecord(item, tracker);
      operationalRisks.push({
        aspect: guardNonEmptyString(row.aspect, tracker),
        risk_level: guardEnum(row.risk_level, RISK_VALUES, DEFAULT_RISK_LEVEL, tracker),
        mitigation: guardNonEmptyString(row.mitigation, tracker),
      });
    }
  }

  const trendRaw = asRecord(auditRaw.trend_sustainability, tracker);
  const trendCategory = guardNonEmptyString(trendRaw.category, tracker);
  const saturationScore = guardScore0To100(trendRaw.saturation_score, tracker, true, DEFAULT_NUMBER).value;
  const trendAnalysis = guardNonEmptyString(trendRaw.analysis, tracker);

  const feasibility_audit: FeasibilityAudit = {
    estimated_cogs_idr: cogs,
    recommended_selling_price_idr: price,
    gross_margin_percentage: finalMargin,
    financial_viability_status: viabilityStatus,
    operational_risks: operationalRisks,
    trend_sustainability: {
      category: trendCategory,
      saturation_score: saturationScore,
      analysis: trendAnalysis,
    },
  };

  // 2. target_market_mapper
  let mapperRaw: Record<string, unknown>;
  if (hasOwn(root, "target_market_mapper") && isPlainRecord(root.target_market_mapper)) {
    mapperRaw = root.target_market_mapper;
  } else if (hasOwn(root, "target_market") && isPlainRecord(root.target_market)) {
    tracker.degraded = true;
    mapperRaw = root.target_market;
  } else if (hasOwn(root, "targetMarketMapper") && isPlainRecord(root.targetMarketMapper)) {
    tracker.degraded = true;
    mapperRaw = root.targetMarketMapper;
  } else if (hasOwn(auditRaw, "target_market_mapper") && isPlainRecord(auditRaw.target_market_mapper)) {
    tracker.degraded = true;
    mapperRaw = auditRaw.target_market_mapper;
  } else if (hasOwn(root, "primary_segment") || hasOwn(root, "effective_channels")) {
    tracker.degraded = true;
    mapperRaw = root;
  } else {
    mapperRaw = asRecord(root.target_market_mapper, tracker);
  }

  let segmentRaw: Record<string, unknown>;
  if (hasOwn(mapperRaw, "primary_segment") && isPlainRecord(mapperRaw.primary_segment)) {
    segmentRaw = mapperRaw.primary_segment;
  } else if (
    hasOwn(mapperRaw, "persona_label") ||
    hasOwn(mapperRaw, "purchasing_power") ||
    hasOwn(mapperRaw, "buying_behavior") ||
    hasOwn(mapperRaw, "core_pain_points")
  ) {
    tracker.degraded = true;
    segmentRaw = mapperRaw;
  } else {
    segmentRaw = asRecord(mapperRaw.primary_segment, tracker);
  }

  // Requirement 7.4: keep at most 5 core_pain_points.
  const corePainPoints = guardStringArray(segmentRaw.core_pain_points, tracker, 5);

  const rawChannels: Array<{ channel: EffectiveChannel; originalIndex: number }> = [];
  if (!Array.isArray(mapperRaw.effective_channels)) {
    tracker.degraded = true;
  } else {
    mapperRaw.effective_channels.forEach((item, index) => {
      const row = asRecord(item, tracker);
      const coercedPriority = coerceFiniteNumber(row.priority);
      let priorityNum: number;
      if (!coercedPriority.ok) {
        tracker.degraded = true;
        priorityNum = index + 1;
      } else {
        priorityNum = Math.round(coercedPriority.value);
      }
      rawChannels.push({
        originalIndex: index,
        channel: {
          channel_name: guardNonEmptyString(row.channel_name, tracker),
          strategy: guardNonEmptyString(row.strategy, tracker),
          priority: priorityNum,
        },
      });
    });
  }

  // Requirement 7.3 & 7.4: sort ascending by model's priority (ties broken by original array index),
  // renumber priorities 1..N, and retain at most 5 elements.
  const effectiveChannels: EffectiveChannel[] = rawChannels
    .sort((a, b) =>
      a.channel.priority !== b.channel.priority
        ? a.channel.priority - b.channel.priority
        : a.originalIndex - b.originalIndex
    )
    .map((entry, idx) => ({
      channel_name: entry.channel.channel_name,
      strategy: entry.channel.strategy,
      priority: idx + 1,
    }))
    .slice(0, 5);

  const target_market_mapper: TargetMarketMapper = {
    primary_segment: {
      persona_label: guardNonEmptyString(segmentRaw.persona_label, tracker),
      purchasing_power: guardNonEmptyString(segmentRaw.purchasing_power, tracker),
      core_pain_points: corePainPoints,
      buying_behavior: guardNonEmptyString(segmentRaw.buying_behavior, tracker),
    },
    effective_channels: effectiveChannels,
  };

  return {
    data: {
      feasibility_audit,
      target_market_mapper,
    },
    is_degraded: tracker.degraded,
  };
}

/**
 * Guards and repairs Step2Result (Requirement 8, 9.5, 12.1–12.5).
 */
export function guardStep2Object(raw: unknown): GuardResult<Step2Result> {
  const tracker: GuardTracker = { degraded: false };
  const root = asRecord(raw, tracker);

  // 1. competitor_matrix
  const matrixRaw = asRecord(root.competitor_matrix, tracker);
  const recommendedUvp = guardNonEmptyString(matrixRaw.recommended_uvp, tracker);

  const comparisonTable: ComparisonRow[] = [];
  if (!Array.isArray(matrixRaw.comparison_table)) {
    tracker.degraded = true;
  } else {
    for (const item of matrixRaw.comparison_table) {
      const row = asRecord(item, tracker);
      comparisonTable.push({
        attribute: guardNonEmptyString(row.attribute, tracker),
        user_concept: guardNonEmptyString(row.user_concept, tracker),
        local_incumbents: guardNonEmptyString(row.local_incumbents, tracker),
        competitive_advantage: guardNonEmptyString(row.competitive_advantage, tracker),
      });
    }
  }

  // 2. gtm_readiness
  let gtmRaw: Record<string, unknown>;
  if (hasOwn(root, "gtm_readiness") && isPlainRecord(root.gtm_readiness)) {
    gtmRaw = root.gtm_readiness;
  } else if (hasOwn(root, "go_to_market_readiness") && isPlainRecord(root.go_to_market_readiness)) {
    tracker.degraded = true;
    gtmRaw = root.go_to_market_readiness;
  } else if (hasOwn(root, "gtm") && isPlainRecord(root.gtm)) {
    tracker.degraded = true;
    gtmRaw = root.gtm;
  } else if (hasOwn(root, "gtmReadiness") && isPlainRecord(root.gtmReadiness)) {
    tracker.degraded = true;
    gtmRaw = root.gtmReadiness;
  } else if (hasOwn(matrixRaw, "gtm_readiness") && isPlainRecord(matrixRaw.gtm_readiness)) {
    tracker.degraded = true;
    gtmRaw = matrixRaw.gtm_readiness;
  } else if (
    hasOwn(root, "readiness_verdict") ||
    hasOwn(root, "priority_action_plan") ||
    hasOwn(root, "overall_score")
  ) {
    tracker.degraded = true;
    gtmRaw = root;
  } else {
    gtmRaw = asRecord(root.gtm_readiness, tracker);
  }
  const overallScore = guardScore0To100(gtmRaw.overall_score, tracker, true, DEFAULT_NUMBER).value;
  const readinessVerdict = guardNonEmptyString(gtmRaw.readiness_verdict, tracker);
  const mandatoryRevisions = guardStringArray(gtmRaw.mandatory_revisions, tracker);

  const actionPlan: ActionStep[] = [];
  if (!Array.isArray(gtmRaw.priority_action_plan)) {
    tracker.degraded = true;
  } else {
    gtmRaw.priority_action_plan.forEach((item, index) => {
      const row = asRecord(item, tracker);
      const coercedStep = coerceFiniteNumber(row.step_number);
      if (!coercedStep.ok) {
        tracker.degraded = true;
      }
      // Requirement 9.5: renumber step_number to 1..N while preserving relative order from the model.
      actionPlan.push({
        step_number: index + 1,
        phase: guardNonEmptyString(row.phase, tracker),
        action: guardNonEmptyString(row.action, tracker),
      });
    });
  }

  return {
    data: {
      competitor_matrix: {
        recommended_uvp: recommendedUvp,
        comparison_table: comparisonTable,
      },
      gtm_readiness: {
        overall_score: overallScore,
        readiness_verdict: readinessVerdict,
        mandatory_revisions: mandatoryRevisions,
        priority_action_plan: actionPlan,
      },
    },
    is_degraded: tracker.degraded,
  };
}

/**
 * Requirement 19.8: Normalizes positive, neutral, and negative sentiment values so they are
 * integers in 0–100 that sum to 100 while preserving their relative magnitude order.
 * If all three are 0, returns DEFAULT_SENTIMENT and marks degraded.
 */
export function normalizeSentimentDistribution(
  raw: unknown,
  tracker: GuardTracker
): SentimentDistribution {
  const obj = asRecord(raw, tracker);
  const pos = guardScore0To100(obj.positive, tracker, true, 0).value;
  const neu = guardScore0To100(obj.neutral, tracker, true, 0).value;
  const neg = guardScore0To100(obj.negative, tracker, true, 0).value;

  const sum = pos + neu + neg;
  if (sum === 100) {
    return { positive: pos, neutral: neu, negative: neg };
  }
  if (sum === 0) {
    tracker.degraded = true;
    return { ...DEFAULT_SENTIMENT };
  }

  const entries = [
    { key: "positive" as const, raw: pos, exact: (pos * 100) / sum },
    { key: "neutral" as const, raw: neu, exact: (neu * 100) / sum },
    { key: "negative" as const, raw: neg, exact: (neg * 100) / sum },
  ].map((e, index) => ({
    ...e,
    index,
    floored: Math.floor(e.exact),
    remainder: e.exact - Math.floor(e.exact),
  }));

  const remainderUnits = 100 - entries.reduce((acc, e) => acc + e.floored, 0);
  // Distribute remaining units to items with the largest fractional remainder (tie-breaking by larger raw value)
  // so relative order is strictly preserved.
  const byRemainder = [...entries].sort((a, b) =>
    b.remainder !== a.remainder
      ? b.remainder - a.remainder
      : b.raw !== a.raw
        ? b.raw - a.raw
        : a.index - b.index
  );

  for (let i = 0; i < remainderUnits; i += 1) {
    byRemainder[i % byRemainder.length].floored += 1;
  }

  const out: SentimentDistribution = { positive: 0, neutral: 0, negative: 0 };
  for (const e of entries) {
    out[e.key] = e.floored;
  }
  return out;
}

/**
 * Guards and repairs Module2Result (Requirement 12.1–12.5, 19.5–19.8, 21.6, 21.9).
 */
export function guardModule2Object(raw: unknown): GuardResult<Module2Result> {
  const tracker: GuardTracker = { degraded: false };
  const root = asRecord(raw, tracker);

  // 1. market_overview
  const overviewRaw = asRecord(root.market_overview, tracker);
  const coercedTotal = coerceFiniteNumber(overviewRaw.total_reviews_analyzed);
  let totalReviews = DEFAULT_NUMBER;
  if (!coercedTotal.ok || coercedTotal.value < 0) {
    tracker.degraded = true;
  } else {
    totalReviews = Math.min(240, Math.max(0, Math.round(coercedTotal.value)));
  }

  const market_overview: Module2Result["market_overview"] = {
    total_reviews_analyzed: totalReviews,
    dominant_market_complaint: guardNonEmptyString(overviewRaw.dominant_market_complaint, tracker),
    unmet_customer_need: guardNonEmptyString(overviewRaw.unmet_customer_need, tracker),
  };

  // 2. competitors_breakdown
  const competitorsBreakdown: CompetitorBreakdown[] = [];
  if (!Array.isArray(root.competitors_breakdown)) {
    tracker.degraded = true;
  } else {
    for (const item of root.competitors_breakdown.slice(0, 3)) {
      const row = asRecord(item, tracker);
      const coercedRating = coerceFiniteNumber(row.avg_rating);
      let avgRating = DEFAULT_NUMBER;
      if (!coercedRating.ok) {
        tracker.degraded = true;
      } else {
        avgRating = Math.round(clampRating(coercedRating.value) * 10) / 10;
      }

      const aspectRaw = asRecord(row.aspect_scores, tracker);
      const aspect_scores: AspectScores = {
        product_quality: guardScore0To100(aspectRaw.product_quality, tracker, true, DEFAULT_NUMBER).value,
        pricing_value: guardScore0To100(aspectRaw.pricing_value, tracker, true, DEFAULT_NUMBER).value,
        service_speed: guardScore0To100(aspectRaw.service_speed, tracker, true, DEFAULT_NUMBER).value,
        ambience_facility: guardScore0To100(aspectRaw.ambience_facility, tracker, true, DEFAULT_NUMBER).value,
      };

      competitorsBreakdown.push({
        competitor_name: guardNonEmptyString(row.competitor_name, tracker),
        avg_rating: avgRating,
        sentiment_distribution: normalizeSentimentDistribution(row.sentiment_distribution, tracker),
        core_strengths: guardStringArray(row.core_strengths, tracker),
        exploitable_weaknesses: guardStringArray(row.exploitable_weaknesses, tracker),
        aspect_scores,
      });
    }
  }

  // 3. steal_the_market_playbook
  const playbook: PlaybookItem[] = [];
  if (!Array.isArray(root.steal_the_market_playbook)) {
    tracker.degraded = true;
  } else {
    for (const item of root.steal_the_market_playbook) {
      const row = asRecord(item, tracker);
      playbook.push({
        target_weakness: guardNonEmptyString(row.target_weakness, tracker),
        actionable_strategy: guardNonEmptyString(row.actionable_strategy, tracker),
        marketing_hook: guardNonEmptyString(row.marketing_hook, tracker),
      });
    }
  }

  return {
    data: {
      market_overview,
      competitors_breakdown: competitorsBreakdown,
      steal_the_market_playbook: playbook,
    },
    is_degraded: tracker.degraded,
  };
}

// ============================================================================
// End-to-End LLM Text Guard with Single JSON-Parse Retry (Requirement 12.1, 12.2, 12.11)
// ============================================================================

export const MIN_RETRY_BUDGET_MS = 2_000;

export interface GuardGroqOptions {
  /** Initial raw response text from Groq_Client. */
  rawText: string;
  /** Model that produced the initial response. */
  modelUsed: GroqModelId;
  /** Optional retry callback invoked at most once if JSON.parse fails and time budget allows (Req 12.2). */
  retryCall?: () => Promise<{ rawText: string; modelUsed: GroqModelId }>;
  /** Remaining server request time budget in ms (defaults to MIN_RETRY_BUDGET_MS). */
  remainingTimeMs?: number;
  /** Minimum remaining time required to attempt a retry (defaults to 2000ms). */
  minRetryBudgetMs?: number;
}

export interface GuardGroqOutput<T> extends GuardResult<T> {
  modelUsed: GroqModelId;
  retried: boolean;
}

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    // Strip markdown code fences if the LLM wrapped the JSON block
    const trimmed = text.trim();
    const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
    if (fenceMatch) {
      try {
        return { ok: true, value: JSON.parse(fenceMatch[1]) };
      } catch {
        // continue
      }
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return { ok: true, value: JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) };
      } catch {
        // continue
      }
    }
    return { ok: false };
  }
}

async function parseWithSingleRetry(
  options: GuardGroqOptions
): Promise<{ parsed: unknown; modelUsed: GroqModelId; retried: boolean }> {
  const firstAttempt = tryParseJson(options.rawText);
  if (firstAttempt.ok) {
    return { parsed: firstAttempt.value, modelUsed: options.modelUsed, retried: false };
  }

  const remainingMs = options.remainingTimeMs ?? MIN_RETRY_BUDGET_MS;
  const minBudgetMs = options.minRetryBudgetMs ?? MIN_RETRY_BUDGET_MS;

  // Requirement 12.2: retry at most once if JSON parse fails and remaining server time budget allows.
  if (options.retryCall && remainingMs >= minBudgetMs) {
    try {
      const secondResponse = await options.retryCall();
      const secondAttempt = tryParseJson(secondResponse.rawText);
      if (secondAttempt.ok) {
        return {
          parsed: secondAttempt.value,
          modelUsed: secondResponse.modelUsed,
          retried: true,
        };
      }
      return { parsed: null, modelUsed: secondResponse.modelUsed, retried: true };
    } catch {
      // Requirement 12.11: if retry fails or cannot be parsed, fall back to Nilai_Default with is_degraded = true.
      return { parsed: null, modelUsed: options.modelUsed, retried: true };
    }
  }

  return { parsed: null, modelUsed: options.modelUsed, retried: false };
}

function isStep1TargetMarketEmpty(data: Step1Result): boolean {
  const tm = data.target_market_mapper;
  return (
    tm.primary_segment.persona_label === DEFAULT_TEXT &&
    tm.primary_segment.purchasing_power === DEFAULT_TEXT &&
    tm.effective_channels.length === 0
  );
}

function isStep2GtmEmpty(data: Step2Result): boolean {
  const gtm = data.gtm_readiness;
  return (
    gtm.readiness_verdict === DEFAULT_TEXT &&
    gtm.overall_score === DEFAULT_NUMBER &&
    gtm.priority_action_plan.length === 0
  );
}

export async function guardStep1Response(
  options: GuardGroqOptions
): Promise<GuardGroqOutput<Step1Result>> {
  const { parsed, modelUsed, retried } = await parseWithSingleRetry(options);
  const guarded = guardStep1Object(parsed);

  const remainingMs = options.remainingTimeMs ?? MIN_RETRY_BUDGET_MS;
  const minBudgetMs = options.minRetryBudgetMs ?? MIN_RETRY_BUDGET_MS;

  if (!retried && isStep1TargetMarketEmpty(guarded.data) && options.retryCall && remainingMs >= minBudgetMs) {
    try {
      const secondResponse = await options.retryCall();
      const secondAttempt = tryParseJson(secondResponse.rawText);
      if (secondAttempt.ok) {
        const secondGuarded = guardStep1Object(secondAttempt.value);
        if (!isStep1TargetMarketEmpty(secondGuarded.data)) {
          const useFirstAudit =
            secondGuarded.data.feasibility_audit.recommended_selling_price_idr === DEFAULT_NUMBER &&
            guarded.data.feasibility_audit.recommended_selling_price_idr > 0;
          const mergedData: Step1Result = {
            feasibility_audit: useFirstAudit
              ? guarded.data.feasibility_audit
              : secondGuarded.data.feasibility_audit,
            target_market_mapper: secondGuarded.data.target_market_mapper,
          };
          const revalidated = guardStep1Object(mergedData);
          return {
            ...revalidated,
            modelUsed: secondResponse.modelUsed,
            retried: true,
          };
        }
      }
    } catch {
      // Keep first guarded result if retry fails
    }
  }

  return { ...guarded, modelUsed, retried };
}

export async function guardStep2Response(
  options: GuardGroqOptions
): Promise<GuardGroqOutput<Step2Result>> {
  const { parsed, modelUsed, retried } = await parseWithSingleRetry(options);
  const guarded = guardStep2Object(parsed);

  const remainingMs = options.remainingTimeMs ?? MIN_RETRY_BUDGET_MS;
  const minBudgetMs = options.minRetryBudgetMs ?? MIN_RETRY_BUDGET_MS;

  if (!retried && isStep2GtmEmpty(guarded.data) && options.retryCall && remainingMs >= minBudgetMs) {
    try {
      const secondResponse = await options.retryCall();
      const secondAttempt = tryParseJson(secondResponse.rawText);
      if (secondAttempt.ok) {
        const secondGuarded = guardStep2Object(secondAttempt.value);
        if (!isStep2GtmEmpty(secondGuarded.data)) {
          const useFirstMatrix =
            secondGuarded.data.competitor_matrix.recommended_uvp === DEFAULT_TEXT &&
            guarded.data.competitor_matrix.recommended_uvp !== DEFAULT_TEXT;
          const mergedData: Step2Result = {
            competitor_matrix: useFirstMatrix
              ? guarded.data.competitor_matrix
              : secondGuarded.data.competitor_matrix,
            gtm_readiness: secondGuarded.data.gtm_readiness,
          };
          const revalidated = guardStep2Object(mergedData);
          return {
            ...revalidated,
            modelUsed: secondResponse.modelUsed,
            retried: true,
          };
        }
      }
    } catch {
      // Keep first guarded result if retry fails
    }
  }

  return { ...guarded, modelUsed, retried };
}

export async function guardModule2Response(
  options: GuardGroqOptions
): Promise<GuardGroqOutput<Module2Result>> {
  const { parsed, modelUsed, retried } = await parseWithSingleRetry(options);
  const guarded = guardModule2Object(parsed);
  return { ...guarded, modelUsed, retried };
}

// ============================================================================
// Database Read Re-Validation Guards (Requirement 12.7, 12.12, 21.6, 21.9)
// ============================================================================

export function guardStoredStep1(storedJson: unknown, storedDegraded = false): GuardResult<Step1Result> {
  const parsed = step1ResultSchema.safeParse(storedJson);
  const repaired = guardStep1Object(storedJson);
  return {
    data: repaired.data,
    is_degraded: storedDegraded || !parsed.success || repaired.is_degraded,
  };
}

export function guardStoredStep2(storedJson: unknown, storedDegraded = false): GuardResult<Step2Result> {
  const parsed = step2ResultSchema.safeParse(storedJson);
  const repaired = guardStep2Object(storedJson);
  return {
    data: repaired.data,
    is_degraded: storedDegraded || !parsed.success || repaired.is_degraded,
  };
}

export function guardStoredModule2(
  storedJson: unknown,
  storedDegraded = false
): GuardResult<Module2Result> {
  const parsed = module2ResultSchema.safeParse(storedJson);
  const repaired = guardModule2Object(storedJson);
  return {
    data: repaired.data,
    is_degraded: storedDegraded || !parsed.success || repaired.is_degraded,
  };
}
