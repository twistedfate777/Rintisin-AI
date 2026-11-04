import { describe, expect, it, vi } from "vitest";
import {
  AUTH_CONFIG_MISSING,
  AUTH_SERVICE_ERROR,
  formatLoginErrorMessage,
  formatRegisterErrorMessage,
  LOGIN_EMAIL_NOT_CONFIRMED,
  LOGIN_FAILED,
  LOGIN_RATE_LIMITED,
  REGISTER_ALREADY_EXISTS,
  REGISTER_FAILED,
  REGISTER_INVALID_EMAIL,
  REGISTER_RATE_LIMITED,
  REGISTER_WEAK_PASSWORD,
} from "./auth-error-messages";
import { createSupabaseFetch } from "./env";

describe("createSupabaseFetch", () => {
  it("always attaches apikey header and query param and strips non-JWT sb_publishable_ Bearer header", async () => {
    const supabaseUrl = "https://beqtcmarfjixqbemaysi.supabase.co";
    const publishableKey = "sb_publishable_N4nospga1JuDjb2mRByucg_stYexzZa";

    const mockFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const wrappedFetch = createSupabaseFetch(supabaseUrl, publishableKey, mockFetch as unknown as typeof fetch);

    await wrappedFetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${publishableKey}`,
        "Content-Type": "application/json",
      },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(
      `${supabaseUrl}/auth/v1/signup?apikey=${encodeURIComponent(publishableKey)}`
    );
    const headers = new Headers(calledInit.headers);
    expect(headers.get("apikey")).toBe(publishableKey);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("preserves user session JWT Bearer header when present", async () => {
    const supabaseUrl = "https://beqtcmarfjixqbemaysi.supabase.co";
    const publishableKey = "sb_publishable_N4nospga1JuDjb2mRByucg_stYexzZa";
    const userJwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.user.sig";

    const mockFetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const wrappedFetch = createSupabaseFetch(supabaseUrl, publishableKey, mockFetch as unknown as typeof fetch);

    await wrappedFetch(`${supabaseUrl}/rest/v1/module1_analyses`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    });

    const [, calledInit] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(calledInit.headers);
    expect(headers.get("apikey")).toBe(publishableKey);
    expect(headers.get("Authorization")).toBe(`Bearer ${userJwt}`);
  });
});

describe("auth error message formatters", () => {
  it("formats login errors accurately while keeping credential errors identical (Req 1.4)", () => {
    expect(formatLoginErrorMessage({ code: "invalid_credentials", status: 400 })).toBe(LOGIN_FAILED);
    expect(formatLoginErrorMessage({ message: "Invalid login credentials", status: 400 })).toBe(LOGIN_FAILED);
    expect(formatLoginErrorMessage({ code: "email_not_confirmed", status: 400 })).toBe(
      LOGIN_EMAIL_NOT_CONFIRMED
    );
    expect(formatLoginErrorMessage({ status: 429, message: "Request rate limit reached" })).toBe(
      LOGIN_RATE_LIMITED
    );
    expect(formatLoginErrorMessage({ message: "No API key found in request" })).toBe(
      AUTH_CONFIG_MISSING
    );
    expect(formatLoginErrorMessage({ status: 503, message: "Service unavailable" })).toBe(
      AUTH_SERVICE_ERROR
    );
  });

  it("formats registration errors with specific actionable messages", () => {
    expect(formatRegisterErrorMessage({ code: "user_already_exists", status: 422 })).toBe(
      REGISTER_ALREADY_EXISTS
    );
    expect(formatRegisterErrorMessage({ message: "User already registered", status: 400 })).toBe(
      REGISTER_ALREADY_EXISTS
    );
    expect(formatRegisterErrorMessage({ code: "weak_password", status: 422 })).toBe(
      REGISTER_WEAK_PASSWORD
    );
    expect(formatRegisterErrorMessage({ code: "over_email_send_rate_limit", status: 429 })).toBe(
      REGISTER_RATE_LIMITED
    );
    expect(formatRegisterErrorMessage({ message: "Unable to validate email address: invalid format" })).toBe(
      REGISTER_INVALID_EMAIL
    );
    expect(formatRegisterErrorMessage({ message: "No API key found in request" })).toBe(
      AUTH_CONFIG_MISSING
    );
    expect(formatRegisterErrorMessage({ status: 500, message: "Database error" })).toBe(
      AUTH_SERVICE_ERROR
    );
    expect(formatRegisterErrorMessage({ status: 400, message: "Unknown error" })).toBe(
      REGISTER_FAILED
    );
  });
});
