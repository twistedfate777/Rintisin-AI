import type { Metadata } from "next";
import { Suspense } from "react";
import { LokalTrendScreen } from "@/components/dashboard/module1/lokaltrend-screen";

export const metadata: Metadata = { title: "LokalTrend Radar · Rintisin AI" };

export default function LokalTrendPage() {
  return (
    <Suspense fallback={<h1 className="text-title font-semibold">LokalTrend Radar</h1>}>
      <LokalTrendScreen />
    </Suspense>
  );
}
