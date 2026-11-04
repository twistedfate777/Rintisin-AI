"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader } from "@/components/dashboard/common";
import { Module1Report } from "@/components/dashboard/module1/module1-report";
import { useModule1Run } from "@/components/dashboard/module1/use-module1-run";
import { formatDateTime } from "@/lib/format";
import { module1Store, useModule1Rows } from "@/lib/mock/store";
import { mapDbRowToModule1Analysis, type Module1DbRow } from "@/lib/services/module1-service";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Module1Analysis } from "@/lib/types";

export function Module1DetailScreen() {
  const { id } = useParams<{ id: string }>();
  const rows = useModule1Rows();
  const row = rows.find((r) => r.id === id) ?? null;
  const [loading, setLoading] = useState(!row && Boolean(id) && !id.startsWith("lt-"));

  useEffect(() => {
    const isIncomplete =
      !row || row.step1_status === "RUNNING" || row.step2_status === "RUNNING";
    if (!isIncomplete || !id || id.startsWith("lt-") || id.startsWith("demo-")) return;
    let cancelled = false;

    const loadFromDb = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("module1_analyses")
          .select("*")
          .eq("id", id)
          .single();

        if (!cancelled && !error && data) {
          module1Store.upsert(mapDbRowToModule1Analysis(data as Module1DbRow));
        }
      } catch {
        // Handled by not-found state below.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadFromDb();
    return () => {
      cancelled = true;
    };
  }, [id, row]);

  if (loading && !row) {
    return <PageHeader title="Memuat analisis ide…" />;
  }

  if (!row) {
    // Not found, or not the signed-in user's row: nothing from it is shown (Req 10.6).
    return (
      <>
        <PageHeader title="Analisis tidak tersedia" />
        <EmptyState>
          Analisis ini tidak ditemukan atau bukan milik akun Anda.{" "}
          <Link href="/dashboard/lokaltrend/riwayat" className="font-medium text-brand hover:underline">
            Kembali ke riwayat
          </Link>
        </EmptyState>
      </>
    );
  }
  return <DetailBody key={row.id} row={row} />;
}

function DetailBody({ row }: { row: Module1Analysis }) {
  // Renders the stored JSON; Groq is only called again when the user presses a retry button (Req 10.3).
  const { analysis, retryStep1, retryStep2 } = useModule1Run(row, "");
  const shown = analysis ?? row;
  return (
    <>
      <PageHeader
        title="Detail analisis ide"
        description={`Dibuat ${formatDateTime(shown.created_at)}. Dibuka dari riwayat tanpa memakai kuota AI.`}
      />
      <Module1Report analysis={shown} onRetryStep1={retryStep1} onRetryStep2={retryStep2} />
    </>
  );
}
