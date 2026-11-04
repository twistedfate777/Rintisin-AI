import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { LOGIN_PATH } from "@/lib/supabase/auth-guard";
import {
  DEMO_SESSION_COOKIE,
  DEMO_USER_EMAIL,
  isValidDemoCookie,
} from "@/lib/supabase/demo-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function AuthenticatedDashboardShell({ children }: { children: React.ReactNode }) {
  await connection();
  const cookieStore = await cookies();
  const demoCookie = cookieStore.get(DEMO_SESSION_COOKIE)?.value;
  const isDemo = isValidDemoCookie(demoCookie);

  let userEmail = isDemo ? DEMO_USER_EMAIL : "";
  if (!userEmail) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        userEmail = user.email ?? "";
      }
    } catch (err) {
      unstable_rethrow(err);
    }
  }

  if (!userEmail) {
    redirect(LOGIN_PATH);
  }

  return <AppShell userEmail={userEmail}>{children}</AppShell>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AuthenticatedDashboardShell>{children}</AuthenticatedDashboardShell>
    </Suspense>
  );
}
