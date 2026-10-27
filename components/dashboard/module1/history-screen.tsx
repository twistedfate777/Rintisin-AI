"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { ConfirmDelete } from "@/components/dashboard/confirm-delete";
import { EmptyState, PageHeader } from "@/components/dashboard/common";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatInteger, truncateText } from "@/lib/format";
import { KATEGORI_LABEL, STEP_STATUS_LABEL, labelFor } from "@/lib/labels";
import { deleteModule1Analysis, useModule1Rows } from "@/lib/mock/store";
import type { Module1Analysis, StepStatus } from "@/lib/types";

function StepBadge({ status }: { status: StepStatus }) {
  const label = labelFor(STEP_STATUS_LABEL, status);
  if (status === "SUCCESS")
    return (
      <Badge variant="positive">
        <CircleCheck aria-hidden="true" />
        {label}
      </Badge>
    );
  if (status === "FAILED")
    return (
      <Badge variant="negative">
        <CircleX aria-hidden="true" />
        {label}
      </Badge>
    );
  if (status === "RUNNING")
    return (
      <Badge variant="neutral">
        <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        {label}
      </Badge>
    );
  return <Badge variant="neutral">{label}</Badge>;
}

function DeleteAction({ row }: { row: Module1Analysis }) {
  const running = row.step1_status === "RUNNING" || row.step2_status === "RUNNING";
  return (
    <ConfirmDelete
      objectName="analisis ini"
      description={`Analisis "${truncateText(row.input.product_idea, 60)}" beserta hasilnya akan dihapus dari riwayat dan tidak dapat dikembalikan.`}
      disabled={running}
      disabledReason="Analisis yang sedang diproses tidak dapat dihapus."
      onConfirm={async () => {
        const res = await deleteModule1Analysis(row);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Analisis dihapus dari riwayat.");
      }}
    />
  );
}

export function Module1HistoryScreen() {
  const rows = useModule1Rows();

  return (
    <>
      <PageHeader
        title="Riwayat LokalTrend Radar"
        description={
          rows.length > 0
            ? `${formatInteger(rows.length)} analisis ide produk, terbaru di atas. Membuka hasil tidak memakai kuota AI.`
            : undefined
        }
        actions={
          <Link href="/dashboard/lokaltrend" className={buttonVariants({ variant: "default" })}>
            Analisis ide baru
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState>
          Riwayat masih kosong.{" "}
          <Link href="/dashboard/lokaltrend" className="font-medium text-brand hover:underline">
            Isi formulir ide produk
          </Link>{" "}
          untuk menjalankan analisis pertama.
        </EmptyState>
      ) : (
        <>
          {/* Desktop and tablet: a table */}
          <div className="hidden rounded-xl border border-border px-5 py-2 sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Dibuat</TableHead>
                  <TableHead>Ide produk</TableHead>
                  <TableHead className="w-[100px]">Kategori</TableHead>
                  <TableHead className="w-[140px]">Kota target</TableHead>
                  <TableHead className="w-[130px]">Langkah 1</TableHead>
                  <TableHead className="w-[130px]">Langkah 2</TableHead>
                  <TableHead className="w-[90px]">
                    <span className="sr-only">Aksi</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="num whitespace-nowrap text-ink-muted">{formatDateTime(row.created_at)}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/lokaltrend/${row.id}`} className="font-medium text-ink hover:underline">
                        {truncateText(row.input.product_idea, 80)}
                      </Link>
                    </TableCell>
                    <TableCell>{labelFor(KATEGORI_LABEL, row.input.category)}</TableCell>
                    <TableCell>{row.input.target_city}</TableCell>
                    <TableCell>
                      <StepBadge status={row.step1_status} />
                    </TableCell>
                    <TableCell>
                      <StepBadge status={row.step2_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteAction row={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Phone: two-line rows, every field kept */}
          <ul className="flex flex-col sm:hidden">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 border-b border-rule py-4 first:pt-0">
                <Link href={`/dashboard/lokaltrend/${row.id}`} className="text-sm font-medium text-ink">
                  {truncateText(row.input.product_idea, 80)}
                </Link>
                <p className="text-[13px] text-ink-muted">
                  {labelFor(KATEGORI_LABEL, row.input.category)} · {row.input.target_city} ·{" "}
                  <span className="num">{formatDateTime(row.created_at)}</span>
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                    <span>Langkah 1</span>
                    <StepBadge status={row.step1_status} />
                    <span>Langkah 2</span>
                    <StepBadge status={row.step2_status} />
                  </div>
                  <DeleteAction row={row} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
