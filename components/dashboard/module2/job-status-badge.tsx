import { CircleCheck, CircleX, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_LABEL, labelFor } from "@/lib/labels";
import type { JobStatus } from "@/lib/types";

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const label = labelFor(JOB_STATUS_LABEL, status);
  if (status === "COMPLETED")
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
  return (
    <Badge variant="neutral">
      <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </Badge>
  );
}
