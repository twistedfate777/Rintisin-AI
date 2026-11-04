// Shared Supabase environment resolution & fetch wrapper that guarantees
// the `apikey` header and URL parameter are attached on every Auth, REST, and Storage call.

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/^["']|["']$/g, "").trim();
}

export function getSupabaseConfig(): { url: string; publishableKey: string } {
  const url =
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
    cleanEnvValue(process.env.SUPABASE_URL);

  const publishableKey =
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    cleanEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.SUPABASE_ANON_KEY) ||
    cleanEnvValue(process.env.SUPABASE_PUBLISHABLE_KEY) ||
    (typeof window === "undefined" ? cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY) : "");

  if (!url || !publishableKey) {
    throw new Error(
      "Konfigurasi Supabase belum lengkap: pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY sudah diatur."
    );
  }

  return { url, publishableKey };
}

/**
 * Custom fetch wrapper for Supabase clients that guarantees:
 * 1. `apikey` header is always set to `publishableKey`.
 * 2. `apikey` query parameter is also appended on requests targeting the Supabase project origin
 *    (so proxies/browsers that strip custom headers never trigger "No API key found in request").
 * 3. Non-JWT `sb_publishable_...` keys are not sent as `Authorization: Bearer sb_publishable_...`
 *    on Auth endpoints when no user JWT is present.
 */
export function createSupabaseFetch(
  supabaseUrl: string,
  publishableKey: string,
  baseFetch: typeof fetch = globalThis.fetch
): typeof fetch {
  let projectHost = "";
  try {
    projectHost = new URL(supabaseUrl).hostname.toLowerCase();
  } catch {
    projectHost = "";
  }

  const isNewPublishableKey =
    publishableKey.startsWith("sb_publishable_") || publishableKey.startsWith("sb_secret_");

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );

    if (!headers.get("apikey")) {
      headers.set("apikey", publishableKey);
    }

    // New-format `sb_publishable_...` keys are not JWTs; if GoTrueClient set
    // `Authorization: Bearer sb_publishable_...`, strip that invalid Bearer header
    // while keeping `apikey`.
    const authHeader = headers.get("Authorization") ?? headers.get("authorization");
    if (isNewPublishableKey && authHeader === `Bearer ${publishableKey}`) {
      headers.delete("Authorization");
    }

    let targetInput: RequestInfo | URL = input;
    try {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const parsedUrl = new URL(rawUrl);
      if (
        (!projectHost || parsedUrl.hostname.toLowerCase() === projectHost) &&
        !parsedUrl.searchParams.has("apikey")
      ) {
        parsedUrl.searchParams.set("apikey", publishableKey);
        targetInput =
          typeof input === "string" || input instanceof URL
            ? parsedUrl.toString()
            : new Request(parsedUrl.toString(), input);
      }
    } catch {
      // Keep original input if URL parsing fails
    }

    return baseFetch(targetInput, {
      ...init,
      headers,
    });
  };
}
