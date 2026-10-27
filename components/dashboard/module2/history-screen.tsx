"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/dashboard/confirm-delete";
import { EmptyState, PageHeader } from "@/components/dashboard/common";
import { JobStatusBadge } from "@/components/dashboard/module2/job-status-badge";
import { isTerminal } from "@/components/dashboard/module2/use-radar-run";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatInteger } from "@/lib/format";
import { deleteRadarJob, useRadarRows } from "@/lib/mock/store";
import type { RadarJob } from "@/lib/types";

const PAGE_SIZE = 20;

function jobTitle(job: RadarJob): string {
  const names = job.result?.competitors_breakdown.map((c) => c.competitor_name) ?? [];
  return names.length > 0 ? names.join(", ") : "Analisis tanpa hasil";
}

function DeleteAction({ job }: { job: RadarJob }) {
  return (
    <ConfirmDelete
      objectName="analisis kompetitor ini"
      description={`Hasil analisis ${formatDateTime(job.created_at)} untuk ${job.maps_urls.length} URL kompetitor akan dihapus dari riwayat dan tidak dapat dikembalikan.`}
      disabled={!isTerminal(job.status)}
      disabledReason="Analisis yang masih berjalan tidak dapat dihapus."
      onConfirm={async () => {
        const res = await deleteRadarJob(job);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Analisis kompetitor dihapus dari riwayat.");
      }}
    />
  );
}

export function Module2HistoryScreen() {
  const rows = useRadarRows().slice(0, PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Riwayat PetaSaingan Ekraf"
        description={
          rows.length > 0
            ? `${formatInteger(rows.length)} analisis kompetitor, terbaru di atas. Membuka hasil tidak menjalankan ulang pengambilan ulasan.`
            : undefined
        }
        actions={
          <Link href="/dashboard/petasaingan" className={buttonVariants({ variant: "default" })}>
            Analisis kompetitor baru
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState>
          Riwayat masih kosong.{" "}
          <Link href="/dashboard/petasaingan" className="font-medium text-brand hover:underline">
            Masukkan URL kompetitor
          </Link>{" "}
          untuk analisis pertama.
        </EmptyState>
      ) : (
        <>
          <div className="hidden rounded-xl border border-border px-5 py-2 sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Dibuat</TableHead>
                  <TableHead>Kompetitor</TableHead>
                  <TableHead className="w-[110px] text-right">Jumlah URL</TableHead>
                  <TableHead className="w-[150px]">Status</TableHead>
                  <TableHead className="w-[90px]">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="num whitespace-nowrap text-ink-muted">{formatDateTime(job.created_at)}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/petasaingan/${job.id}`} className="font-medium text-ink hover:underline">
                        {jobTitle(job)}
                      </Link>
                      {job.failed_competitors.length > 0 ? (
                        <p className="text-[13px] text-ink-muted">
                          {formatInteger(job.failed_competitors.length)} URL tidak dapat dianalisis
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="num text-right">{formatInteger(job.maps_urls.length)}</TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteAction job={job} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="flex flex-col sm:hidden">
            {rows.map((job) => (
              <li key={job.id} className="flex flex-col gap-2 border-b border-rule py-4 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/dashboard/petasaingan/${job.id}`} className="text-sm font-medium text-ink">
                    {jobTitle(job)}
                  </Link>
                  <JobStatusBadge status={job.status} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="num text-[13px] text-ink-muted">
                    {formatDateTime(job.created_at)} · {formatInteger(job.maps_urls.length)} URL
                  </p>
                  <DeleteAction job={job} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
