// Types for the AI result JSON (requirements.md, Appendix A) and the records that hold it.

export const KATEGORI_EKRAF = ["KULINER", "FASHION", "KRIYA", "BEAUTY"] as const;
export type KategoriEkraf = (typeof KATEGORI_EKRAF)[number];

export type ViabilityStatus = "VIABLE" | "VIABLE_WITH_NOTES" | "NOT_VIABLE";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type TrendCategory =
  | "EVERGREEN_NICHE"
  | "EVERGREEN_MASS"
  | "RISING_TREND"
  | "FAD_PEAKING"
  | "DECLINING";

// ---------- Modul 1, Langkah 1 ----------
export interface OperationalRisk {
  aspect: string;
  risk_level: RiskLevel;
  mitigation: string;
}

export interface FeasibilityAudit {
  estimated_cogs_idr: number;
  recommended_selling_price_idr: number;
  gross_margin_percentage: number;
  financial_viability_status: ViabilityStatus;
  operational_risks: OperationalRisk[];
  trend_sustainability: {
    // A string, not TrendCategory: the model may send a category the design has no label for.
    category: string;
    saturation_score: number;
    analysis: string;
  };
}

export interface EffectiveChannel {
  channel_name: string;
  strategy: string;
  priority: number;
}

export interface TargetMarketMapper {
  primary_segment: {
    persona_label: string;
    purchasing_power: string;
    core_pain_points: string[];
    buying_behavior: string;
  };
  effective_channels: EffectiveChannel[];
}

export interface Step1Result {
  feasibility_audit: FeasibilityAudit;
  target_market_mapper: TargetMarketMapper;
}

// ---------- Modul 1, Langkah 2 ----------
export interface ComparisonRow {
  attribute: string;
  user_concept: string;
  local_incumbents: string;
  competitive_advantage: string;
}

export interface ActionStep {
  step_number: number;
  phase: string;
  action: string;
}

export interface Step2Result {
  competitor_matrix: {
    recommended_uvp: string;
    comparison_table: ComparisonRow[];
  };
  gtm_readiness: {
    overall_score: number;
    readiness_verdict: string;
    mandatory_revisions: string[];
    priority_action_plan: ActionStep[];
  };
}

// ---------- Modul 1 record ----------
export type StepStatus = "IDLE" | "RUNNING" | "SUCCESS" | "FAILED";

export interface IdeaInput {
  product_idea: string;
  category: KategoriEkraf;
  initial_capital_idr: number;
  target_city: string;
}

export type GroqModelId = "openai/gpt-oss-120b" | "openai/gpt-oss-20b";

export interface Module1Analysis {
  id: string;
  user_id?: string;
  created_at: string; // ISO 8601
  input: IdeaInput;
  step1_status: StepStatus;
  step2_status: StepStatus;
  step1_result: Step1Result | null;
  step2_result: Step2Result | null;
  step1_model?: GroqModelId | null;
  step2_model?: GroqModelId | null;
  is_degraded: boolean;
}

// ---------- Modul 2, Fase Reduce ----------
export interface AspectScores {
  product_quality: number;
  pricing_value: number;
  service_speed: number;
  ambience_facility: number;
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

export interface CompetitorBreakdown {
  competitor_name: string;
  avg_rating: number;
  sentiment_distribution: SentimentDistribution;
  core_strengths: string[];
  exploitable_weaknesses: string[];
  aspect_scores: AspectScores;
}

export interface PlaybookItem {
  target_weakness: string;
  actionable_strategy: string;
  marketing_hook: string;
}

export interface Module2Result {
  market_overview: {
    total_reviews_analyzed: number;
    dominant_market_complaint: string;
    unmet_customer_need: string;
  };
  competitors_breakdown: CompetitorBreakdown[];
  steal_the_market_playbook: PlaybookItem[];
}

// ---------- Modul 2 record ----------
export type JobStatus = "PENDING" | "SCRAPING" | "ANALYZING" | "COMPLETED" | "FAILED";

export interface FailedCompetitor {
  maps_url: string;
  reason: string;
}

export interface RadarJob {
  id: string;
  user_id?: string;
  created_at: string; // ISO 8601
  maps_urls: string[];
  status: JobStatus;
  result: Module2Result | null;
  failed_competitors: FailedCompetitor[];
  error_message: string | null;
  map_models?: GroqModelId[] | null;
  reduce_model?: GroqModelId | null;
  is_degraded: boolean;
}
