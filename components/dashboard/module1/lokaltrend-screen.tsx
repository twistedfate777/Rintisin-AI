"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { DemoSwitcher, PageHeader } from "@/components/dashboard/common";
import { IdeaForm } from "@/components/dashboard/module1/idea-form";
import { Module1Report } from "@/components/dashboard/module1/module1-report";
import { StepStatusText } from "@/components/dashboard/module1/step-status";
import {
  MODULE1_SCENARIOS,
  demoAnalysis,
  useModule1Run,
} from "@/components/dashboard/module1/use-module1-run";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, truncateText } from "@/lib/format";
import { KATEGORI_LABEL, labelFor } from "@/lib/labels";
import { mockIdeaInput } from "@/lib/mock/module1";
import { useModule1Rows } from "@/lib/mock/store";

const KNOWN = new Set<string>(MODULE1_SCENARIOS.map((s) => s.value));

export function LokalTrendScreen() {
  const params = useSearchParams();
  const raw = params.get("state") ?? "";
  const scenario = KNOWN.has(raw) ? raw : "";
  // Remount per scenario so each demo state starts clean.
  return <LokalTrendBody key={scenario} scenario={scenario} />;
}

function LokalTrendBody({ scenario }: { scenario: string }) {
  const { analysis, submitting, serverError, start, retryStep1, retryStep2, reset } = useModule1Run(
    demoAnalysis(scenario, mockIdeaInput),
    scenario
  );
  const busy = submitting || analysis?.step1_status === "RUNNING" || analysis?.step2_status === "RUNNING";

  return (
    <>
      <PageHeader
        title="LokalTrend Radar"
        description={
          analysis
            ? "Audit kelayakan finansial dan kesiapan go-to-market untuk draf ide di bawah."
            : "Validasi ide produk sebelum modal keluar: HPP, margin, risiko, target pasar, dan langkah go-to-market."
        }
        actions={
          analysis ? (
            <Button variant="outline" onClick={reset} disabled={busy}>
              <Plus aria-hidden="true" />
              Analisis ide baru
            </Button>
          ) : null
        }
      />
      {scenario ? (
        <DemoSwitcher
          basePath="/dashboard/lokaltrend"
          states={[...MODULE1_SCENARIOS]}
          current={scenario}
        />
      ) : null}

      {analysis ? (
        <Module1Report analysis={analysis} onRetryStep1={retryStep1} onRetryStep2={retryStep2} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-[var(--gap)] lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Draf ide produk</CardTitle>
            </CardHeader>
            <CardContent>
              <IdeaForm onSubmit={start} busy={busy} serverError={serverError} />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-[var(--gap)] lg:col-span-5">
            <WhatYouGet />
            <RecentAnalyses />
          </div>
        </div>
      )}
    </>
  );
}

function WhatYouGet() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Yang dinilai</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-4 text-sm">
          <div>
            <dt className="font-medium text-ink">Langkah 1 · audit kelayakan</dt>
            <dd className="mt-0.5 text-ink-muted">
              Estimasi HPP, harga jual, margin kotor, risiko operasional, kejenuhan tren, segmen utama, dan
              kanal distribusi.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-ink">Langkah 2 · kesiapan pasar</dt>
            <dd className="mt-0.5 text-ink-muted">
              UVP, perbandingan dengan pemain lokal, skor kesiapan go-to-market, revisi wajib, dan rencana
              aksi mingguan termasuk NIB, PIRT, dan Halal bila relevan.
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function RecentAnalyses() {
  const rows = useModule1Rows().slice(0, 3);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analisis terakhir</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada analisis. Hasil pertama Anda akan muncul di sini.</p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li key={row.id} className="border-b border-rule py-2.5 first:pt-0 last:border-0 last:pb-0">
                <Link href={`/dashboard/lokaltrend/${row.id}`} className="block text-sm font-medium text-ink hover:underline">
                  {truncateText(row.input.product_idea, 64)}
                </Link>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  {labelFor(KATEGORI_LABEL, row.input.category)} · {row.input.target_city} ·{" "}
                  <StepStatusText step1={row.step1_status} step2={row.step2_status} /> ·{" "}
                  {formatDateTime(row.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/dashboard/lokaltrend/riwayat"
          className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
        >
          Lihat semua riwayat
        </Link>
      </CardContent>
    </Card>
  );
}
