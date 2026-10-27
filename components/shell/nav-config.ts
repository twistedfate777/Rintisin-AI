import { FileClock, History, House, MapPinned, Radar, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Beranda", icon: House },
      { href: "/dashboard/lokaltrend", label: "LokalTrend Radar", icon: Radar },
      { href: "/dashboard/petasaingan", label: "PetaSaingan Ekraf", icon: MapPinned },
    ],
  },
  {
    label: "Riwayat",
    items: [
      { href: "/dashboard/lokaltrend/riwayat", label: "Ide produk", icon: FileClock },
      { href: "/dashboard/petasaingan/riwayat", label: "Analisis kompetitor", icon: History },
    ],
  },
];

/** The nav item that owns a path: the longest matching href wins. */
export function activeHref(pathname: string): string | null {
  const all = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
  const matches = all.filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  if (matches.length === 0) return null;
  // A detail page /lokaltrend/[id] belongs to the history list it is opened from.
  const best = matches.sort((a, b) => b.length - a.length)[0];
  if (best === "/dashboard/lokaltrend" && pathname !== best) return "/dashboard/lokaltrend/riwayat";
  if (best === "/dashboard/petasaingan" && pathname !== best) return "/dashboard/petasaingan/riwayat";
  return best;
}

/** Breadcrumb trail for the top bar. */
export function crumbsFor(pathname: string): string[] {
  if (pathname.startsWith("/dashboard/lokaltrend/riwayat")) return ["LokalTrend Radar", "Riwayat"];
  if (pathname.startsWith("/dashboard/lokaltrend/")) return ["LokalTrend Radar", "Riwayat", "Detail analisis"];
  if (pathname.startsWith("/dashboard/lokaltrend")) return ["LokalTrend Radar"];
  if (pathname.startsWith("/dashboard/petasaingan/riwayat")) return ["PetaSaingan Ekraf", "Riwayat"];
  if (pathname.startsWith("/dashboard/petasaingan/")) return ["PetaSaingan Ekraf", "Riwayat", "Detail analisis"];
  if (pathname.startsWith("/dashboard/petasaingan")) return ["PetaSaingan Ekraf"];
  return ["Beranda"];
}
