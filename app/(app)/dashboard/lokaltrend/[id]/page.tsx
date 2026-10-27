import type { Metadata } from "next";
import { Suspense } from "react";
import { Module1DetailScreen } from "@/components/dashboard/module1/detail-screen";

export const metadata: Metadata = { title: "Detail analisis ide · Rintisin AI" };

export default function LokalTrendDetailPage() {
  return (
    <Suspense fallback={<h1 className="text-title font-semibold">Detail analisis ide</h1>}>
      <Module1DetailScreen />
    </Suspense>
  );
}
