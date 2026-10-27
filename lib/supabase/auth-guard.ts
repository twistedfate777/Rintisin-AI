// Shared route-protection and post-login redirect helpers (Requirement 1.2, 1.6).

export const LOGIN_PATH = "/masuk";
export const DEFAULT_DASHBOARD_PATH = "/dashboard";

/**
 * Only internal paths under /dashboard (including /dashboard/lokaltrend and /dashboard/petasaingan)
 * are accepted as the post-login destination (Requirement 1.2, 1.6).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return DEFAULT_DASHBOARD_PATH;
  const trimmed = next.trim();
  if (
    (trimmed === "/dashboard" || trimmed.startsWith("/dashboard/") || trimmed.startsWith("/dashboard?")) &&
    !trimmed.startsWith("//") &&
    !trimmed.includes("\\")
  ) {
    return trimmed;
  }
  return DEFAULT_DASHBOARD_PATH;
}

/** Returns true when a request pathname targets Dashboard, Modul_1, or Modul_2. */
export function isProtectedDashboardPath(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

/** Builds the /masuk redirect path while preserving the originally requested path and query string. */
export function buildLoginRedirectPath(pathname: string, search = ""): string {
  const requested = `${pathname}${search}`;
  const params = new URLSearchParams({ next: requested });
  return `${LOGIN_PATH}?${params.toString()}`;
}
