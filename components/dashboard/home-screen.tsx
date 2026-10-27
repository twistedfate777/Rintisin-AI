"use client";

import Link from "next/link";
import { MapPinned, Radar } from "lucide-react";
import { PageHeader } from "@/components/dashboard/common";
import { ViabilityBadge } from "@/components/dashboard/module1/badges";
import { StepStatusBadge } from "@/components/dashboard/module1/step-status";
import { JobStatusBadge } from "@/components/dashboard/module2/job-status-badge";
import { widestGap } from "@/components/dashboard/module2/module2-report";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatPercent0, formatPercent1, truncateText } from "@/lib/format";
import { KATEGORI_LABEL, labelFor } from "@/lib/labels";
import { useModule1Rows, useRadarRows } from "@/lib/mock/store";

function LatestLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-ink-muted">{children}</p>;
}

function LokalTrendPanel() {
  const rows = useModule1Rows();
  const latest = rows.find((r) => r.step1_status === "SUCCESS" && r.step2_status === "SUCCESS");
  return (
    <Card className="lg:col-span-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radar className="size-4 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
          <Link href="/dashboard/lokaltrend" className="hover:underline">
            LokalTrend Radar
          </Link>
        </CardTitle>
        <p className="text-sm text-ink-muted">
          Validasi kelayakan finansial dan kesiapan go-to-market dari draf ide produk.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="border-t border-rule pt-4">
          {latest?.step1_result && latest.step2_result ? (
            <>
              <LatestLabel>Hasil terakhir · {formatDateTime(latest.created_at)}</LatestLabel>
              <Link
                href={`/dashboard/lokaltrend/${latest.id}`}
                className="mt-1 block text-sm font-medium text-ink hover:underline"
              >
                {truncateText(latest.input.product_idea, 90)}
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <ViabilityBadge status={latest.step1_result.feasibility_audit.financial_viability_status} />
                <span className="text-ink-muted">
                  Margin kotor{" "}
                  <span className="num text-ink">
                    {formatPercent1(latest.step1_result.feasibility_audit.gross_margin_percentage)}
                  </span>
                </span>
                <span className="text-ink-muted">
                  Kesiapan pasar{" "}
                  <span className="num text-ink">
                    {formatPercent0(latest.step2_result.gtm_readiness.overall_score)}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Belum ada analisis ide yang selesai.</p>
          )}
        </div>
        <div className="mt-auto">
          <Link href="/dashboard/lokaltrend" className={buttonVariants({ variant: "default" })}>
            Validasi ide baru
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PetaSainganPanel() {
  const rows = useRadarRows();
  const latest = rows.find((r) => r.status === "COMPLETED" && r.result);
  const gap = latest?.result ? widestGap(latest.result.competitors_breakdown) : null;
  return (
    <Card className="lg:col-span-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPinned className="size-4 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
          <Link href="/dashboard/petasaingan" className="hover:underline">
            PetaSaingan Ekraf
          </Link>
        </CardTitle>
        <p className="text-sm text-ink-muted">
          Petakan kelemahan hingga 3 kompetitor dari ulasan Google Maps mereka.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="border-t border-rule pt-4">
          {latest?.result ? (
            <>
              <LatestLabel>Hasil terakhir · {formatDateTime(latest.created_at)}</LatestLabel>
              <Link
                href={`/dashboard/petasaingan/${latest.id}`}
                className="mt-1 block text-sm font-medium text-ink hover:underline"
              >
                {latest.result.competitors_breakdown.map((c) => c.competitor_name).join(", ")}
              </Link>
              {gap ? (
                <p className="mt-3 text-sm text-ink-muted">
                  Celah terlebar: <span className="text-ink">{gap.label}</span>, rata-rata{" "}
                  <span className="num text-ink">{gap.average}</span> /100
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-ink-muted">Belum ada analisis kompetitor yang selesai.</p>
          )}
        </div>
        <div className="mt-auto">
          <Link href="/dashboard/petasaingan" className={buttonVariants({ variant: "outline" })}>
            Analisis kompetitor
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentHistory() {
  const ideas = useModule1Rows().map((row) => ({
    id: row.id,
    created_at: row.created_at,
    module: "LokalTrend Radar",
    href: `/dashboard/lokaltrend/${row.id}`,
    title: truncateText(row.input.product_idea, 80),
    meta: `${labelFor(KATEGORI_LABEL, row.input.category)} · ${row.input.target_city}`,
    status: <StepStatusBadge step1={row.step1_status} step2={row.step2_status} />,
  }));
  const radars = useRadarRows().map((row) => ({
    id: row.id,
    created_at: row.created_at,
    module: "PetaSaingan Ekraf",
    href: `/dashboard/petasaingan/${row.id}`,
    title:
      row.result?.competitors_breakdown.map((c) => c.competitor_name).join(", ") ||
      `${row.maps_urls.length} URL kompetitor`,
    meta: `${row.maps_urls.length} URL`,
    status: <JobStatusBadge status={row.status} />,
  }));
  const rows = [...ideas, ...radars].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  return (
    <Card>
      <CardHeader className="grid-cols-[1fr_auto]">
        <CardTitle>Riwayat terbaru</CardTitle>
        <div className="col-start-2 row-start-1 flex gap-4 text-sm">
          <Link href="/dashboard/lokaltrend/riwayat" className="font-medium text-brand hover:underline">
            Semua ide
          </Link>
          <Link href="/dashboard/petasaingan/riwayat" className="font-medium text-brand hover:underline">
            Semua kompetitor
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada analisis. Mulai dari salah satu modul di atas.</p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-1 gap-1 border-b border-rule py-3 first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-center sm:gap-6"
              >
                <span className="num text-[13px] text-ink-muted">{formatDateTime(row.created_at)}</span>
                <div className="min-w-0">
                  <Link href={row.href} className="block truncate text-sm font-medium text-ink hover:underline">
                    {row.title}
                  </Link>
                  <p className="text-[13px] text-ink-muted">
                    {row.module} · {row.meta}
                  </p>
                </div>
                <span className="text-[13px]">{row.status}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function HomeScreen() {
  const ideaCount = useModule1Rows().length;
  const radarCount = useRadarRows().length;
  return (
    <>
      <PageHeader
        title="Beranda"
        description={`${ideaCount} analisis ide produk dan ${radarCount} analisis kompetitor tersimpan di akun Anda.`}
      />
      <div className="flex flex-col gap-[var(--gap)]">
        <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
          <LokalTrendPanel />
          <PetaSainganPanel />
        </div>
        <RecentHistory />
      </div>
    </>
  );
}
