import Link from "next/link";
import { Wordmark } from "@/components/shell/brand-mark";

const SECTIONS: { label: string; href: string }[] = [
  { label: "Cara kerja", href: "#cara-kerja" },
  { label: "Dua modul", href: "#modul" },
  { label: "Tanya jawab", href: "#sebelum-mulai" },
];

/**
 * The bar: wordmark, three plain links, one action. It sits on the page's own ground with a tone
 * step instead of a rule or a shadow, and it is sticky so the action stays reachable. No blur, no
 * floating pill, no chrome.
 */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 bg-ground">
      <div className="frame flex h-[72px] items-center justify-between gap-6">
        <Link href="/" aria-label="Rintisin AI, ke beranda">
          <Wordmark />
        </Link>

        <nav aria-label="Bagian halaman" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {SECTIONS.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="plain-link text-[15px]">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-5">
          <Link href="/masuk" className="plain-link hidden text-[15px] sm:inline">
            Masuk
          </Link>
          <Link href="/daftar" className="action action-sm">
            Coba gratis
          </Link>
        </div>
      </div>
    </header>
  );
}
