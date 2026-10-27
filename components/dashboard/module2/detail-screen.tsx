"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState, PageHeader } from "@/components/dashboard/common";
import { RadarJobView } from "@/components/dashboard/module2/radar-job-view";
import { RETRY_FAILED_MESSAGE } from "@/components/dashboard/module2/use-radar-run";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { mockResultFor } from "@/lib/mock/module2";
import { mockId, radarStore, sleep, useRadarRows } from "@/lib/mock/store";
import { type RadarJobDbRow, mapDbRowToRadarJob } from "@/lib/services/module2-service";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RadarJob } from "@/lib/types";

export function Module2DetailScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const storeJob = useRadarRows().find((r) => r.id === id);
  const [fetchedJob, setFetchedJob] = useState<RadarJob | null>(null);
  const [loading, setLoading] = useState(
    !storeJob && Boolean(id) && !id.startsWith("ps-") && !id.startsWith("demo-")
  );
  const [creating, setCreating] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (storeJob || !id || id.startsWith("ps-") || id.startsWith("demo-")) {
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    (async () => {
      for (let attempt = 0; attempt <= 3; attempt++) {
        if (cancelled) return;
        const { data, error } = await supabase
          .from("module2_radars")
          .select("*")
          .eq("id", id)
          .single();

        if (!error && data) {
          if (!cancelled) {
            const mapped = mapDbRowToRadarJob(data as RadarJobDbRow);
            setFetchedJob(mapped);
            radarStore.upsert(mapped);
            setLoading(false);
          }
          return;
        }
        // PGRST116 means 0 rows returned (not found or blocked by RLS)
        if (error?.code === "PGRST116") {
          break;
        }
        if (attempt < 3) {
          await sleep(5000);
        }
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, storeJob]);

  const job = storeJob ?? fetchedJob;

  if (loading && !job) {
    return (
      <>
        <PageHeader title="Detail analisis kompetitor" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    );
  }

  if (!job) {
    // Not found or not the signed-in user's: nothing from the row is shown (Req 24.6).
    return (
      <>
        <PageHeader title="Analisis tidak ditemukan" />
        <EmptyState>
          Data analisis ini tidak ditemukan atau bukan milik akun Anda.{" "}
          <Link href="/dashboard/petasaingan/riwayat" className="font-medium text-brand hover:underline">
            Kembali ke riwayat
          </Link>
        </EmptyState>
      </>
    );
  }

  // "Coba Lagi" from history: a new PENDING job with the same URLs; the failed job is kept (Req 20.6, 20.9).
  const retry = async (from: RadarJob) => {
    if (creating) return;
    setCreating(true);
    setRetryError(null);

    if (from.id.startsWith("ps-") || from.id.startsWith("demo-")) {
      const next: RadarJob = {
        id: mockId("ps"),
        created_at: new Date().toISOString(),
        maps_urls: [...from.maps_urls],
        status: "PENDING",
        result: null,
        failed_competitors: [],
        error_message: null,
        is_degraded: false,
      };
      radarStore.upsert(next);
      setTimeout(() => radarStore.upsert({ ...next, status: "SCRAPING" }), 900);
      setTimeout(() => radarStore.upsert({ ...next, status: "ANALYZING" }), 3100);
      setTimeout(
        () => radarStore.upsert({ ...next, status: "COMPLETED", result: mockResultFor(next.maps_urls.length) }),
        5100
      );
      router.push(`/dashboard/petasaingan/${next.id}`);
      setCreating(false);
      return;
    }

    try {
      const res = await fetch("/api/module2/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [...from.maps_urls] }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        job?: RadarJob;
        error?: string;
      };

      if (!res.ok && !data.job) {
        setRetryError(data.error ?? RETRY_FAILED_MESSAGE);
        setCreating(false);
        return;
      }

      if (data.job) {
        radarStore.upsert(data.job);
        router.push(`/dashboard/petasaingan/${data.job.id}`);
      }
    } catch {
      setRetryError(RETRY_FAILED_MESSAGE);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Detail analisis kompetitor"
        description={`Dibuat ${formatDateTime(job.created_at)}. Dibuka dari riwayat tanpa mengambil ulang ulasan.`}
      />
      <RadarJobView job={job} onRetry={retry} retrying={creating} retryError={retryError} />
    </>
  );
}
