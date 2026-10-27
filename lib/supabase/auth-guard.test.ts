import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DEFAULT_DASHBOARD_PATH,
  buildLoginRedirectPath,
  isProtectedDashboardPath,
  safeNextPath,
} from "@/lib/supabase/auth-guard";

describe("isProtectedDashboardPath", () => {
  it("protects /dashboard and all nested Modul_1 and Modul_2 routes (Req 1.2)", () => {
    expect(isProtectedDashboardPath("/dashboard")).toBe(true);
    expect(isProtectedDashboardPath("/dashboard/lokaltrend")).toBe(true);
    expect(isProtectedDashboardPath("/dashboard/lokaltrend/riwayat")).toBe(true);
    expect(isProtectedDashboardPath("/dashboard/lokaltrend/lt-7f3a21")).toBe(true);
    expect(isProtectedDashboardPath("/dashboard/petasaingan")).toBe(true);
    expect(isProtectedDashboardPath("/dashboard/petasaingan/riwayat")).toBe(true);
    expect(isProtectedDashboardPath("/dashboard/petasaingan/ps-91d4b7")).toBe(true);
  });

  it("leaves marketing and auth routes public", () => {
    expect(isProtectedDashboardPath("/")).toBe(false);
    expect(isProtectedDashboardPath("/masuk")).toBe(false);
    expect(isProtectedDashboardPath("/daftar")).toBe(false);
    expect(isProtectedDashboardPath("/dashboard-other")).toBe(false);
  });
});

describe("buildLoginRedirectPath & safeNextPath", () => {
  it("preserves the requested dashboard path and query parameters across login redirect (Req 1.2, 1.6)", () => {
    const redirectPath = buildLoginRedirectPath("/dashboard/lokaltrend", "?state=selesai");
    expect(redirectPath).toBe("/masuk?next=%2Fdashboard%2Flokaltrend%3Fstate%3Dselesai");

    const params = new URLSearchParams(redirectPath.split("?")[1]);
    expect(safeNextPath(params.get("next"))).toBe("/dashboard/lokaltrend?state=selesai");
  });

  it("falls back to /dashboard for missing or external redirect targets (Req 1.6)", () => {
    expect(safeNextPath(null)).toBe(DEFAULT_DASHBOARD_PATH);
    expect(safeNextPath("")).toBe(DEFAULT_DASHBOARD_PATH);
    expect(safeNextPath("https://evil.example/dashboard")).toBe(DEFAULT_DASHBOARD_PATH);
    expect(safeNextPath("//evil.example/dashboard")).toBe(DEFAULT_DASHBOARD_PATH);
    expect(safeNextPath("/dashboard\\@evil.example")).toBe(DEFAULT_DASHBOARD_PATH);
    expect(safeNextPath("/masuk")).toBe(DEFAULT_DASHBOARD_PATH);
  });

  it("round-trips any valid /dashboard subpath through buildLoginRedirectPath -> safeNextPath (property)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "/dashboard",
          "/dashboard/lokaltrend",
          "/dashboard/lokaltrend/riwayat",
          "/dashboard/petasaingan",
          "/dashboard/petasaingan/riwayat"
        ),
        (path) => {
          const loginUrl = buildLoginRedirectPath(path);
          const nextParam = new URLSearchParams(loginUrl.slice("/masuk?".length)).get("next");
          expect(safeNextPath(nextParam)).toBe(path);
        }
      )
    );
  });
});
