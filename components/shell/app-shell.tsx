"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleHelp, LogOut, Menu, X } from "lucide-react";
import { cn } from "cn";
import { BrandMark, Wordmark } from "@/components/shell/brand-mark";
import { NAV_GROUPS, activeHref, crumbsFor } from "@/components/shell/nav-config";
import { OnboardingTour, startOnboardingTourNow } from "@/components/shell/onboarding-tour";
import { LOGIN_PATH } from "@/lib/supabase/auth-guard";
import { DEMO_SESSION_COOKIE } from "@/lib/supabase/demo-auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function navTourId(href: string): string | undefined {
  if (href === "/dashboard") return "nav-beranda";
  if (href === "/dashboard/lokaltrend") return "nav-lokaltrend";
  if (href === "/dashboard/petasaingan") return "nav-petasaingan";
  return undefined;
}

/*
 * Shell: "Tinted frame, white sheet". Grid arithmetic at 1440:
 * 228 (sidebar) + 1204 (sheet) + 8 (inset) = 1440; sheet content = 1204 − 2 × 24 = 1156.
 * Below 1024px the frame disappears: a 48px top bar on the frame tint, the sheet is the screen.
 */
export function AppShell({
  children,
  userEmail = "",
}: {
  children: React.ReactNode;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const current = activeHref(pathname);
  const crumbs = crumbsFor(pathname);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setMenuOpen(false);
    try {
      document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0`;
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.push(LOGIN_PATH);
      router.refresh();
    }
  };

  const nav = (
    <nav aria-label="Navigasi utama" className="flex flex-col gap-6">
      {NAV_GROUPS.map((group, index) => (
        <div
          key={group.label ?? index}
          data-tour={group.label === "Riwayat" ? "nav-riwayat" : undefined}
          className="flex flex-col gap-0.5"
        >
          {group.label ? (
            <p className="mb-1.5 px-2.5 text-xs text-ink-muted">{group.label}</p>
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive = current === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-tour={navTourId(item.href)}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-2.5 rounded-md px-2.5 text-sm text-ink transition-colors lg:h-8",
                      isActive ? "bg-active" : "hover:bg-hover"
                    )}
                  >
                    <Icon className="size-4 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-ground lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:grid-rows-[var(--topbar-height)_minmax(0,1fr)]">
      {/* Sidebar, desktop */}
      <aside className="hidden lg:sticky lg:top-0 lg:row-span-2 lg:flex lg:h-dvh lg:flex-col lg:px-3 lg:pt-3 lg:pb-4">
        <Link href="/dashboard" className="mb-7 flex h-9 items-center rounded-md px-2.5">
          <Wordmark />
        </Link>
        {nav}
      </aside>

      {/* Top bar, desktop: the page's place and the account */}
      <header className="hidden lg:flex lg:h-12 lg:items-center lg:justify-between lg:pr-[calc(var(--sheet-inset)+16px)] lg:pl-6">
        <nav aria-label="Lokasi halaman">
          <ol className="flex items-center gap-2 text-sm text-ink-muted">
            {crumbs.map((crumb, i) => (
              <li key={crumb} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                <span className={i === crumbs.length - 1 ? "text-ink" : undefined}>{crumb}</span>
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={startOnboardingTourNow}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink transition-colors hover:bg-hover"
          >
            <CircleHelp className="size-4 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
            Panduan
          </button>
          {userEmail ? <span className="text-sm text-ink-muted">{userEmail}</span> : null}
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-ink transition-colors hover:bg-hover disabled:opacity-50"
          >
            <LogOut className="size-4 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
            {signingOut ? "Keluar…" : "Keluar"}
          </button>
        </div>
      </header>

      {/* Top bar, phone and tablet */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-ground px-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="menu-sheet"
          className="flex size-11 items-center justify-center rounded-md hover:bg-hover"
        >
          <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
          <span className="sr-only">Buka menu</span>
        </button>
        <span className="text-[15px] font-semibold">{crumbs[0]}</span>
        <Link href="/dashboard" className="flex size-11 items-center justify-center rounded-md" aria-label="Rintisin AI, ke Beranda">
          <BrandMark />
        </Link>
      </header>

      {menuOpen ? (
        <div
          id="menu-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-ground px-4 pb-6 lg:hidden"
        >
          <div className="flex h-12 items-center justify-between">
            <Wordmark />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex size-11 items-center justify-center rounded-md hover:bg-hover"
              autoFocus
            >
              <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
              <span className="sr-only">Tutup menu</span>
            </button>
          </div>
          <div className="mt-4">{nav}</div>
          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5">
            {userEmail ? <span className="px-2.5 text-sm text-ink-muted">{userEmail}</span> : null}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                startOnboardingTourNow();
              }}
              className="flex h-11 items-center gap-2.5 rounded-md px-2.5 text-sm text-ink hover:bg-hover"
            >
              <CircleHelp className="size-4 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
              Panduan fitur
            </button>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="flex h-11 items-center gap-2.5 rounded-md px-2.5 text-sm text-ink hover:bg-hover disabled:opacity-50"
            >
              <LogOut className="size-4 text-ink-muted" strokeWidth={1.5} aria-hidden="true" />
              {signingOut ? "Keluar…" : "Keluar"}
            </button>
          </div>
        </div>
      ) : null}

      <main
        id="konten"
        className="min-w-0 flex-1 bg-surface lg:mr-[var(--sheet-inset)] lg:mb-[var(--sheet-inset)] lg:rounded-2xl lg:border lg:border-border"
      >
        <div className="px-4 pt-5 pb-12 sm:px-6 lg:px-[var(--pad)] lg:pt-6">{children}</div>
      </main>
      <OnboardingTour userEmail={userEmail} />
    </div>
  );
}
