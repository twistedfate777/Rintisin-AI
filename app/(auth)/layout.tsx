import Link from "next/link";
import { Wordmark } from "@/components/shell/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-ground px-4 py-10 sm:py-16">
      <div className="w-full max-w-[400px]">
        <Link href="/masuk" className="mb-8 inline-flex">
          <Wordmark />
        </Link>
        <main className="rounded-2xl border border-border bg-surface p-6 sm:p-8">{children}</main>
        <p className="mt-6 text-[13px] text-ink-muted">
          Konsultan bisnis AI untuk UMKM kuliner, fashion, kriya, dan beauty di Indonesia.
        </p>
      </div>
    </div>
  );
}
