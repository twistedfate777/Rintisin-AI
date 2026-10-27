import { Gauge } from "@/components/charts/gauge";
import { EmptyState } from "@/components/dashboard/common";
import { RiskBadge, ViabilityBadge } from "@/components/dashboard/module1/badges";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent1, formatRupiah } from "@/lib/format";
import { TREND_LABEL, labelFor } from "@/lib/labels";
import { clampScore } from "@/lib/numbers";
import type { FeasibilityAudit } from "@/lib/types";

/**
 * Price anatomy: the selling price as one bar, split into the cost (HPP) and what is left as gross
 * margin. This is the screen's signature element: the margin is seen as part of the price.
 */
function PriceAnatomy({ cogs, price }: { cogs: number; price: number }) {
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const safeCogs = Number.isFinite(cogs) && cogs > 0 ? cogs : 0;
  const cogsShare = safePrice > 0 ? Math.min(100, (safeCogs / safePrice) * 100) : 0;
  const margin = Math.max(0, safePrice - safeCogs);
  if (safePrice === 0) {
    return <EmptyState>Harga jual belum tersedia, jadi komposisi harga tidak dapat digambar.</EmptyState>;
  }
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-sm" aria-hidden="true">
        <div className="h-full bg-ink-soft" style={{ width: `${cogsShare}%` }} />
        <div className="h-full flex-1 bg-chart-1" />
      </div>
      <dl className="mt-2.5 flex flex-col gap-1.5 text-[13px] sm:flex-row sm:justify-between sm:gap-4">
        <div className="flex items-center gap-1.5">
          <span className="size-2 flex-none rounded-full bg-ink-soft" aria-hidden="true" />
          <dt className="text-ink-muted">Biaya pokok (HPP)</dt>
          <dd className="num text-ink">{formatRupiah(safeCogs)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 flex-none rounded-full bg-chart-1" aria-hidden="true" />
          <dt className="text-ink-muted">Sisa untuk margin</dt>
          <dd className="num text-ink">{formatRupiah(margin)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function FeasibilityAuditor({ audit }: { audit: FeasibilityAudit }) {
  const saturation = Math.round(clampScore(audit.trend_sustainability.saturation_score));
  return (
    <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
      <Card className="lg:col-span-7">
        <CardHeader>
          <CardTitle>Kelayakan finansial per unit</CardTitle>
          <CardAction>
            <ViabilityBadge status={audit.financial_viability_status} />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex flex-none flex-col items-center">
            <Gauge
              value={audit.gross_margin_percentage}
              label={formatPercent1(clampScore(audit.gross_margin_percentage))}
              name="Margin kotor"
              size={184}
            />
            <p className="mt-1 text-[13px] text-ink-muted">Margin kotor</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <dl className="grid grid-cols-2 divide-x divide-border">
              <div className="pr-4">
                <dt className="text-[13px] text-ink-muted">Estimasi HPP</dt>
                <dd className="num mt-1 text-[20px] leading-7 text-ink">
                  {formatRupiah(audit.estimated_cogs_idr)}
                </dd>
              </div>
              <div className="pl-4">
                <dt className="text-[13px] text-ink-muted">Harga jual rekomendasi</dt>
                <dd className="num mt-1 text-[20px] leading-7 text-ink">
                  {formatRupiah(audit.recommended_selling_price_idr)}
                </dd>
              </div>
            </dl>
            <PriceAnatomy
              cogs={audit.estimated_cogs_idr}
              price={audit.recommended_selling_price_idr}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-5">
        <CardHeader>
          <CardTitle>Keberlanjutan tren</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 divide-x divide-border">
            <div className="pr-4">
              <dt className="text-[13px] text-ink-muted">Kategori tren</dt>
              <dd className="mt-1 text-[15px] font-medium text-ink">
                {labelFor(TREND_LABEL, audit.trend_sustainability.category)}
              </dd>
            </div>
            <div className="pl-4">
              <dt className="text-[13px] text-ink-muted">Skor kejenuhan pasar</dt>
              <dd className="num mt-1 text-[15px] text-ink">
                <span className="font-medium">{saturation}</span>
                <span className="text-ink-muted"> /100</span>
              </dd>
            </div>
          </dl>
          <div>
            <div
              role="meter"
              aria-label="Skor kejenuhan pasar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={saturation}
              className="h-2 w-full overflow-hidden rounded-full bg-active"
            >
              <div className="h-full rounded-full bg-ink-soft" style={{ width: `${saturation}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-ink-muted">
              <span>0 · pasar masih sepi</span>
              <span>100 · sangat jenuh</span>
            </div>
          </div>
          <p className="text-sm text-ink">{audit.trend_sustainability.analysis}</p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-12">
        <CardHeader>
          <CardTitle>Risiko operasional</CardTitle>
        </CardHeader>
        <CardContent>
          {audit.operational_risks.length === 0 ? (
            <EmptyState>Tidak ada risiko operasional yang tercatat untuk ide ini.</EmptyState>
          ) : (
            <>
            {/* Phone: two-line rows, every field kept */}
            <ul className="flex flex-col sm:hidden">
              {audit.operational_risks.map((risk, i) => (
                <li key={`${risk.aspect}-${i}`} className="flex flex-col gap-1.5 border-b border-rule py-3 first:pt-0 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{risk.aspect}</span>
                    <RiskBadge level={risk.risk_level} />
                  </div>
                  <p className="text-sm text-ink">{risk.mitigation}</p>
                </li>
              ))}
            </ul>
            <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28%]">Aspek</TableHead>
                  <TableHead className="w-[14%]">Tingkat risiko</TableHead>
                  <TableHead>Mitigasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.operational_risks.map((risk, i) => (
                  <TableRow key={`${risk.aspect}-${i}`}>
                    <TableCell className="font-medium">{risk.aspect}</TableCell>
                    <TableCell>
                      <RiskBadge level={risk.risk_level} />
                    </TableCell>
                    <TableCell className="min-w-[280px]">{risk.mitigation}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
