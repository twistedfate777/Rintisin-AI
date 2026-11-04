"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronDown, ChevronUp, MapPinned, Radar } from "lucide-react";
import { PageHeader } from "@/components/dashboard/common";
import { ViabilityBadge } from "@/components/dashboard/module1/badges";
import { StepStatusBadge } from "@/components/dashboard/module1/step-status";
import { JobStatusBadge } from "@/components/dashboard/module2/job-status-badge";
import { widestGap } from "@/components/dashboard/module2/module2-report";
import { startOnboardingTourNow } from "@/components/shell/onboarding-tour";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatPercent0, formatPercent1, truncateText } from "@/lib/format";
import { KATEGORI_LABEL, labelFor } from "@/lib/labels";
import { useModule1Rows, useRadarRows } from "@/lib/mock/store";

const CHECKLIST_DISMISSED_KEY = "rintisin_getting_started_dismissed";

function GettingStartedChecklist({
  hasIdeaAnalysis,
  hasCompetitorAnalysis,
}: {
  hasIdeaAnalysis: boolean;
  hasCompetitorAnalysis: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [tourReplayed, setTourReplayed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(CHECKLIST_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const items = [
    {
      id: "step-tour",
      done: tourReplayed,
      title: "Kenali cara kerja Rintisin AI",
      description:
        "Pelajari fungsi menu Beranda, LokalTrend Radar, PetaSaingan Ekraf, dan Riwayat melalui panduan fitur interaktif.",
      action: (
        <button
          type="button"
          onClick={() => {
            setTourReplayed(true);
            startOnboardingTourNow();
          }}
          className="mt-2 inline-flex text-[13px] font-medium text-brand hover:underline"
        >
          Buka tur pengenalan fitur →
        </button>
      ),
    },
    {
      id: "step-module1",
      done: hasIdeaAnalysis,
      title: "Validasi ide produk pertama Anda di LokalTrend Radar",
      description:
        "Masukkan deskripsi ide produk (minimal 20 karakter), kategori bisnis, modal awal, dan kota target. AI akan menghitung estimasi HPP, harga jual, margin kotor, hingga rencana Go-To-Market.",
      action: (
        <Link
          href="/dashboard/lokaltrend"
          className="mt-2 inline-flex text-[13px] font-medium text-brand hover:underline"
        >
          Mulai validasi ide →
        </Link>
      ),
    },
    {
      id: "step-module2",
      done: hasCompetitorAnalysis,
      title: "Petakan celah kompetitor di PetaSaingan Ekraf",
      description:
        "Tempelkan 1 hingga 3 URL Google Maps kompetitor lokal Anda untuk membedah keluhan pelanggan mereka dan mendapatkan strategi Steal the Market Playbook.",
      action: (
        <Link
          href="/dashboard/petasaingan"
          className="mt-2 inline-flex text-[13px] font-medium text-brand hover:underline"
        >
          Analisis kompetitor sekarang →
        </Link>
      ),
    },
  ];

  const completedCount = items.filter((item) => item.done).length;

  const dismissChecklist = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(CHECKLIST_DISMISSED_KEY, "1");
    } catch {
      // Ignore storage errors.
    }
  };

  return (
    <div
      data-tour="checklist-onboarding"
      className="rounded-xl border border-border bg-surface text-ink"
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">
            Mulai menggunakan Rintisin AI
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Ikuti 3 langkah berikut untuk memaksimalkan riset ide produk dan kompetitor Anda.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="num text-[13px] font-medium text-ink-muted">
            {completedCount}/{items.length}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Tampilkan langkah panduan" : "Sembunyikan langkah panduan"}
            className="flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-hover hover:text-ink"
          >
            {collapsed ? (
              <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ChevronUp className="size-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <>
          <ul className="divide-y divide-rule border-t border-rule">
            {items.map((item, idx) => (
              <li key={item.id} className="flex items-start gap-3.5 px-5 py-4">
                <span
                  aria-hidden="true"
                  className={
                    item.done
                      ? "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-pill-positive-bg text-pill-positive-ink"
                      : "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-pill-neutral-bg text-[12px] font-semibold text-ink-muted"
                  }
                >
                  {item.done ? <Check className="size-3.5" strokeWidth={2} /> : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-[19px] text-ink-muted">
                    {item.description}
                  </p>
                  {item.action}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t border-rule px-5 py-3">
            <button
              type="button"
              onClick={dismissChecklist}
              className="text-[13px] font-medium text-brand hover:underline"
            >
              Jangan tampilkan &ldquo;Mulai menggunakan Rintisin AI&rdquo; lagi
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function LatestLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] text-ink-muted">{children}</p>;
}

function LokalTrendPanel() {
  const rows = useModule1Rows();
  const latest = rows.find((r) => r.step1_status === "SUCCESS" && r.step2_status === "SUCCESS");
  return (
    <Card data-tour="card-lokaltrend" className="lg:col-span-6">
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
    <Card data-tour="card-petasaingan" className="lg:col-span-6">
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
    <Card data-tour="card-riwayat">
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
  const ideaRows = useModule1Rows();
  const radarRows = useRadarRows();
  const ideaCount = ideaRows.length;
  const radarCount = radarRows.length;
  const hasIdeaAnalysis = ideaRows.some((r) => r.step1_status === "SUCCESS");
  const hasCompetitorAnalysis = radarRows.some((r) => r.status === "COMPLETED");
  return (
    <>
      <PageHeader
        title="Beranda"
        description={`${ideaCount} analisis ide produk dan ${radarCount} analisis kompetitor tersimpan di akun Anda.`}
      />
      <div className="flex flex-col gap-[var(--gap)]">
        <GettingStartedChecklist
          hasIdeaAnalysis={hasIdeaAnalysis}
          hasCompetitorAnalysis={hasCompetitorAnalysis}
        />
        <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
          <LokalTrendPanel />
          <PetaSainganPanel />
        </div>
        <RecentHistory />
      </div>
    </>
  );
}
