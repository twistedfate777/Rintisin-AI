import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildLoginRedirectPath, isProtectedDashboardPath } from "@/lib/supabase/auth-guard";

/**
 * Next.js 16 request proxy: refreshes Supabase auth cookies and redirects unauthenticated
 * requests targeting Dashboard, Modul_1, or Modul_2 to /masuk?next=… before rendering (Req 1.2).
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
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
