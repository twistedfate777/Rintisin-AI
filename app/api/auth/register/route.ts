import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  AUTH_CONFIG_MISSING,
  AUTH_SERVICE_ERROR,
  formatRegisterErrorMessage,
} from "@/lib/supabase/auth-error-messages";
import {
  DEMO_SESSION_COOKIE,
  DEMO_USER_EMAIL,
  DEMO_USER_PASSWORD,
  isDemoAccountEmail,
  normalizeDemoEmailInput,
} from "@/lib/supabase/demo-auth";
import { createSupabaseFetch, getSupabaseConfig } from "@/lib/supabase/env";
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

function getOptionalAdminClient() {
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!rawServiceKey) return null;
  try {
    const { url } = getSupabaseConfig();
    return createClient(url, rawServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: createSupabaseFetch(url, rawServiceKey),
        headers: {
          apikey: rawServiceKey,
        },
      },
    });
  } catch {
    return null;
  }
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
    return attachDemoCookie(
      NextResponse.json({
        ok: true,
        demo: true,
        email: DEMO_USER_EMAIL,
        hasSession: true,
        requiresEmailConfirmation: false,
      })
    );
  }

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: AUTH_CONFIG_MISSING }, { status: 500 });
  }

  try {
    const origin = new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      // If standard signUp hits email rate-limit or key format issues on free tier and admin client is available,
      // create the confirmed user directly via Admin API.
      const admin = getOptionalAdminClient();
      if (admin) {
        const { error: adminError } = await admin.auth.admin.createUser({
          email: validation.data.email,
          password: validation.data.password,
          email_confirm: true,
        });
        if (!adminError) {
          return NextResponse.json({
            ok: true,
            hasSession: false,
            requiresEmailConfirmation: false,
          });
        }
        return NextResponse.json(
          { error: formatRegisterErrorMessage(adminError) },
          { status: adminError.status && adminError.status >= 400 ? adminError.status : 400 }
        );
      }

      return NextResponse.json(
        { error: formatRegisterErrorMessage(error) },
        { status: error.status && error.status >= 400 ? error.status : 400 }
      );
    }

    // Supabase returns an obfuscated user with empty identities array when the email is already registered
    // and Confirm Email is enabled.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return NextResponse.json(
        {
          error: formatRegisterErrorMessage({
            code: "user_already_exists",
            message: "User already registered",
          }),
        },
        { status: 409 }
      );
    }

    let requiresEmailConfirmation = !data.session;
    if (data.user && !data.session) {
      const admin = getOptionalAdminClient();
      if (admin) {
        const { error: confirmError } = await admin.auth.admin.updateUserById(data.user.id, {
          email_confirm: true,
        });
        if (!confirmError) {
          requiresEmailConfirmation = false;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      hasSession: Boolean(data.session),
      requiresEmailConfirmation,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.toLowerCase().includes("apikey") || msg.toLowerCase().includes("no api key")) {
      return NextResponse.json({ error: AUTH_CONFIG_MISSING }, { status: 500 });
    }
    return NextResponse.json({ error: AUTH_SERVICE_ERROR }, { status: 500 });
  }
}
