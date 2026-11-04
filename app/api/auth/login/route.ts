import { NextResponse } from "next/server";
import {
  AUTH_CONFIG_MISSING,
  AUTH_SERVICE_ERROR,
  formatLoginErrorMessage,
} from "@/lib/supabase/auth-error-messages";
import {
  DEMO_SESSION_COOKIE,
  DEMO_USER_EMAIL,
  DEMO_USER_PASSWORD,
  isDemoAccountEmail,
  normalizeDemoEmailInput,
} from "@/lib/supabase/demo-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateAuthForm } from "@/lib/validation/auth-form";

function attachDemoCookie(response: NextResponse) {
  response.cookies.set(DEMO_SESSION_COOKIE, DEMO_USER_EMAIL, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown; demo?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown; demo?: unknown };
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email : "";
  const normalizedEmail = normalizeDemoEmailInput(rawEmail);
  const isDemo = body.demo === true || isDemoAccountEmail(rawEmail);
  const rawPassword =
    typeof body.password === "string" && body.password.length > 0
      ? body.password
      : isDemo
        ? DEMO_USER_PASSWORD
        : "";

  const validation = validateAuthForm({
    email: normalizedEmail,
    password: rawPassword,
  });

  if (!validation.success) {
    return NextResponse.json(
      { error: "Periksa kembali email dan kata sandi Anda.", fieldErrors: validation.errors },
      { status: 400 }
    );
  }

  if (isDemo) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signInWithPassword({
        email: DEMO_USER_EMAIL,
        password: rawPassword,
      });
    } catch {
      // Demo session works via cookie even when Supabase Auth is offline or unconfirmed.
    }
    return attachDemoCookie(
      NextResponse.json({ ok: true, demo: true, email: DEMO_USER_EMAIL })
    );
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: AUTH_CONFIG_MISSING }, { status: 500 });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password,
    });

    if (error || !data.session) {
      return NextResponse.json(
        { error: formatLoginErrorMessage(error) },
        { status: error?.status && error.status >= 400 ? error.status : 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("apikey") || msg.toLowerCase().includes("no api key")) {
      return NextResponse.json({ error: AUTH_CONFIG_MISSING }, { status: 500 });
    }
    return NextResponse.json({ error: AUTH_SERVICE_ERROR }, { status: 500 });
  }
}
