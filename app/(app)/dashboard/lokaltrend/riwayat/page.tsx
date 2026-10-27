import type { Metadata } from "next";
import { Module1HistoryScreen } from "@/components/dashboard/module1/history-screen";

export const metadata: Metadata = { title: "Riwayat LokalTrend Radar · Rintisin AI" };

export default function LokalTrendHistoryPage() {
  return <Module1HistoryScreen />;
}
