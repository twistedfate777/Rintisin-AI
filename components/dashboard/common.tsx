import Link from "next/link";
import { AlertTriangle, CircleAlert, RotateCcw } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/** The title row: one h1 per screen (22/600), an optional grey line, real actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-title font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-[72ch] text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A section heading inside the sheet: 16/600 with an optional grey line. */
export function SectionHeading({
  id,
  title,
  description,
  aside,
}: {
  id?: string;
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id={id} className="text-section font-semibold text-ink">
          {title}
        </h2>
        {description ? <p className="text-small text-ink-muted">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

/** An empty section keeps its frame: a 1px dashed box with one sentence (app-screens §11). */
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-xl border border-dashed border-control px-4 py-3 text-sm text-ink-muted",
        className
      )}
    >
      {children}
    </p>
  );
}

/** An error inside the block that failed: what failed, what to do, and a retry. */
export function ErrorBlock({
  title,
  message,
  retryLabel,
  onRetry,
  retrying = false,
}: {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <CircleAlert className="mt-0.5 size-4 flex-none text-negative" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-ink-muted">{message}</p>
        </div>
      </div>
      {onRetry && retryLabel ? (
        <Button variant="outline" onClick={onRetry} disabled={retrying} className="flex-none">
          <RotateCcw aria-hidden="true" />
          {retrying ? "Sedang mencoba…" : retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** Shown while is_degraded = true (Requirement 12.6). */
export function DegradedNotice() {
  return (
    <div
      role="status"
      className="mb-6 flex items-start gap-2.5 rounded-md border border-pill-warning-border bg-pill-warning-bg px-3 py-2 text-[13px] text-pill-warning-ink"
    >
      <AlertTriangle className="mt-0.5 size-4 flex-none" strokeWidth={1.75} aria-hidden="true" />
      <p>
        <span className="font-medium">Sebagian data analisis tidak lengkap.</span> Bagian yang kosong
        diisi nilai pengganti; jalankan ulang analisis untuk hasil lengkap.
      </p>
    </div>
  );
}

/** A clearly-marked switcher for the mock states, for demo and review only. */
export function DemoSwitcher({
  basePath,
  states,
  current,
}: {
  basePath: string;
  states: { value: string; label: string }[];
  current: string | null;
}) {
  return (
    <nav
      aria-label="Mode demo"
      className="mb-6 flex items-center gap-x-1 overflow-x-auto rounded-md bg-raised px-3 py-2 text-[13px] whitespace-nowrap sm:flex-wrap sm:gap-y-1"
    >
      <span className="mr-2 text-ink-muted">Mode demo (data contoh):</span>
      {states.map((state) => {
        const href = state.value ? `${basePath}?state=${state.value}` : basePath;
        const active = (current ?? "") === state.value;
        return (
          <Link
            key={state.value}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-sm px-2 py-1 transition-colors",
              active ? "bg-surface font-medium text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            {state.label}
          </Link>
        );
      })}
    </nav>
  );
}
