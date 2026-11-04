import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildLoginRedirectPath, isProtectedDashboardPath } from "@/lib/supabase/auth-guard";
import { DEMO_SESSION_COOKIE, isValidDemoCookie } from "@/lib/supabase/demo-auth";
import { createSupabaseFetch, getSupabaseConfig } from "@/lib/supabase/env";

/**
 * Next.js 16 request proxy: refreshes Supabase auth cookies and redirects unauthenticated
 * requests targeting Dashboard, Modul_1, or Modul_2 to /masuk?next=… before rendering (Req 1.2).
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (isValidDemoCookie(request.cookies.get(DEMO_SESSION_COOKIE)?.value)) {
    return supabaseResponse;
  }

  let url = "";
  let publishableKey = "";
  try {
    const cfg = getSupabaseConfig();
    url = cfg.url;
    publishableKey = cfg.publishableKey;
  } catch {
    if (isProtectedDashboardPath(request.nextUrl.pathname)) {
      const redirectUrl = new URL(
        buildLoginRedirectPath(request.nextUrl.pathname, request.nextUrl.search),
        request.url
      );
      return NextResponse.redirect(redirectUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, publishableKey, {
    global: {
      fetch: createSupabaseFetch(url, publishableKey),
      headers: {
        apikey: publishableKey,
      },
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedDashboardPath(request.nextUrl.pathname)) {
    const redirectUrl = new URL(
      buildLoginRedirectPath(request.nextUrl.pathname, request.nextUrl.search),
      request.url
    );
    const redirectResponse = NextResponse.redirect(redirectUrl);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
