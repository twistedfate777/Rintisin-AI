import Link from "next/link";
import { LocalTime } from "@/components/landing/local-time";

const LINKS: { label: string; href: string }[] = [
  { label: "Masuk", href: "/masuk" },
  { label: "Daftar", href: "/daftar" },
  { label: "LokalTrend Radar", href: "/dashboard/lokaltrend" },
  { label: "PetaSaingan Ekraf", href: "/dashboard/petasaingan" },
];

const CONTACT = "halo@rintisin.id";

/**
 * footer — "A footer of tiles". The last two rows of a board: filled tiles, 8px gaps, every cell
 * used. The name returns at full width on the ink tile; the accent tile is one link.
 *
 * There are no picture credits here any more: the page carries no photographs, and its imagery is
 * the product's own interface fragments.
 */
export function SiteFooter() {
  return (
    <footer className="tiles" aria-labelledby="footer-judul">
      <h2 id="footer-judul" className="sr-only">
        Tentang situs ini
      </h2>

      <div className="tile tile-wide min-h-[220px] lg:col-span-4">
        <p className="lead max-w-[26ch]">
          Rintisin AI membaca angka dan ulasan yang sudah ada, lalu menyerahkan keputusannya kepada
          Anda.
        </p>
        <p className="small mt-8 text-ink-muted">
          Versi demo: seluruh hasil analisis di aplikasi ini adalah data contoh. Hasil AI adalah
          estimasi untuk diuji, bukan nasihat keuangan.
        </p>
      </div>

      <nav className="tile min-h-[220px] lg:col-span-3" aria-label="Tautan situs">
        <ul className="flex flex-col gap-2">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="plain-link">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="small text-ink-muted">Bahasa Indonesia</p>
      </nav>

      <div className="tile min-h-[220px] lg:col-span-2">
        <p className="small text-ink-muted">Jakarta</p>
        <LocalTime />
      </div>

      <div className="tile min-h-[220px] lg:col-span-3">
        <p className="small text-ink-muted">Pertanyaan</p>
        <a href={`mailto:${CONTACT}`} className="plain-link lead break-all">
          {CONTACT}
        </a>
      </div>

      {/* Lower row: the name at full width, then the accent tile as one link. */}
      <div className="tile tile-ink tile-wide min-h-[160px] items-center justify-center lg:col-span-8 lg:min-h-[320px]">
        <p className="w-full text-center text-[clamp(2.5rem,9vw,8rem)] leading-none tracking-[-0.03em]">
          Rintisin AI
        </p>
      </div>

      <Link
        href="/daftar"
        className="tile tile-accent tile-wide group min-h-[160px] no-underline lg:col-span-4 lg:min-h-[320px]"
      >
        <span className="lead">Mulai audit ide</span>
        <span className="flex justify-end">
          <svg
            viewBox="0 0 48 48"
            className="h-10 w-10 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M8 24h32M26 10l14 14-14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="square"
            />
          </svg>
        </span>
      </Link>
    </footer>
  );
}
