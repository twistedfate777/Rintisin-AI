import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Daftar · Rintisin AI" };

export default function DaftarPage() {
  return (
    <>
      <h1 className="text-title font-semibold text-ink">Buat akun</h1>
      <p className="mt-1 mb-6 text-sm text-ink-muted">
        Hasil analisis tersimpan di akun Anda dan hanya bisa dibuka oleh Anda.
      </p>
      <RegisterForm />
    </>
  );
}
