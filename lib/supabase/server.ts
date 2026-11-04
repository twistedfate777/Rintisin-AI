import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  DEMO_SESSION_COOKIE,
  createDemoSupabaseUser,
  isValidDemoCookie,
} from "@/lib/supabase/demo-auth";
import { createSupabaseFetch, getSupabaseConfig } from "@/lib/supabase/env";

export const UNAUTHORIZED_MESSAGE = "Sesi Anda telah berakhir. Silakan masuk kembali.";

/**
 * Server-side Supabase client bound to the current request cookies.
 * Never exposes service-role keys, Groq keys, or Worker_Secret to the client (Requirement 2.4).
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    global: {
      fetch: createSupabaseFetch(url, publishableKey),
      headers: {
        apikey: publishableKey,
      },
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where response cookies cannot be mutated;
          // proxy.ts refreshes cookies on the request/response boundary.
        }
      },
    },
  });
}

export type AuthenticatedContext =
  | { ok: true; supabase: SupabaseClient; user: User; isDemo?: boolean }
  | { ok: false; status: 401; error: string; response: NextResponse };

/**
 * Verifies an active Auth_Service session for Server Actions and API Routes (Requirement 1.3).
 * Returns HTTP 401 metadata when no valid session exists.
 */
export async function requireAuthenticatedUser(): Promise<AuthenticatedContext> {
  try {
    const cookieStore = await cookies();
    const isDemoSession = isValidDemoCookie(cookieStore.get(DEMO_SESSION_COOKIE)?.value);

    const supabase = await createSupabaseServerClient();

    if (isDemoSession) {
      return { ok: true, supabase, user: createDemoSupabaseUser(), isDemo: true };
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return { ok: true, supabase, user };
    }

    return {
      ok: false,
      status: 401,
      error: UNAUTHORIZED_MESSAGE,
      response: NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 }),
    };
  } catch {
    return {
      ok: false,
      status: 401,
      error: UNAUTHORIZED_MESSAGE,
      response: NextResponse.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 }),
    };
  }
}
