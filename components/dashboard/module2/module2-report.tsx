"use client";

import { AlertTriangle } from "lucide-react";
import { ASPECT_AXES, AspectRadar, SeriesSwatch } from "@/components/charts/aspect-radar";
import { DegradedNotice, EmptyState, SectionHeading } from "@/components/dashboard/common";
import { Playbook } from "@/components/dashboard/module2/playbook";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInteger, formatRating } from "@/lib/format";
import { clampRating, clampScore } from "@/lib/numbers";
import type { CompetitorBreakdown, FailedCompetitor, Module2Result } from "@/lib/types";

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
// The three series hues sit close in value on the radar, so each series also has its own line.
const SERIES_DASH = ["", "6 3", "2 3"];

function Swatch({ index }: { index: number }) {
  return <SeriesSwatch color={SERIES_COLORS[index]} dash={SERIES_DASH[index]} />;
}

/** The aspect where competitors score lowest on average: the market's widest gap. */
export function widestGap(rows: CompetitorBreakdown[]) {
  if (rows.length === 0) return null;
  const averages = ASPECT_AXES.map((axis) => ({
    ...axis,
    average: Math.round(rows.reduce((sum, r) => sum + clampScore(r.aspect_scores?.[axis.key]), 0) / rows.length),
  }));
  return averages.reduce((low, a) => (a.average < low.average ? a : low));
}

