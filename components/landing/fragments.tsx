import { CircleCheck, Circle, Loader2 } from "lucide-react";
import { AspectRadar, type RadarSeries } from "@/components/charts/aspect-radar";
import { Gauge } from "@/components/charts/gauge";
import { RiskBadge, ViabilityBadge } from "@/components/dashboard/module1/badges";
import { Badge } from "@/components/ui/badge";
import { formatInteger, formatPercent0, formatPercent1, formatRupiah } from "@/lib/format";
import { KATEGORI_LABEL, STEP_STATUS_LABEL, TREND_LABEL, labelFor } from "@/lib/labels";
import { mockIdeaInput, mockStep1, mockStep2 } from "@/lib/mock/module1";
import { mockResultFull, mockUrls } from "@/lib/mock/module2";

// Cropped pieces of the real interface, built from the real components and the real mock data in
// lib/mock. Each root carries data-ui, so the product's own borders, radii and 13-15px interface
// text are correct inside it and the house rules hold on the page around it. Nothing here is a
// customer's data: it is the product's own worked example, the sambal idea and the three coffee
// shops that ship with the app.

const audit = mockStep1.feasibility_audit;
const segment = mockStep1.target_market_mapper.primary_segment;
const gtm = mockStep2.gtm_readiness;

export type RunStage = "isi" | "audit" | "hasil";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="ui-label">{label}</p>
      <p className="ui-edge mt-1.5 rounded-[var(--radius-control)] bg-raised px-2.5 py-2 text-[14px]">
        {value}
      </p>
    </div>
  );
}

/**
 * The pinned fragment: one Modul 1 run in its three real states. The states are HTML with a
 * different branch, not three pictures.
 */
