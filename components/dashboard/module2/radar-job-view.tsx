"use client";

import { AlertTriangle, CircleCheck } from "lucide-react";
import { ErrorBlock } from "@/components/dashboard/common";
import { JobStepper } from "@/components/dashboard/module2/job-stepper";
import { Module2Report } from "@/components/dashboard/module2/module2-report";
import {
  REALTIME_DISCONNECT_MESSAGE,
  useRadarRealtimeJob,
} from "@/components/dashboard/module2/use-radar-run";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatInteger } from "@/lib/format";
import { JOB_STATUS_LABEL } from "@/lib/labels";
import type { RadarJob } from "@/lib/types";

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--gap)]" aria-hidden="true">
      <Card>
        <CardHeader>
          <CardTitle>Gambaran pasar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-[var(--gap)] lg:grid-cols-12">
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Peta skor aspek</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="mx-auto h-[220px] w-[220px] rounded-full" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Skor aspek per kompetitor</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** One Radar_Job: the progress stepper, then its result or its failure with "Coba Lagi". */
export function RadarJobView({
  job: initialJob,
  onRetry,
  retrying,
  retryError,
}: {
  job: RadarJob;
  onRetry?: (job: RadarJob) => void;
  retrying?: boolean;
  retryError?: string | null;
}) {
  const { job, storedJob, disconnected, readError } = useRadarRealtimeJob(initialJob);
  const timedOut = job.status === "FAILED" && storedJob.status !== "FAILED";
  const failedAt = timedOut ? storedJob.status : "PENDING";

  const meta = (
    <>
      <span className="num">{formatInteger(job.maps_urls.length)}</span> URL kompetitor · dimulai{" "}
      <span className="num">{formatDateTime(job.created_at)}</span>
    </>
  );
  const urlList = (
    <details className="text-[13px] text-ink-muted">
      <summary className="cursor-pointer text-ink">URL yang dianalisis</summary>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
        {job.maps_urls.map((url) => (
          <li key={url} className="break-all">
            {url}
          </li>
        ))}
      </ol>
    </details>
  );

  return (
    <div className="flex flex-col gap-10">
      {/* Kept mounted across stages so each status change, including "Selesai", is announced. */}
      <p className="sr-only" role="status" aria-live="polite">
        Status analisis: {JOB_STATUS_LABEL[job.status]}
      </p>

      {disconnected ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-pill-warning-border bg-pill-warning-bg px-3 py-2 text-[13px] text-pill-warning-ink"
        >
          <AlertTriangle className="mt-0.5 size-4 flex-none" strokeWidth={1.75} aria-hidden="true" />
          <p>{REALTIME_DISCONNECT_MESSAGE}</p>
        </div>
      ) : null}
      {readError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-pill-warning-border bg-pill-warning-bg px-3 py-2 text-[13px] text-pill-warning-ink"
        >
          <AlertTriangle className="mt-0.5 size-4 flex-none" strokeWidth={1.75} aria-hidden="true" />
          <p>{readError}</p>
        </div>
      ) : null}

      {job.status === "COMPLETED" ? (
        // Once done, the stepper folds to one line so the report starts on the first screen.
        <div className="-mb-4 flex flex-col gap-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <CircleCheck className="size-4 text-positive" strokeWidth={1.75} aria-hidden="true" />
              Analisis selesai
            </span>
            <span aria-hidden="true">·</span>
            <span>{meta}</span>
          </p>
          {urlList}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Progres analisis</CardTitle>
            <p className="text-[13px] text-ink-muted">{meta}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <JobStepper status={job.status} failedAt={failedAt} />
            {urlList}
          </CardContent>
        </Card>
      )}

      {job.status === "FAILED" ? (
        <div className="flex flex-col gap-3">
          <ErrorBlock
            title="Analisis kompetitor gagal"
            message={job.error_message ?? "Analisis gagal diselesaikan. Silakan coba lagi."}
            retryLabel="Coba Lagi"
            onRetry={onRetry ? () => onRetry(job) : undefined}
            retrying={retrying}
          />
          {retryError ? (
            <p role="alert" className="text-[13px] text-negative">
              {retryError}
            </p>
          ) : null}
        </div>
      ) : null}

      {job.status === "COMPLETED" && job.result ? (
        <Module2Report result={job.result} failed={job.failed_competitors} isDegraded={job.is_degraded} />
      ) : null}

      {job.status !== "COMPLETED" && job.status !== "FAILED" ? <ResultSkeleton /> : null}
    </div>
  );
}
