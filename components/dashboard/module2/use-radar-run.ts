"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DISPATCH_ERROR,
  TIMEOUT_ERROR,
  mockFailedCompetitors,
  mockResultEmptyPlaybook,
  mockResultFor,
  mockResultFull,
  mockResultPartial,
  mockUrls,
} from "@/lib/mock/module2";
import { mockId, radarStore, sleep, useRadarRows } from "@/lib/mock/store";
import {
  JOB_TIMEOUT_MS,
  type RadarJobDbRow,
  mapDbRowToRadarJob,
  shouldAcceptJobStatusUpdate,
} from "@/lib/services/module2-service";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { JobStatus, Module2Result, RadarJob } from "@/lib/types";

export const MODULE2_SCENARIOS = [
  { value: "", label: "Formulir" },
  { value: "selesai", label: "Hasil lengkap" },
  { value: "berjalan", label: "Sedang berjalan" },
  { value: "sebagian-gagal", label: "Sebagian gagal" },
  { value: "gagal", label: "Gagal" },
  { value: "batas-waktu", label: "Batas waktu" },
  { value: "playbook-kosong", label: "Playbook kosong" },
] as const;

export { JOB_TIMEOUT_MS };
export const TERMINAL: JobStatus[] = ["COMPLETED", "FAILED"];
export const isTerminal = (status: JobStatus) => TERMINAL.includes(status);

export const REALTIME_DISCONNECT_MESSAGE =
  "Koneksi pembaruan status terputus. Menampilkan status terakhir yang diketahui dan mencoba menyambungkan kembali…";
export const DB_READ_FAILED_MESSAGE =
  "Status analisis tidak dapat dimuat setelah beberapa percobaan. Periksa koneksi Anda lalu muat ulang halaman.";
export const RETRY_FAILED_MESSAGE =
  "Percobaan ulang gagal membuat analisis baru. Silakan coba lagi beberapa saat lagi.";

function isMockJobId(id: string): boolean {
  return id.startsWith("demo-") || id.startsWith("ps-");
}

function demoJob(scenario: string): RadarJob | null {
  const base: RadarJob = {
    id: `demo-${scenario}`,
    created_at: "2026-10-19T08:00:00.000Z",
    maps_urls: mockUrls,
    status: "COMPLETED",
    result: mockResultFull,
    failed_competitors: [],
    error_message: null,
    is_degraded: false,
  };
  switch (scenario) {
    case "selesai":
      return base;
    case "berjalan":
      return { ...base, status: "ANALYZING", result: null, created_at: new Date().toISOString() };
    case "sebagian-gagal":
      return { ...base, result: mockResultPartial, failed_competitors: mockFailedCompetitors };
    case "gagal":
      return { ...base, status: "FAILED", result: null, error_message: DISPATCH_ERROR };
    case "batas-waktu":
      // Stored as SCRAPING, created long before now: the screen shows it as timed out (Req 20.5).
      return { ...base, status: "SCRAPING", result: null, created_at: "2026-10-01T08:00:00.000Z" };
    case "playbook-kosong":
      return { ...base, result: mockResultEmptyPlaybook };
    default:
      return null;
  }
}

/** Applies the 300-second rule: a non-terminal job past its deadline is shown as FAILED. */
export function useEffectiveJob(job: RadarJob | null): RadarJob | null {
  const [now, setNow] = useState(() => Date.now());
  const createdMs = job ? new Date(job.created_at).getTime() : 0;
  const terminal = job ? isTerminal(job.status) : true;

  useEffect(() => {
    if (!job || terminal) return;
    const wait = createdMs + JOB_TIMEOUT_MS - Date.now();
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wait) + 50);
    return () => clearTimeout(timer);
  }, [job, terminal, createdMs]);

  if (!job || terminal) return job;
  if (now - createdMs > JOB_TIMEOUT_MS) {
    return { ...job, status: "FAILED", error_message: TIMEOUT_ERROR };
  }
  return job;
}

/**
 * Requirement 21: Single DB read on open (up to 3 retries with 5s interval) + single
 * Supabase Realtime_Channel filtered by radar_id while non-terminal, with monotonic
 * status progression, reconnect sync read, and unsubscribe on terminal or unmount.
 */
