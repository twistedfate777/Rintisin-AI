"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeNextPath } from "@/lib/supabase/auth-guard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EMAIL_MAX, PASSWORD_MAX, validateAuthForm, type AuthFormField } from "@/lib/validation/auth-form";

// One message for an unknown email and a wrong password, so neither is revealed (Req 1.4).
export const LOGIN_FAILED = "Email atau kata sandi salah. Periksa kembali lalu coba lagi.";
export const AUTH_SERVICE_ERROR =
  "Layanan autentikasi sedang mengalami gangguan. Periksa koneksi Anda lalu coba lagi.";
export const REGISTER_FAILED =
  "Pendaftaran belum berhasil diproses. Periksa kembali email Anda atau gunakan email lain.";

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

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<AuthFormField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setFailure(null);
    const result = validateAuthForm({ email, password });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });

      if (error || !data.session) {
        setBusy(false);
        setPassword(""); // keep the email, clear the password (Req 1.4)
        const isCredentialError =
          !error ||
          error.status === 400 ||
          error.status === 401 ||
          error.code === "invalid_credentials";
        setFailure(isCredentialError ? LOGIN_FAILED : AUTH_SERVICE_ERROR);
        return;
      }

      router.push(safeNextPath(params.get("next")));
      router.refresh();
    } catch {
      setBusy(false);
      setPassword("");
      setFailure(AUTH_SERVICE_ERROR);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<AuthFormField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setFailure(null);
    const result = validateAuthForm({ email, password });
    if (!result.success) {
      // No account is created; the email stays as typed (Req 1.5).
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
      });

      if (error) {
        setBusy(false);
        setFailure(error.status && error.status >= 500 ? AUTH_SERVICE_ERROR : REGISTER_FAILED);
        return;
      }

      setBusy(false);
      setDone(true);
    } catch {
      setBusy(false);
      setFailure(AUTH_SERVICE_ERROR);
    }
  };

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="rounded-md bg-pill-positive-bg px-3 py-2 text-sm text-pill-positive-ink">
          Registrasi berhasil. Akun untuk <span className="font-medium">{email.trim()}</span> sudah dibuat.
        </p>
        <Link href="/masuk" className="text-sm font-medium text-brand hover:underline">
          Masuk ke akun Anda
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
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
