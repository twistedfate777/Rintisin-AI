import type { Metadata } from "next";
import { Suspense } from "react";
import { PetaSainganScreen } from "@/components/dashboard/module2/petasaingan-screen";

export const metadata: Metadata = { title: "PetaSaingan Ekraf · Rintisin AI" };

export default function PetaSainganPage() {
  return (
    <Suspense fallback={<h1 className="text-title font-semibold">PetaSaingan Ekraf</h1>}>
      <PetaSainganScreen />
    </Suspense>
  );
}
