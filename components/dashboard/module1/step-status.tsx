import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STEP_STATUS_LABEL, labelFor } from "@/lib/labels";
import type { StepStatus } from "@/lib/types";

/** One phrase for both steps, e.g. "Selesai" or "Langkah 2 gagal". */
export function stepSummary(step1: StepStatus, step2: StepStatus): string {
  if (step1 === "SUCCESS" && step2 === "SUCCESS") return "Selesai";
  const s1 = labelFor(STEP_STATUS_LABEL, step1).toLowerCase();
  if (step1 !== "SUCCESS") return `Langkah 1 ${s1}`;
  return `Langkah 2 ${labelFor(STEP_STATUS_LABEL, step2).toLowerCase()}`;
}

export function StepStatusText({ step1, step2 }: { step1: StepStatus; step2: StepStatus }) {
  const failed = step1 === "FAILED" || step2 === "FAILED";
  return <span className={failed ? "text-negative" : undefined}>{stepSummary(step1, step2)}</span>;
}

/** The same summary as a status pill, for lists that mix both modules. */
export function StepStatusBadge({ step1, step2 }: { step1: StepStatus; step2: StepStatus }) {
  const text = stepSummary(step1, step2);
  if (step1 === "FAILED" || step2 === "FAILED")
    return (
      <Badge variant="negative">
        <CircleX aria-hidden="true" />
        {text}
      </Badge>
    );
  if (step1 === "SUCCESS" && step2 === "SUCCESS")
    return (
      <Badge variant="positive">
        <CircleCheck aria-hidden="true" />
        {text}
      </Badge>
    );
  return (
    <Badge variant="neutral">
      <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {text}
    </Badge>
  );
}
