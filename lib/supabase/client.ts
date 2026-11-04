"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseFetch, getSupabaseConfig } from "@/lib/supabase/env";

/** Browser Supabase client for Auth and Realtime_Channel subscriptions (Requirement 1, 2.3, 21). */
export function createSupabaseBrowserClient(): SupabaseClient {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient(url, publishableKey, {
    isSingleton: false,
    global: {
      fetch: createSupabaseFetch(url, publishableKey),
      headers: {
        apikey: publishableKey,
      },
    },
  });
}
