"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { DemoSwitcher, PageHeader } from "@/components/dashboard/common";
import { CompetitorForm } from "@/components/dashboard/module2/competitor-form";
import { RadarJobView } from "@/components/dashboard/module2/radar-job-view";
import { JobStatusBadge } from "@/components/dashboard/module2/job-status-badge";
import { MODULE2_SCENARIOS, isTerminal, useRadarRun } from "@/components/dashboard/module2/use-radar-run";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { useRadarRows } from "@/lib/mock/store";

const KNOWN = new Set<string>(MODULE2_SCENARIOS.map((s) => s.value));

export function PetaSainganScreen() {
  const params = useSearchParams();
  const raw = params.get("state") ?? "";
  const scenario = KNOWN.has(raw) ? raw : "";
  return <PetaSainganBody key={scenario} scenario={scenario} />;
}

function PetaSainganBody({ scenario }: { scenario: string }) {
  const {
    job,
    submitting,
    serverFieldErrors,
    serverError,
    retryError,
    start,
    retry,
    reset,
  } = useRadarRun(scenario);
  const rows = useRadarRows();
  const active = (job ? !isTerminal(job.status) : false) || submitting;
  // Req 13.6: no new job while one of the user's jobs is still running.
  const otherRunning = rows.some((r) => !isTerminal(r.status) && r.id !== job?.id);

  return (
    <>
      <PageHeader
        title="PetaSaingan Ekraf"
        description="Baca ulasan Google Maps hingga 3 kompetitor untuk menemukan celah pasar dan strategi merebut pelanggan mereka."
        actions={
          job ? (
            <Button variant="outline" onClick={reset} disabled={active}>
              <Plus aria-hidden="true" />
              Analisis baru
            </Button>
          ) : null
        }
      />
      <DemoSwitcher basePath="/dashboard/petasaingan" states={[...MODULE2_SCENARIOS]} current={scenario} />

      {job ? (
        <RadarJobView job={job} onRetry={retry} retrying={active} retryError={retryError} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-[var(--gap)] lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>URL Google Maps kompetitor</CardTitle>
            </CardHeader>
            <CardContent>
              <CompetitorForm
                onSubmit={start}
                disabled={active || otherRunning}
                disabledReason={
                  otherRunning ? "Masih ada analisis kompetitor yang berjalan. Tunggu sampai selesai." : undefined
                }
                serverFieldErrors={serverFieldErrors}
                serverError={serverError}
              />
            </CardContent>
          </Card>
          <div className="flex flex-col gap-[var(--gap)] lg:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle>Cara kerjanya</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="flex flex-col gap-4 text-sm">
                  <div>
                    <dt className="font-medium text-ink">Mengambil ulasan</dt>
                    <dd className="mt-0.5 text-ink-muted">
                      Hingga 150 ulasan per tempat, diurutkan dari yang terbaru dan rating terendah.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Menyaring</dt>
                    <dd className="mt-0.5 text-ink-muted">
                      Ulasan pendek dan duplikat dibuang; maksimal 80 ulasan informatif per kompetitor, separuh
                      kritis dan separuh positif.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Menganalisis</dt>
                    <dd className="mt-0.5 text-ink-muted">
                      Skor kualitas produk, harga, kecepatan layanan, dan fasilitas, lalu strategi merebut pasar.
                      Biasanya selesai dalam 1–3 menit.
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Analisis terakhir</CardTitle>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <p className="text-sm text-ink-muted">Belum ada analisis kompetitor.</p>
                ) : (
                  <ul className="flex flex-col">
                    {rows.slice(0, 3).map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-3 border-b border-rule py-2.5 first:pt-0 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/petasaingan/${row.id}`}
                            className="block truncate text-sm font-medium text-ink hover:underline"
                          >
                            {row.result?.competitors_breakdown.map((c) => c.competitor_name).join(", ") ||
                              `${row.maps_urls.length} URL kompetitor`}
                          </Link>
                          <p className="num text-[13px] text-ink-muted">{formatDateTime(row.created_at)}</p>
                        </div>
                        <JobStatusBadge status={row.status} />
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/dashboard/petasaingan/riwayat"
                  className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
                >
                  Lihat semua riwayat
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
