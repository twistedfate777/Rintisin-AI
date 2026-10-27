import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

/**
 * Hero: "Control that reads the page", set the way the brand's reference sets it. The headline is
 * heavy with its last phrase on a filled lime block; the ink of that phrase is the same ink as the
 * rest of the line, so the block is a field of colour and not a styled accent word. Beside it sits a
 * drawn picture of one LokalTrend Radar result (public/images/hero-lokaltrend.svg), built from the
 * app's own worked example so every figure on it adds up.
 *
 * Three claims sit under the sentence as a checked list. Each is a fact about the product, not a
 * statistic about customers.
 */

const CLAIMS = [
  "Margin dan HPP dihitung sistem, bukan dikarang model",
  "Kelemahan kompetitor dibaca dari ulasan publik Google Maps",
  "Asumsi Indonesia: ongkir, komisi marketplace, NIB dan PIRT",
];

const LINE = (index: number) => ({ "--i": index }) as React.CSSProperties;

export function Hero() {
  return (
    // The glow runs the full width of the screen; the content inside keeps the page's frame.
    <section
      className="overflow-hidden bg-radial from-background via-background to-muted/20 border-b border-border hero-glow"
      aria-labelledby="judul"
    >
      <div className="overflow-hidden h-full mx-auto w-full max-w-screen-xl px-4 md:pl-20 md:pr-14 pb-16 pt-12 lg:pt-24 lg:grid lg:grid-cols-12 lg:gap-8 lg:pb-24 relative">
        <div className="lg:col-span-6 lg:col-start-1">
          <h1 id="judul" className="display lines">
            <div
              data-line
              className="flex flex-col relative w-fit tracking-tight font-extrabold text-4xl sm:text-5xl lg:text-6xl lg:text-[4.05rem] flex gap-2  flex-wrap  "
            >
              <span>Kembangkan</span> Ide Mentah{" "}
              <div>
                <span
                  data-line
                  style={LINE(1)}
                  className="rounded-lg font-bold highlight"
                >
                  Jadi Produk Laku.
                </span>
              </div>
            </div>
          </h1>

          <p
            className="mt-6 text-base sm:text-lg lg:pr-6 max-w-prose text-center lg:text-left text-balance md:text-wrap text-muted-foreground leading-relaxed text-lg"
            data-load
            style={{ "--d": "420ms" } as React.CSSProperties}
          >
            Jangan pertaruhkan modal pada asumsi. Rintisin AI mengaudit margin,
            risiko operasional, dan kesiapan rilis ide produk Anda, lalu
            membedah celah kompetitor terdekat dari ulasan pelanggan mereka
            sendiri.
          </p>

          <ul
            className="mt-8 flex flex-col gap-3"
            data-load
            style={{ "--d": "480ms" } as React.CSSProperties}
          >
            {CLAIMS.map((claim) => (
              <li key={claim} className="flex items-start gap-3">
                <span className="check" aria-hidden="true">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className="max-w-[42ch]">{claim}</span>
              </li>
            ))}
          </ul>

          <div
            className="mt-10 flex flex-wrap items-center gap-3"
            data-load
            style={{ "--d": "540ms" } as React.CSSProperties}
          >
            <Link href="/daftar" className="action">
              Audit ide produk saya
            </Link>
            <Link
              href="/masuk"
              className="action action-quiet bg-white! !border !border-gray-300 hover:bg-gray-100!"
            >
              Masuk ke dashboard
            </Link>
          </div>
        </div>

        <div
          className="lg:col-span-6 lg:col-start-7 lg:justify-self-end"
          data-load
          style={{ "--d": "600ms" } as React.CSSProperties}
        >
          {/* A drawn picture of the product's own worked example, not a customer's data. */}
          <div className="hero-art w-full max-w-[500px]">
            <Image
              src="/images/hero-lokaltrend.svg"
              alt="Contoh hasil LokalTrend Radar untuk sambal bawang rendah kalori di Jakarta Selatan: modal awal Rp 15.000.000, balik modal di 883 unit, margin kotor 48,6 persen, status Layak dengan Catatan."
              width={600}
              height={700}
              priority
              unoptimized
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
