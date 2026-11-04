"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { triggerOnboardingTourOnNextLoad } from "@/components/shell/onboarding-tour";
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
} from "@/lib/supabase/auth-error-messages";
import { safeNextPath } from "@/lib/supabase/auth-guard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEMO_SESSION_COOKIE,
  DEMO_USER_EMAIL,
  DEMO_USER_PASSWORD,
  isDemoAccountEmail,
  normalizeDemoEmailInput,
} from "@/lib/supabase/demo-auth";
import { EMAIL_MAX, PASSWORD_MAX, validateAuthForm, type AuthFormField } from "@/lib/validation/auth-form";

export {
  AUTH_CONFIG_MISSING,
  AUTH_SERVICE_ERROR,
  LOGIN_EMAIL_NOT_CONFIRMED,
  LOGIN_FAILED,
  LOGIN_RATE_LIMITED,
  REGISTER_ALREADY_EXISTS,
  REGISTER_FAILED,
  REGISTER_INVALID_EMAIL,
  REGISTER_RATE_LIMITED,
  REGISTER_WEAK_PASSWORD,
};

function Field({
  id,
  label,
  error,
  hint,
  ...props
}: React.ComponentProps<"input"> & { id: string; label: string; error?: string; hint?: string }) {
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...props} />
      {error ? (
        <p id={`${id}-err`} className="text-[13px] text-negative">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function setBrowserDemoCookie() {
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_SESSION_COOKIE}=${encodeURIComponent(DEMO_USER_EMAIL)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  }
}

function DemoAccountCard({
  busy,
  onUseDemo,
  buttonLabel,
}: {
  busy: boolean;
  onUseDemo: () => void;
  buttonLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-ground p-3.5">
      <div className="flex flex-col gap-2.5">
        <div>
          <p className="text-[13px] font-medium text-ink">Akun demo siap pakai</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            Email: <span className="font-mono text-ink">{DEMO_USER_EMAIL}</span> (atau ketik{" "}
            <span className="font-mono text-ink">john</span>) · Sandi:{" "}
            <span className="font-mono text-ink">{DEMO_USER_PASSWORD}</span>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onUseDemo}
          className="w-full"
        >
          {busy ? "Memproses akun demo…" : buttonLabel}
        </Button>
      </div>
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<AuthFormField, string>>>({});
  const [failure, setFailure] = useState<string | null>(
    params.get("error") === "verification_failed"
      ? "Tautan verifikasi email tidak valid atau sudah kedaluwarsa. Silakan masuk atau daftar ulang."
      : null
  );
  const [busy, setBusy] = useState(false);

  const loginWithDemo = async () => {
    if (busy) return;
    setFailure(null);
    setErrors({});
    setEmail(DEMO_USER_EMAIL);
    setPassword(DEMO_USER_PASSWORD);
    setBusy(true);
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: DEMO_USER_EMAIL,
          password: DEMO_USER_PASSWORD,
          demo: true,
        }),
      });
    } catch {
      // Fallback to client-side demo cookie below.
    }
    setBrowserDemoCookie();
    triggerOnboardingTourOnNextLoad();
    router.push(safeNextPath(params.get("next")));
    router.refresh();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setFailure(null);

    const isDemo = isDemoAccountEmail(email);
    const normalizedEmail = normalizeDemoEmailInput(email);
    const effectivePassword = password.length === 0 && isDemo ? DEMO_USER_PASSWORD : password;

    const result = validateAuthForm({ email: normalizedEmail, password: effectivePassword });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);

    if (isDemo) {
      try {
        await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: DEMO_USER_EMAIL,
            password: effectivePassword,
            demo: true,
          }),
        });
      } catch {
        // Fallback to client-side demo cookie.
      }
      setBrowserDemoCookie();
      triggerOnboardingTourOnNextLoad();
      router.push(safeNextPath(params.get("next")));
      router.refresh();
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: result.data.email,
          password: result.data.password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: Partial<Record<AuthFormField, string>>;
      } | null;

      if (!response.ok || !payload?.ok) {
        setBusy(false);
        setPassword(""); // keep the email, clear the password (Req 1.4)
        if (payload?.fieldErrors) {
          setErrors(payload.fieldErrors);
        }
        setFailure(payload?.error || LOGIN_FAILED);
        return;
      }

      router.push(safeNextPath(params.get("next")));
      router.refresh();
    } catch {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: result.data.email,
          password: result.data.password,
        });

        if (error || !data.session) {
          setBusy(false);
          setPassword(""); // keep the email, clear the password (Req 1.4)
          setFailure(formatLoginErrorMessage(error));
          return;
        }

        router.push(safeNextPath(params.get("next")));
        router.refresh();
      } catch (err) {
        setBusy(false);
        setPassword("");
        const msg = err instanceof Error ? err.message : "";
        setFailure(
          msg.toLowerCase().includes("konfigurasi") || msg.toLowerCase().includes("apikey")
            ? AUTH_CONFIG_MISSING
            : AUTH_SERVICE_ERROR
        );
      }
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DemoAccountCard
        busy={busy}
        onUseDemo={loginWithDemo}
        buttonLabel="Masuk langsung sebagai John (Demo)"
      />
      {failure ? (
        <p role="alert" className="rounded-md bg-pill-negative-bg px-3 py-2 text-[13px] text-pill-negative-ink">
          {failure}
        </p>
      ) : null}
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        maxLength={EMAIL_MAX + 10}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <Field
        id="password"
        label="Kata sandi"
        type="password"
        autoComplete="current-password"
        maxLength={PASSWORD_MAX + 10}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />
      <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
        {busy ? "Sedang masuk…" : "Masuk"}
      </Button>
      <p className="text-sm text-ink-muted">
        Belum punya akun?{" "}
        <Link href="/daftar" className="font-medium text-brand hover:underline">
          Daftar
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<AuthFormField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const registerWithDemo = async () => {
    if (busy) return;
    setFailure(null);
    setErrors({});
    setEmail(DEMO_USER_EMAIL);
    setPassword(DEMO_USER_PASSWORD);
    setBusy(true);
    try {
      await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: DEMO_USER_EMAIL,
          password: DEMO_USER_PASSWORD,
          demo: true,
        }),
      });
    } catch {
      // Fallback to client-side demo cookie.
    }
    setBrowserDemoCookie();
    triggerOnboardingTourOnNextLoad();
    router.push("/dashboard");
    router.refresh();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setFailure(null);

    const isDemo = isDemoAccountEmail(email);
    const normalizedEmail = normalizeDemoEmailInput(email);
    const effectivePassword = password.length === 0 && isDemo ? DEMO_USER_PASSWORD : password;

    const result = validateAuthForm({ email: normalizedEmail, password: effectivePassword });
    if (!result.success) {
      // No account is created; the email stays as typed (Req 1.5).
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);

    if (isDemo) {
      try {
        await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: DEMO_USER_EMAIL,
            password: effectivePassword,
            demo: true,
          }),
        });
      } catch {
        // Fallback to client-side demo cookie.
      }
      setBrowserDemoCookie();
      triggerOnboardingTourOnNextLoad();
      router.push("/dashboard");
      router.refresh();
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: result.data.email,
          password: result.data.password,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        requiresEmailConfirmation?: boolean;
        fieldErrors?: Partial<Record<AuthFormField, string>>;
      } | null;

      if (!response.ok || !payload?.ok) {
        setBusy(false);
        if (payload?.fieldErrors) {
          setErrors(payload.fieldErrors);
        }
        setFailure(payload?.error || REGISTER_FAILED);
        return;
      }

      setBusy(false);
      triggerOnboardingTourOnNextLoad();
      setNeedsEmailConfirmation(Boolean(payload.requiresEmailConfirmation));
      setDone(true);
    } catch {
      try {
        const supabase = createSupabaseBrowserClient();
        const emailRedirectTo =
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
        const { data, error } = await supabase.auth.signUp({
          email: result.data.email,
          password: result.data.password,
          options: emailRedirectTo ? { emailRedirectTo } : undefined,
        });

        if (error) {
          setBusy(false);
          setFailure(formatRegisterErrorMessage(error));
          return;
        }

        setBusy(false);
        triggerOnboardingTourOnNextLoad();
        setNeedsEmailConfirmation(!data.session);
        setDone(true);
      } catch (err) {
        setBusy(false);
        const msg = err instanceof Error ? err.message : "";
        setFailure(
          msg.toLowerCase().includes("konfigurasi") || msg.toLowerCase().includes("apikey")
            ? AUTH_CONFIG_MISSING
            : AUTH_SERVICE_ERROR
        );
      }
    }
  };

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <div className="rounded-md bg-pill-positive-bg px-3 py-2.5 text-sm text-pill-positive-ink">
          <p>
            Registrasi berhasil. Akun untuk <span className="font-medium">{email.trim()}</span> sudah dibuat.
          </p>
          {needsEmailConfirmation ? (
            <p className="mt-1 text-[13px] opacity-90">
              Silakan periksa kotak masuk atau folder spam email Anda untuk mengklik tautan verifikasi sebelum masuk.
            </p>
          ) : (
            <p className="mt-1 text-[13px] opacity-90">
              Akun Anda sudah aktif dan siap digunakan.
            </p>
          )}
        </div>
        <Link href="/masuk" className="text-sm font-medium text-brand hover:underline">
          Masuk ke akun Anda
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DemoAccountCard
        busy={busy}
        onUseDemo={registerWithDemo}
        buttonLabel="Gunakan akun demo John (Langsung Aktif)"
      />
      {failure ? (
        <p role="alert" className="rounded-md bg-pill-negative-bg px-3 py-2 text-[13px] text-pill-negative-ink">
          {failure}
        </p>
      ) : null}
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <Field
        id="password"
        label="Kata sandi"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        hint="8–72 karakter."
      />
      <Button type="submit" size="lg" disabled={busy} className="mt-1 w-full">
        {busy ? "Sedang mendaftarkan…" : "Daftar"}
      </Button>
      <p className="text-sm text-ink-muted">
        Sudah punya akun?{" "}
        <Link href="/masuk" className="font-medium text-brand hover:underline">
          Masuk
        </Link>
      </p>
    </form>
  );
}
