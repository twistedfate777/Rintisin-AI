import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/supabase/auth-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /auth/callback
 * Handles PKCE code exchange (`?code=...`) and email verification token hash (`?token_hash=...&type=...`)
 * so email confirmation links redirect cleanly to `/dashboard` without exposing raw Supabase URLs.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  try {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  } catch {
    // Fall through to /masuk redirect
  }

  return NextResponse.redirect(`${origin}/masuk`);
}