export function RunFragment({ stage }: { stage: RunStage }) {
  return (
    <div data-ui className="ui-edge w-full p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ui-title">LokalTrend Radar</p>
          <p className="ui-label mt-0.5">Analisis lt-7f3a21</p>
        </div>
        <Badge variant={stage === "hasil" ? "positive" : "neutral"}>
          {stage === "isi" ? "Formulir" : stage === "audit" ? "Sedang diproses" : "Berhasil"}
        </Badge>
      </div>

      {/* The stages share one height so the panel does not jump, and each one lays its content
          across the full width of the fragment, the way the real screen does at this size. */}
      <div className="ui-split mt-4 min-h-[176px] pt-4">
        {stage === "isi" ? (
          <div className="grid grid-cols-1 gap-3.5">
            <div>
              <p className="ui-label">Ide produk</p>
              <p className="ui-edge mt-1.5 rounded-[var(--radius-control)] bg-raised px-2.5 py-2 text-[14px]">
                {mockIdeaInput.product_idea}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <ReadOnlyField
                label="Kategori ekraf"
                value={labelFor(KATEGORI_LABEL, mockIdeaInput.category)}
              />
              <ReadOnlyField label="Kota target" value={mockIdeaInput.target_city} />
              <ReadOnlyField
                label="Modal awal"
                value={formatRupiah(mockIdeaInput.initial_capital_idr)}
              />
            </div>
          </div>
        ) : null}

        {stage === "audit" ? (
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-8">
            <li className="flex items-start gap-2.5">
              <Loader2
                className="mt-0.5 size-4 flex-none animate-spin text-brand motion-reduce:animate-none"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              <div>
                <p className="text-[14px] font-semibold">
                  Langkah 1 · {labelFor(STEP_STATUS_LABEL, "RUNNING")}
                </p>
                <p className="ui-label">
                  Audit kelayakan finansial dan pemetaan segmen pasar untuk{" "}
                  {mockIdeaInput.target_city}.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <Circle className="mt-0.5 size-4 flex-none text-ink-muted" strokeWidth={2.25} aria-hidden="true" />
              <div>
                <p className="text-[14px]">Langkah 2 · {labelFor(STEP_STATUS_LABEL, "IDLE")}</p>
                <p className="ui-label">Matriks kompetitor, UVP, dan skor kesiapan GTM.</p>
              </div>
            </li>
            <li className="md:col-start-2 md:row-span-2 md:row-start-1">
              <p className="ui-label">Asumsi yang dipakai</p>
              <ul className="mt-1.5 grid grid-cols-1 gap-1 text-[13px] leading-[18px]">
                <li>Ongkir dan ekspedisi lokal ke {mockIdeaInput.target_city}</li>
                <li>Daya beli dan harga pasar kota target</li>
                <li>Komisi marketplace dan ojek online</li>
                <li>Perizinan NIB dan PIRT</li>
              </ul>
            </li>
          </ol>
        ) : null}

        {stage === "hasil" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="ui-label">Margin kotor</p>
                  <p className="ui-figure mt-0.5">
                    {formatPercent1(audit.gross_margin_percentage)}
                  </p>
                </div>
                <ViabilityBadge status={audit.financial_viability_status} />
              </div>
              <div className="ui-split grid grid-cols-2 gap-3 pt-4">
                <div>
                  <p className="ui-label">Skor kejenuhan tren</p>
                  <p className="mt-0.5 text-[14px] font-semibold">
                    {formatInteger(audit.trend_sustainability.saturation_score)} ·{" "}
                    {labelFor(TREND_LABEL, audit.trend_sustainability.category)}
                  </p>
                </div>
                <div>
                  <p className="ui-label">Kesiapan GTM</p>
                  <p className="mt-0.5 text-[14px] font-semibold">
                    {formatInteger(gtm.overall_score)} dari 100
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <p className="ui-label">Segmen pasar utama</p>
                <p className="mt-0.5 text-[14px]">{segment.persona_label}</p>
                <p className="ui-label mt-0.5">{segment.purchasing_power}</p>
              </div>
              <div className="ui-split pt-4">
                <p className="ui-label">Langkah pertama yang disarankan</p>
                <p className="mt-0.5 text-[14px]">{gtm.priority_action_plan[0].action}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** A features cell fragment: the margin gauge with its verdict and the risk rows beneath it. */
export function MarginFragment() {
  return (
    <div data-ui className="ui-edge min-w-0 w-full p-5">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
        <p className="ui-title">Audit Kelayakan Finansial</p>
        <ViabilityBadge status={audit.financial_viability_status} />
      </div>
      <div className="mt-3 flex justify-center">
        <Gauge
          value={audit.gross_margin_percentage}
          label={formatPercent1(audit.gross_margin_percentage)}
          name="Margin kotor"
          size={176}
        />
      </div>
      <div className="ui-split mt-3 grid grid-cols-2 gap-3 pt-3">
        <div>
          <p className="ui-label">Modal per unit</p>
          <p className="mt-0.5 text-[14px] font-semibold">
            {formatRupiah(audit.estimated_cogs_idr)}
          </p>
        </div>
        <div>
          <p className="ui-label">Harga jual</p>
          <p className="mt-0.5 text-[14px] font-semibold">
            {formatRupiah(audit.recommended_selling_price_idr)}
          </p>
        </div>
      </div>
      <div className="ui-split mt-3 pt-3">
        <p className="ui-label">Risiko operasional</p>
        <ul className="mt-2 grid grid-cols-1 gap-2">
          {audit.operational_risks.map((risk) => (
            <li key={risk.aspect} className="flex items-center justify-between gap-2">
              <span className="text-[14px]">{risk.aspect}</span>
              <RiskBadge level={risk.risk_level} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A features cell fragment: the GTM readiness score with the UVP and the segment it is scored for. */
export function GtmFragment() {
  return (
    <div data-ui className="ui-edge min-w-0 w-full p-5">
      <p className="ui-title">Kesiapan Go-to-Market</p>
      <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ui-label">Skor keseluruhan</p>
          <p className="ui-figure mt-0.5">{formatInteger(gtm.overall_score)}</p>
        </div>
        <Badge variant="warning">{gtm.readiness_verdict}</Badge>
      </div>
      <div className="ui-split mt-3 pt-3">
        <p className="ui-label">Segmen pasar utama</p>
        <p className="mt-1 text-[14px] font-semibold">{segment.persona_label}</p>
        <p className="ui-label mt-1">{segment.purchasing_power}</p>
      </div>
      <div className="ui-split mt-3 pt-3">
        <p className="ui-label">UVP yang disarankan</p>
        <p className="mt-1 text-[14px]">{mockStep2.competitor_matrix.recommended_uvp}</p>
      </div>
    </div>
  );
}

const RADAR_SERIES: RadarSeries[] = mockResultFull.competitors_breakdown.map((competitor, index) => ({
  name: competitor.competitor_name,
  color: `var(--chart-${index + 1})`,
  dash: index === 1 ? "6 4" : index === 2 ? "2 3" : undefined,
  scores: competitor.aspect_scores,
}));

/** A features cell fragment: the four-dimension radar over the three competitors of the example. */
export function RadarFragment() {
  return (
    <div data-ui className="ui-edge min-w-0 w-full p-5">
      <p className="ui-title">Empat dimensi skor</p>
      <p className="ui-label mt-0.5">
        {mockUrls.length} kompetitor ·{" "}
        {formatInteger(mockResultFull.market_overview.total_reviews_analyzed)} ulasan tersampel
      </p>
      <AspectRadar series={RADAR_SERIES} height={252} />
      <ul className="ui-split grid grid-cols-1 gap-1.5 pt-3">
        {mockResultFull.competitors_breakdown.map((competitor, index) => (
          <li key={competitor.competitor_name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-[14px]">
              <svg width="16" height="8" viewBox="0 0 16 8" className="flex-none" aria-hidden="true">
                <line
                  x1="0"
                  y1="4"
                  x2="16"
                  y2="4"
                  stroke={`var(--chart-${index + 1})`}
                  strokeWidth="2"
                  strokeDasharray={RADAR_SERIES[index].dash}
                />
              </svg>
              <span className="truncate">{competitor.competitor_name}</span>
            </span>
            <span className="ui-label flex-none">
              {formatPercent0(competitor.sentiment_distribution.positive)} positif
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A features cell fragment: one playbook row with its marketing hook, as the app sets it. */
export function HookFragment() {
  const item = mockResultFull.steal_the_market_playbook[0];
  return (
    <div data-ui className="ui-edge min-w-0 w-full p-5">
      <p className="ui-title">Playbook rebut pasar</p>
      <div className="mt-3">
        <p className="ui-label">Kelemahan yang disasar</p>
        <p className="mt-1 text-[14px] font-semibold">{item.target_weakness}</p>
      </div>
      <div className="ui-split mt-3 pt-3">
        <p className="ui-label">Strategi operasional</p>
        <p className="mt-1 text-[14px]">{item.actionable_strategy}</p>
      </div>
      <div className="mt-3 rounded-[var(--radius-control)] bg-raised p-3">
        <p className="ui-label">Hook pemasaran</p>
        <p className="mt-1 text-[15px] leading-6 font-semibold">{item.marketing_hook}</p>
        <p className="ui-label mt-2 flex items-center gap-1.5">
          <CircleCheck className="size-3.5 flex-none text-positive" aria-hidden="true" />
          Siap disalin ke caption
        </p>
      </div>
    </div>
  );
}
