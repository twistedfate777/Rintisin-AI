import { Check, Circle, Loader2, X } from "lucide-react";
import { cn } from "cn";
import { JOB_STATUS_LABEL } from "@/lib/labels";
import type { JobStatus } from "@/lib/types";

const ORDER: JobStatus[] = ["PENDING", "SCRAPING", "ANALYZING", "COMPLETED"];
const STAGE_HINT: Record<JobStatus, string> = {
  PENDING: "Permintaan diterima server analisis",
  SCRAPING: "Ulasan terbaru dan rating terendah",
  ANALYZING: "Kekuatan, kelemahan, dan celah pasar",
  COMPLETED: "Hasil siap dibaca",
  FAILED: "Analisis berhenti",
};

type StageState = "done" | "active" | "waiting" | "stopped" | "failed";

const STATE_TEXT: Record<StageState, string> = {
  done: "selesai",
  active: "sedang berjalan",
  waiting: "belum berjalan",
  stopped: "terhenti",
  failed: "gagal",
};

/**
 * Four stages in order. Each state has its own icon and words, not only a colour (Req 21.1).
 * A FAILED job marks the stage it stopped at in grey, and only the last stage, "Gagal", in red.
 */
export function JobStepper({
  status,
  failedAt,
}: {
  status: JobStatus;
  /** The last non-terminal stage reached before failing. */
  failedAt?: JobStatus;
}) {
  const failed = status === "FAILED";
  const reached = failed ? ORDER.indexOf(failedAt ?? "PENDING") : ORDER.indexOf(status);

  const stages = ORDER.map((code, i) => {
    let state: StageState;
    if (failed) state = i === 3 ? "failed" : i < reached ? "done" : i === reached ? "stopped" : "waiting";
    else if (status === "COMPLETED") state = "done";
    else state = i < reached ? "done" : i === reached ? "active" : "waiting";
    const label = i === 3 && failed ? JOB_STATUS_LABEL.FAILED : JOB_STATUS_LABEL[code];
    return { code, label, state, hint: i === 3 && failed ? STAGE_HINT.FAILED : STAGE_HINT[code] };
  });

  return (
    <div>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-6">
        {stages.map((stage) => (
          <li key={stage.code} className="flex flex-col gap-2">
            <span
              aria-hidden="true"
              className={cn(
                "hidden h-0.5 w-full rounded-full sm:block",
                stage.state === "done" && "bg-ink-soft",
                stage.state === "active" && "bg-brand",
                stage.state === "failed" && "bg-negative",
                (stage.state === "waiting" || stage.state === "stopped") && "bg-active"
              )}
            />
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-px flex size-5 flex-none items-center justify-center rounded-full",
                  stage.state === "done" && "bg-ink-soft text-surface",
                  stage.state === "active" && "bg-brand text-surface",
                  stage.state === "failed" && "bg-pill-negative-bg text-pill-negative-ink",
                  (stage.state === "waiting" || stage.state === "stopped") && "bg-active text-ink-muted"
                )}
                aria-hidden="true"
              >
                {stage.state === "done" ? <Check className="size-3" strokeWidth={2.5} /> : null}
                {stage.state === "active" ? (
                  <Loader2 className="size-3 animate-spin motion-reduce:animate-none" strokeWidth={2.5} />
                ) : null}
                {stage.state === "failed" || stage.state === "stopped" ? <X className="size-3" strokeWidth={2.5} /> : null}
                {stage.state === "waiting" ? <Circle className="size-1.5" strokeWidth={3} /> : null}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", stage.state === "waiting" ? "text-ink-muted" : "text-ink")}>
                  {stage.label}
                </p>
                <p className="text-[13px] text-ink-muted">
                  {STATE_TEXT[stage.state]}
                  {stage.state === "active" || stage.state === "failed" ? ` · ${stage.hint}` : null}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
