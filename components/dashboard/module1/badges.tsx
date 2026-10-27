import { AlertTriangle, CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RISK_LABEL, VIABILITY_LABEL, labelFor } from "@/lib/labels";

/** Three verdicts, three distinct pills: different label, icon and tint (Requirement 6.3). */
export function ViabilityBadge({ status }: { status: unknown }) {
  const label = labelFor(VIABILITY_LABEL, status);
  if (status === "VIABLE") {
    return (
      <Badge variant="positive">
        <CircleCheck aria-hidden="true" />
        {label}
      </Badge>
    );
  }
  if (status === "NOT_VIABLE") {
    return (
      <Badge variant="negative">
        <CircleX aria-hidden="true" />
        {label}
      </Badge>
    );
  }
  if (status === "VIABLE_WITH_NOTES") {
    return (
      <Badge variant="warning">
        <AlertTriangle aria-hidden="true" />
        {label}
      </Badge>
    );
  }
  return <Badge variant="neutral">{label}</Badge>;
}

export function RiskBadge({ level }: { level: unknown }) {
  const label = labelFor(RISK_LABEL, level);
  const variant = level === "HIGH" ? "negative" : level === "MEDIUM" ? "warning" : "neutral";
  return <Badge variant={variant}>{label}</Badge>;
}
