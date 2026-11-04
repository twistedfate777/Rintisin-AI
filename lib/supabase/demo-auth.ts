import type { User } from "@supabase/supabase-js";

export const DEMO_USER_EMAIL = "john@rintisin.ai";
export const DEMO_USER_PASSWORD = "john12345678";
export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const DEMO_SESSION_COOKIE = "rintisin_demo_session";

const DEMO_EMAIL_ALIASES = new Set([
  "john",
  "john@rintisin.ai",
  "john@demo.com",
  "john@example.com",
  "john@rintisin.id",
]);

/**
 * Normalizes shorthand demo input ("john") into a full valid email ("john@rintisin.ai")
 * so form validation and auth routes accept "john" directly.
 */
export function normalizeDemoEmailInput(rawEmail: string): string {
  const trimmed = rawEmail.trim();
  if (trimmed.toLowerCase() === "john") {
    return DEMO_USER_EMAIL;
  }
  return trimmed;
}

/**
 * Returns true if the provided email (or shorthand) belongs to the John demo account.
 */
export function isDemoAccountEmail(rawEmail: string | null | undefined): boolean {
  if (!rawEmail) return false;
  const normalized = rawEmail.trim().toLowerCase();
  return DEMO_EMAIL_ALIASES.has(normalized);
}

export function isValidDemoCookie(cookieValue: string | null | undefined): boolean {
  if (!cookieValue) return false;
  return isDemoAccountEmail(cookieValue);
}

export function createDemoSupabaseUser(): User {
  const timestamp = "2026-01-01T00:00:00.000Z";
  return {
    id: DEMO_USER_ID,
    app_metadata: { provider: "email", providers: ["email"], demo: true },
    user_metadata: { name: "John (Demo)", email: DEMO_USER_EMAIL, demo: true },
    aud: "authenticated",
    created_at: timestamp,
    email: DEMO_USER_EMAIL,
    email_confirmed_at: timestamp,
    role: "authenticated",
    updated_at: timestamp,
  };
}
