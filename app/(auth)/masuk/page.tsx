import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Masuk · Rintisin AI" };

export default function MasukPage() {
  return (
    <>
      <h1 className="text-title font-semibold text-ink">Masuk</h1>
      <p className="mt-1 mb-6 text-sm text-ink-muted">Buka hasil analisis ide dan kompetitor Anda.</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </>
  );
}
