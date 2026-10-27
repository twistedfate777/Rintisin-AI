import { Gauge } from "@/components/charts/gauge";
import { EmptyState } from "@/components/dashboard/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent0 } from "@/lib/format";
import { clampScore } from "@/lib/numbers";
import type { Step2Result } from "@/lib/types";

export function GtmReadiness({ data }: { data: Step2Result["gtm_readiness"] }) {
  const score = Math.round(clampScore(data.overall_score));
  const plan = [...data.priority_action_plan].sort((a, b) => a.step_number - b.step_number);

  return (
    <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
      <Card className="lg:col-span-5">
        <CardHeader>
          <CardTitle>Skor kesiapan</CardTitle>
        </CardHeader>
        {/* Score and verdict side by side in one card (Req 9.2). */}
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
          <Gauge value={score} label={formatPercent0(score)} name="Skor kesiapan go-to-market" size={168} />
          <div className="min-w-0">
            <p className="text-[13px] text-ink-muted">Putusan</p>
            <p className="mt-1 text-[15px] leading-6 font-semibold text-ink">{data.readiness_verdict}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-7">
        <CardHeader>
          <CardTitle>Revisi wajib sebelum produksi massal</CardTitle>
        </CardHeader>
        <CardContent>
          {data.mandatory_revisions.length === 0 ? (
            <EmptyState>Tidak ada revisi wajib yang tercatat.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.mandatory_revisions.map((revision, i) => {
                const id = `revisi-${i}`;
                return (
                  <li key={id} className="flex items-start gap-3">
                    <input
                      id={id}
                      type="checkbox"
                      className="mt-0.5 size-[18px] flex-none rounded-[3px] accent-[var(--brand)]"
                    />
                    <label htmlFor={id} className="text-sm text-ink">
                      {revision}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-12">
        <CardHeader>
          <CardTitle>Rencana aksi prioritas</CardTitle>
        </CardHeader>
        <CardContent>
          {plan.length === 0 ? (
            <EmptyState>Belum ada langkah aksi yang disusun.</EmptyState>
          ) : (
            <ol className="grid grid-cols-1 gap-[var(--gap)] md:grid-cols-2">
              {plan.map((step) => (
                <li key={step.step_number} className="flex gap-3">
                  <span className="num flex size-7 flex-none items-center justify-center rounded-full bg-raised text-sm font-medium text-ink">
                    {step.step_number}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{step.phase}</p>
                    <p className="mt-1 text-sm text-ink">{step.action}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
