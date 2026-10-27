import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./landing.css";

// Archivo is the dealt display and text face for the public page only. The app screens keep
// IBM Plex Sans, which the root layout loads.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  // 700 is the brand's own headline weight, from its reference; the dealt system's 400 and 600 do
  // the rest of the work.
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rintisin AI — Uji kelayakan ide produk UMKM sebelum produksi",
  description:
    "Rintisin AI mengaudit margin, risiko operasional, dan celah kompetitor untuk UMKM ekonomi kreatif Indonesia. Hitung margin kotor langsung di halaman ini.",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="lime" className={`${archivo.variable} landing`}>
      {/* Motion is gated on this class, so nothing is ever hidden when script does not run. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      <a
        href="#utama"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
      >
        Lewati ke konten utama
      </a>
      {children}
    </div>
  );
}
