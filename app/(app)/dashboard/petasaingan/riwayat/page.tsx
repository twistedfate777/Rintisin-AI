import type { Metadata } from "next";
import { Module2HistoryScreen } from "@/components/dashboard/module2/history-screen";

export const metadata: Metadata = { title: "Riwayat PetaSaingan Ekraf · Rintisin AI" };

export default function PetaSainganHistoryPage() {
  return <Module2HistoryScreen />;
}
