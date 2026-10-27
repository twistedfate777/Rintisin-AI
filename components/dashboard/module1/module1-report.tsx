"use client";

import { DegradedNotice, ErrorBlock, SectionHeading } from "@/components/dashboard/common";
import { CompetitorMatrix } from "@/components/dashboard/module1/competitor-matrix";
import { FeasibilityAuditor } from "@/components/dashboard/module1/feasibility-auditor";
import { GtmReadiness } from "@/components/dashboard/module1/gtm-readiness";
import { TargetMarketMapper } from "@/components/dashboard/module1/target-market-mapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/format";
import { KATEGORI_LABEL, labelFor } from "@/lib/labels";
import type { IdeaInput, Module1Analysis } from "@/lib/types";

export const STEP1_ERROR =
  "Layanan AI sedang tidak tersedia. Input Anda sudah tersimpan, jadi Anda tidak perlu mengisi ulang formulir.";
export const STEP2_ERROR =
  "Matriks kompetitor dan skor kesiapan belum bisa dibuat. Hasil Langkah 1 di atas tetap tersimpan.";

export function InputSummary({ input }: { input: IdeaInput }) {
  return (
    <section aria-labelledby="ringkasan-input" className="mb-8 rounded-xl bg-raised p-5">
      <h2 id="ringkasan-input" className="sr-only">
        Input analisis
      </h2>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div className="sm:col-span-3 lg:col-span-1">
          <dt className="text-[13px] text-ink-muted">Draf ide produk</dt>
          <dd className="mt-0.5 text-sm text-ink">{input.product_idea}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-ink-muted">Kategori</dt>
          <dd className="mt-0.5 text-sm text-ink">{labelFor(KATEGORI_LABEL, input.category)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-ink-muted">Modal awal</dt>
          <dd className="num mt-0.5 text-sm text-ink">{formatRupiah(input.initial_capital_idr)}</dd>
        </div>
        <div>
          <dt className="text-[13px] text-ink-muted">Kota target</dt>
          <dd className="mt-0.5 text-sm text-ink">{input.target_city}</dd>
        </div>
      </dl>
    </section>
  );
}

/** Loading: the final layout with labels at once and flat bars at the values' real size. */
function CardSkeleton({ title, lines = 3, className }: { title: string; lines?: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-7 w-2/5" />
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${92 - i * 14}%` }} />
        ))}
      </CardContent>
    </Card>
  );
}

function Step1Skeleton() {
  return (
    <>
      <section aria-labelledby="h-kelayakan" className="mb-10">
        <SectionHeading id="h-kelayakan" title="Audit kelayakan & keberlanjutan" />
        <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
          <CardSkeleton title="Kelayakan finansial per unit" lines={4} className="lg:col-span-7" />
          <CardSkeleton title="Keberlanjutan tren" lines={4} className="lg:col-span-5" />
          <CardSkeleton title="Risiko operasional" lines={2} className="lg:col-span-12" />
        </div>
      </section>
      <section aria-labelledby="h-target" className="mb-10">
        <SectionHeading id="h-target" title="Target pasar & positioning" />
        <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
          <CardSkeleton title="Segmen utama" className="lg:col-span-5" />
          <CardSkeleton title="Kanal distribusi efektif" className="lg:col-span-7" />
        </div>
      </section>
    </>
  );
}

function Step2Skeleton() {
  return (
    <>
      <section aria-labelledby="h-matriks" className="mb-10">
        <SectionHeading id="h-matriks" title="Konsep produk vs kompetitor" />
        <div className="flex flex-col gap-[var(--gap)]">
          <CardSkeleton title="Rekomendasi nilai jual unik (UVP)" lines={1} />
          <CardSkeleton title="Konsep Anda vs pemain lokal" lines={3} />
        </div>
      </section>
      <section aria-labelledby="h-gtm">
        <SectionHeading id="h-gtm" title="Kesiapan go-to-market" />
        <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
          <CardSkeleton title="Skor kesiapan" className="lg:col-span-5" />
          <CardSkeleton title="Revisi wajib sebelum produksi massal" className="lg:col-span-7" />
        </div>
      </section>
    </>
  );
}

function statusLine(analysis: Module1Analysis): string {
  if (analysis.step1_status === "RUNNING") return "Langkah 1 dari 2 sedang diproses: audit kelayakan dan target pasar.";
  if (analysis.step1_status === "FAILED") return "Langkah 1 gagal.";
  if (analysis.step2_status === "RUNNING")
    return "Langkah 1 selesai. Langkah 2 dari 2 sedang diproses: matriks kompetitor dan kesiapan go-to-market.";
  if (analysis.step2_status === "FAILED") return "Langkah 1 selesai. Langkah 2 gagal.";
  if (analysis.step2_status === "SUCCESS") return "Analisis selesai.";
  return "";
}

export function Module1Report({
  analysis,
  onRetryStep1,
  onRetryStep2,
}: {
  analysis: Module1Analysis;
  onRetryStep1?: () => void;
  onRetryStep2?: () => void;
}) {
  const { step1_status, step2_status, step1_result, step2_result } = analysis;

  return (
    <div>
      <p className="sr-only" role="status" aria-live="polite">
        {statusLine(analysis)}
      </p>
      {analysis.is_degraded ? <DegradedNotice /> : null}
      <InputSummary input={analysis.input} />

      {step1_status === "RUNNING" ? <Step1Skeleton /> : null}
      {step1_status === "FAILED" ? (
        <ErrorBlock
          title="Langkah 1 gagal"
          message={STEP1_ERROR}
          retryLabel="Coba Lagi"
          onRetry={onRetryStep1}
        />
      ) : null}

      {step1_status === "SUCCESS" && step1_result ? (
        <>
          <section aria-labelledby="h-kelayakan" className="mb-10">
            <SectionHeading id="h-kelayakan" title="Audit kelayakan & keberlanjutan" />
            <FeasibilityAuditor audit={step1_result.feasibility_audit} />
          </section>
          <section aria-labelledby="h-target" className="mb-10">
            <SectionHeading id="h-target" title="Target pasar & positioning" />
            <TargetMarketMapper data={step1_result.target_market_mapper} />
          </section>

          {step2_status === "RUNNING" ? <Step2Skeleton /> : null}
          {step2_status === "FAILED" ? (
            <ErrorBlock
              title="Langkah 2 gagal"
              message={STEP2_ERROR}
              retryLabel="Coba Lagi Langkah 2"
              onRetry={onRetryStep2}
            />
          ) : null}
          {step2_status === "SUCCESS" && step2_result ? (
            <>
              <section aria-labelledby="h-matriks" className="mb-10">
                <SectionHeading id="h-matriks" title="Konsep produk vs kompetitor" />
                <CompetitorMatrix data={step2_result.competitor_matrix} />
              </section>
              <section aria-labelledby="h-gtm">
                <SectionHeading id="h-gtm" title="Kesiapan go-to-market" />
                <GtmReadiness data={step2_result.gtm_readiness} />
              </section>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
