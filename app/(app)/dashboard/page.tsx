import type { Metadata } from "next";
import { HomeScreen } from "@/components/dashboard/home-screen";

export const metadata: Metadata = { title: "Beranda · Rintisin AI" };

export default function DashboardPage() {
  return <HomeScreen />;
}