export function useRadarRealtimeJob(initialJob: RadarJob) {
  const [remoteByJobId, setRemoteByJobId] = useState<Record<string, RadarJob>>({});
  const [disconnectedByJobId, setDisconnectedByJobId] = useState<Record<string, boolean>>({});
  const [readErrorByJobId, setReadErrorByJobId] = useState<Record<string, string | null>>({});
  const storeRows = useRadarRows();

  const storeCandidate = storeRows.find((r) => r.id === initialJob.id);
  const remoteCandidate = remoteByJobId[initialJob.id];

  let liveJob = initialJob;
  if (
    storeCandidate &&
    (storeCandidate.status === liveJob.status ||
      shouldAcceptJobStatusUpdate(liveJob.status, storeCandidate.status))
  ) {
    liveJob = storeCandidate;
  }
  if (
    remoteCandidate &&
    (remoteCandidate.status === liveJob.status ||
      shouldAcceptJobStatusUpdate(liveJob.status, remoteCandidate.status))
  ) {
    liveJob = remoteCandidate;
  }

  const latestJobRef = useRef<RadarJob>(liveJob);
  useEffect(() => {
    latestJobRef.current = liveJob;
  }, [liveJob]);

  const applyRow = useCallback((row: RadarJobDbRow) => {
    const mapped = mapDbRowToRadarJob(row);
    const current = latestJobRef.current;
    if (mapped.id !== current.id) return;
    if (
      mapped.status !== current.status &&
      !shouldAcceptJobStatusUpdate(current.status, mapped.status)
    ) {
      return;
    }
    latestJobRef.current = mapped;
    setRemoteByJobId((prev) => ({ ...prev, [mapped.id]: mapped }));
    radarStore.upsert(mapped);
  }, []);

  const readJobWithRetry = useCallback(
    async (jobId: string, cancelledRef: { current: boolean }): Promise<boolean> => {
      const supabase = createSupabaseBrowserClient();
      const maxRetries = 3;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (cancelledRef.current) return false;
        const { data, error } = await supabase
          .from("module2_radars")
          .select("*")
          .eq("id", jobId)
          .single();

        if (!error && data) {
          if (!cancelledRef.current) {
            applyRow(data as RadarJobDbRow);
            setReadErrorByJobId((prev) => ({ ...prev, [jobId]: null }));
          }
          return true;
        }
        if (attempt < maxRetries) {
          await sleep(5000);
        }
      }
      if (!cancelledRef.current) {
        setReadErrorByJobId((prev) => ({ ...prev, [jobId]: DB_READ_FAILED_MESSAGE }));
      }
      return false;
    },
    [applyRow]
  );

  useEffect(() => {
    const jobId = initialJob.id;
    if (!jobId || isMockJobId(jobId)) return;

    const cancelledRef = { current: false };
    // Req 21.1: Read Radar_Job once from DB when opened (with up to 3 retries, 5s apart).
    void readJobWithRetry(jobId, cancelledRef);

    return () => {
      cancelledRef.current = true;
    };
  }, [initialJob.id, readJobWithRetry]);

  const effective = useEffectiveJob(liveJob) ?? liveJob;
  const terminal = isTerminal(effective.status);

  useEffect(() => {
    const jobId = liveJob.id;
    if (!jobId || isMockJobId(jobId) || terminal) {
      return;
    }

    const cancelledRef = { current: false };
    const supabase = createSupabaseBrowserClient();
    let hadDisconnected = false;

    const channel = supabase
      .channel(`radar-job-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "module2_radars",
          filter: `id=eq.${jobId}`,
        },
        (payload: { new?: unknown }) => {
          if (cancelledRef.current) return;
          if (payload.new && typeof payload.new === "object") {
            applyRow(payload.new as RadarJobDbRow);
          }
        }
      )
      .subscribe((status: string) => {
        if (cancelledRef.current) return;
        if (status === "SUBSCRIBED") {
          if (hadDisconnected) {
            hadDisconnected = false;
            setDisconnectedByJobId((prev) => ({ ...prev, [jobId]: false }));
            // Req 21.4: Re-read once on reconnect and clear disconnect notice.
            void readJobWithRetry(jobId, cancelledRef);
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          hadDisconnected = true;
          setDisconnectedByJobId((prev) => ({ ...prev, [jobId]: true }));
        }
      });

    const pollIntervalId = window.setInterval(async () => {
      if (cancelledRef.current) return;
      try {
        const { data, error } = await supabase
          .from("module2_radars")
          .select("*")
          .eq("id", jobId)
          .single();
        if (!cancelledRef.current && !error && data) {
          applyRow(data as RadarJobDbRow);
        }
      } catch {
        // Ignore transient polling errors while Realtime/polling continues.
      }
    }, 3000);

    return () => {
      cancelledRef.current = true;
      window.clearInterval(pollIntervalId);
      void supabase.removeChannel(channel);
    };
  }, [liveJob.id, terminal, applyRow, readJobWithRetry]);

  return {
    job: effective,
    storedJob: liveJob,
    disconnected: !terminal && Boolean(disconnectedByJobId[liveJob.id]),
    readError: readErrorByJobId[liveJob.id] ?? null,
  };
}

export function useRadarRun(scenario: string) {
  const [job, setJob] = useState<RadarJob | null>(() => demoJob(scenario));
  const [submitting, setSubmitting] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<number, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const commit = useCallback((next: RadarJob) => {
    setJob(next);
    if (!next.id.startsWith("demo-")) radarStore.upsert(next);
  }, []);

  const runMock = useCallback(
    async (urls: string[], mode: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSubmitting(true);
      try {
        let current: RadarJob = {
          id: mockId("ps"),
          created_at: new Date().toISOString(),
          maps_urls: urls,
          status: "PENDING",
          result: null,
          failed_competitors: [],
          error_message: null,
          is_degraded: false,
        };
        commit(current);
        await sleep(900);
        if (mode === "gagal") {
          commit({ ...current, status: "FAILED", error_message: DISPATCH_ERROR });
          return;
        }
        current = { ...current, status: "SCRAPING" };
        commit(current);
        await sleep(2200);
        current = { ...current, status: "ANALYZING" };
        commit(current);
        await sleep(2000);

        const partial = mode === "sebagian-gagal" && urls.length >= 2;
        const result: Module2Result = partial
          ? mockResultFor(urls.length - 1)
          : mode === "playbook-kosong"
            ? { ...mockResultFor(urls.length), steal_the_market_playbook: [] }
            : mockResultFor(urls.length);
        commit({
          ...current,
          status: "COMPLETED",
          result,
          failed_competitors: partial
            ? [{ maps_url: urls[urls.length - 1], reason: "URL Google Maps tidak dapat dikenali" }]
            : [],
        });
      } finally {
        busyRef.current = false;
        setSubmitting(false);
      }
    },
    [commit]
  );

  const dispatchReal = useCallback(
    async (urls: string[], isRetryAttempt: boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSubmitting(true);
      setServerFieldErrors({});
      setServerError(null);
      setRetryError(null);

      try {
        const res = await fetch("/api/module2/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          job?: RadarJob;
          demoFallback?: boolean;
          error?: string;
          fieldErrors?: Record<number, string>;
        };

        if (data.demoFallback) {
          busyRef.current = false;
          setSubmitting(false);
          await runMock(urls, "");
          return;
        }

        if (!res.ok && !data.job) {
          if (isRetryAttempt) {
            setRetryError(data.error ?? RETRY_FAILED_MESSAGE);
          } else {
            if (data.fieldErrors) setServerFieldErrors(data.fieldErrors);
            if (data.error) setServerError(data.error);
          }
          return;
        }

        if (data.job) {
          commit(data.job);
        }
      } catch {
        if (isRetryAttempt) {
          setRetryError(RETRY_FAILED_MESSAGE);
        } else {
          setServerError("Gagal terhubung ke server. Periksa koneksi Anda lalu coba lagi.");
        }
      } finally {
        busyRef.current = false;
        setSubmitting(false);
      }
    },
    [commit, runMock]
  );

  const start = (urls: string[]) => {
    if (scenario !== "") {
      void runMock(urls, scenario);
      return;
    }
    void dispatchReal(urls, false);
  };

  /** "Coba Lagi": a new job with the same URLs in the same order; the failed job is kept. */
  const retry = (from: RadarJob) => {
    if (scenario !== "" || from.id.startsWith("demo-") || from.id.startsWith("ps-")) {
      void runMock([...from.maps_urls], "");
      return;
    }
    void dispatchReal([...from.maps_urls], true);
  };

  const reset = () => {
    if (!busyRef.current) {
      setJob(null);
      setServerFieldErrors({});
      setServerError(null);
      setRetryError(null);
    }
  };

  return {
    job,
    submitting,
    serverFieldErrors,
    serverError,
    retryError,
    start,
    retry,
    reset,
  };
}