function MarketOverview({ data, competitors }: { data: Module2Result["market_overview"]; competitors: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gambaran pasar</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)] md:divide-x md:divide-border">
          <div>
            <dt className="text-[13px] text-ink-muted">Ulasan dianalisis</dt>
            <dd className="num mt-1 text-[24px] leading-8 text-ink">{formatInteger(data.total_reviews_analyzed)}</dd>
            <dd className="text-[13px] text-ink-muted">dari {formatInteger(competitors)} kompetitor</dd>
          </div>
          <div className="md:px-6">
            <dt className="text-[13px] text-ink-muted">Keluhan pasar yang dominan</dt>
            <dd className="mt-1 text-[15px] leading-6 text-ink">{data.dominant_market_complaint}</dd>
          </div>
          <div className="md:pl-6">
            <dt className="text-[13px] text-ink-muted">Kebutuhan pelanggan yang belum terpenuhi</dt>
            <dd className="mt-1 text-[15px] leading-6 text-ink">{data.unmet_customer_need}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function FailedCompetitors({ items }: { items: FailedCompetitor[] }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="h-gagal"
      className="rounded-xl border border-pill-warning-border bg-pill-warning-bg px-5 py-4"
    >
      <h2 id="h-gagal" className="flex items-center gap-2 text-sm font-semibold text-pill-warning-ink">
        <AlertTriangle className="size-4" strokeWidth={1.75} aria-hidden="true" />
        {formatInteger(items.length)} kompetitor tidak ikut dianalisis
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.maps_url} className="text-[13px] text-pill-warning-ink">
            <span className="break-all">{item.maps_url}</span> · {item.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Legend({ rows }: { rows: CompetitorBreakdown[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legenda">
      {rows.map((row, i) => (
        <li key={row.competitor_name + i} className="flex items-center gap-1.5 text-[13px] text-ink-muted">
          <Swatch index={i} />
          {row.competitor_name}
        </li>
      ))}
    </ul>
  );
}

function GapMatrix({ rows }: { rows: CompetitorBreakdown[] }) {
  const gap = widestGap(rows);
  return (
    <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
      <Card className="lg:col-span-6">
        <CardHeader>
          <CardTitle>Peta skor aspek</CardTitle>
          <Legend rows={rows} />
        </CardHeader>
        <CardContent>
          <AspectRadar
            series={rows.map((row, i) => ({
              name: row.competitor_name,
              color: SERIES_COLORS[i],
              dash: SERIES_DASH[i],
              scores: row.aspect_scores,
            }))}
          />
        </CardContent>
      </Card>

      {/* The text alternative for the radar, and the legend as a table (Req 3.5). */}
      <Card className="lg:col-span-6">
        <CardHeader>
          <CardTitle>Skor aspek per kompetitor</CardTitle>
          {gap ? (
            <p className="text-sm text-ink">
              Celah terlebar: <span className="font-semibold">{gap.label}</span>, rata-rata{" "}
              <span className="num font-semibold">{gap.average}</span>
              <span className="text-ink-muted"> /100 di semua kompetitor.</span>
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] border-collapse text-sm">
              <caption className="sr-only">Skor aspek 0–100 per kompetitor, sama dengan nilai pada grafik radar</caption>
              <thead>
                <tr className="border-b border-rule-strong">
                  <th scope="col" className="h-9 pr-3 text-left text-xs font-normal text-ink-muted">Kompetitor</th>
                  {ASPECT_AXES.map((axis) => (
                    <th
                      key={axis.key}
                      scope="col"
                      className={`h-9 px-2 text-right text-xs font-normal last:pr-0 ${gap?.key === axis.key ? "text-ink" : "text-ink-muted"}`}
                    >
                      {axis.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.competitor_name + i} className="border-b border-rule last:border-0">
                    <th scope="row" className="py-3 pr-3 text-left font-medium text-ink">
                      <span className="flex items-center gap-2">
                        <Swatch index={i} />
                        {row.competitor_name}
                      </span>
                    </th>
                    {ASPECT_AXES.map((axis) => (
                      <td
                        key={axis.key}
                        className={`num px-2 py-3 text-right last:pr-0 ${gap?.key === axis.key ? "font-semibold text-ink" : "text-ink"}`}
                      >
                        {Math.round(clampScore(row.aspect_scores?.[axis.key]))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {rows.length > 1 ? (
                <tfoot>
                  <tr className="border-t border-rule-strong">
                    <th scope="row" className="py-3 pr-3 text-left font-normal text-ink-muted">
                      Rata-rata {rows.length} kompetitor
                    </th>
                    {ASPECT_AXES.map((axis) => (
                      <td key={axis.key} className="num px-2 py-3 text-right text-ink-muted last:pr-0">
                        {Math.round(
                          rows.reduce((sum, r) => sum + clampScore(r.aspect_scores?.[axis.key]), 0) / rows.length
                        )}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
          <p className="mt-4 text-[13px] text-ink-muted">
            Skor 0–100 dari ulasan yang dianalisis; makin rendah, makin besar peluang Anda unggul di aspek itu.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SentimentCell({ value }: { value: CompetitorBreakdown["sentiment_distribution"] }) {
  const positive = Math.round(clampScore(value?.positive));
  const neutral = Math.round(clampScore(value?.neutral));
  const negative = Math.round(clampScore(value?.negative));
  return (
    <div className="min-w-[150px]">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-sm" aria-hidden="true">
        <span className="bg-ink-soft" style={{ width: `${positive}%` }} />
        <span className="bg-control" style={{ width: `${neutral}%` }} />
        <span className="bg-negative" style={{ width: `${negative}%` }} />
      </div>
      <dl className="num mt-1.5 grid grid-cols-3 gap-1 text-[13px]">
        <div>
          <dt className="text-ink-muted">Positif</dt>
          <dd className="text-ink">{positive}%</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Netral</dt>
          <dd className="text-ink">{neutral}%</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Negatif</dt>
          <dd className="text-ink">{negative}%</dd>
        </div>
      </dl>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-ink-muted">Data tidak tersedia</span>;
  return (
    <ul className="flex list-disc flex-col gap-1 pl-4 marker:text-ink-muted">
      {items.map((item, i) => (
        <li key={`${item}-${i}`}>{item}</li>
      ))}
    </ul>
  );
}

function BreakdownTable({ rows }: { rows: CompetitorBreakdown[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rincian kompetitor</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Phone: one block per competitor, so no row is a tall blank band behind a scroll. */}
        <ul className="flex flex-col md:hidden">
          {rows.map((row, i) => (
            <li
              key={row.competitor_name + i}
              className="flex flex-col gap-3 border-b border-rule py-4 text-sm text-ink first:pt-0 last:border-0 last:pb-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="flex items-center gap-2 font-medium">
                  <Swatch index={i} />
                  {row.competitor_name}
                </h3>
                <span className="num flex-none">
                  {formatRating(clampRating(row.avg_rating))}
                  <span className="text-ink-muted"> /5</span>
                </span>
              </div>
              <SentimentCell value={row.sentiment_distribution} />
              <div>
                <p className="mb-1 text-[13px] text-ink-muted">Kekuatan utama</p>
                <BulletList items={row.core_strengths} />
              </div>
              <div>
                <p className="mb-1 text-[13px] text-ink-muted">Kelemahan yang bisa dimanfaatkan</p>
                <BulletList items={row.exploitable_weaknesses} />
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto md:block" role="region" aria-label="Rincian kompetitor, dapat digulir" tabIndex={0}>
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule-strong">
                <th scope="col" className="h-9 w-[16%] pr-3 text-left text-xs font-normal text-ink-muted">Kompetitor</th>
                <th scope="col" className="h-9 w-[8%] px-3 text-right text-xs font-normal text-ink-muted">Rating</th>
                <th scope="col" className="h-9 w-[20%] px-3 text-left text-xs font-normal text-ink-muted">Sentimen ulasan</th>
                <th scope="col" className="h-9 w-[26%] px-3 text-left text-xs font-normal text-ink-muted">Kekuatan utama</th>
                <th scope="col" className="h-9 pl-3 text-left text-xs font-normal text-ink-muted">Kelemahan yang bisa dimanfaatkan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.competitor_name + i} className="border-b border-rule align-top last:border-0">
                  <th scope="row" className="py-3 pr-3 text-left font-medium text-ink">
                    <span className="flex items-center gap-2">
                      <Swatch index={i} />
                      {row.competitor_name}
                    </span>
                  </th>
                  <td className="num px-3 py-3 text-right text-ink">
                    {formatRating(clampRating(row.avg_rating))}
                    <span className="text-ink-muted"> /5</span>
                  </td>
                  <td className="px-3 py-3">
                    <SentimentCell value={row.sentiment_distribution} />
                  </td>
                  <td className="px-3 py-3 text-ink">
                    <BulletList items={row.core_strengths} />
                  </td>
                  <td className="py-3 pl-3 text-ink">
                    <BulletList items={row.exploitable_weaknesses} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function Module2Report({
  result,
  failed,
  isDegraded,
}: {
  result: Module2Result;
  failed: FailedCompetitor[];
  isDegraded: boolean;
}) {
  const rows = result.competitors_breakdown.slice(0, 3);
  return (
    <div className="flex flex-col gap-10">
      {isDegraded ? <DegradedNotice /> : null}
      <section aria-labelledby="h-gap">
        <SectionHeading id="h-gap" title="Matriks celah kompetitor" />
        <div className="flex flex-col gap-[var(--gap)]">
        <MarketOverview data={result.market_overview} competitors={rows.length} />
        <FailedCompetitors items={failed} />
        {rows.length === 0 ? (
          <EmptyState>Tidak ada kompetitor yang berhasil dianalisis.</EmptyState>
        ) : (
          <>
            <GapMatrix rows={rows} />
            <BreakdownTable rows={rows} />
          </>
        )}
        </div>
      </section>
      <section aria-labelledby="h-playbook">
        <SectionHeading
          id="h-playbook"
          title="Playbook rebut pasar"
          description="Strategi dari kelemahan kompetitor, dengan hook pemasaran siap salin."
        />
        <Playbook items={result.steal_the_market_playbook} />
      </section>
    </div>
  );
}
