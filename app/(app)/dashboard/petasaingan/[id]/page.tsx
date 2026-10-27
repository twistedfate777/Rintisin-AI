import type { Metadata } from "next";
import { Suspense } from "react";
import { Module2DetailScreen } from "@/components/dashboard/module2/detail-screen";

export const metadata: Metadata = { title: "Detail analisis kompetitor · Rintisin AI" };

export default function PetaSainganDetailPage() {
  return (
    <Suspense fallback={<h1 className="text-title font-semibold">Detail analisis kompetitor</h1>}>
      <Module2DetailScreen />
    </Suspense>
  );
}
