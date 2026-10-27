import Link from "next/link";
import { Check, MoveRight } from "lucide-react";
import {
  GtmFragment,
  HookFragment,
  MarginFragment,
  RadarFragment,
} from "@/components/landing/fragments";

const MODULE_1_OUTPUT = [
  "Estimasi HPP dan harga jual yang disarankan",
  "Margin kotor dan status kelayakan finansial",
  "Risiko operasional beserta mitigasinya",
  "Segmen pasar dan rencana aksi mingguan",
];

const MODULE_2_OUTPUT = [
  "Distribusi sentimen positif, netral, dan negatif",
  "Empat skor pengalaman pelanggan",
  "Keluhan pasar yang paling berulang",
  "Strategi operasional dan hook pemasaran",
];

function OutputList({ items }: { items: string[] }) {
  return (
    <div className="module-output">
      <p className="strong">Keputusan yang Anda dapat</p>
      <ul className="mt-5 flex flex-col gap-4">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <span className="module-check" aria-hidden="true">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModuleHeading({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="module-heading">
      <div>
        <h3 className="head">{title}</h3>
        <p className="mt-4 max-w-[54ch]">{description}</p>
      </div>
      <Link href={href} className="module-link">
        Buka modul
        <MoveRight className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </div>
  );
}

/**
 * Two independent product showcases. Each has one clear heading, an outcome list, and two real
 * interface fragments. The previews are never cropped: they use two columns only from tablet
 * widths upward and become a single readable column on phones.
 */
export function Features() {
  return (
    <section className="section" aria-labelledby="modul-judul" id="modul">
      <div className="frame">
        <div className="module-intro">
          <h2 id="modul-judul" className="head max-w-[18ch]" data-reveal>
            Dua mesin untuk dua fase bisnis
          </h2>
          <p className="max-w-[48ch]" data-reveal>
            Gunakan salah satunya tanpa bergantung pada modul lain. Mulai dari kelayakan ide, atau
            langsung bedah pengalaman pelanggan kompetitor di sekitar Anda.
          </p>
        </div>

        <div className="mt-14 flex flex-col gap-6 lg:mt-16 lg:gap-8">
          <article className="module-showcase" data-reveal>
            <ModuleHeading
              title="LokalTrend Radar"
              description="Untuk perintis yang belum produksi massal. Masukkan ide, modal awal, dan kota target untuk mengetahui apakah produknya layak diuji pasar."
              href="/dashboard/lokaltrend"
            />
            <div className="module-body">
              <OutputList items={MODULE_1_OUTPUT} />
              <div className="module-preview-grid">
                <MarginFragment />
                <GtmFragment />
              </div>
            </div>
          </article>

          <article
            className="module-showcase"
            data-reveal
            style={{ "--d": "100ms" } as React.CSSProperties}
          >
            <ModuleHeading
              title="PetaSaingan Ekraf"
              description="Untuk pemilik kedai dan toko fisik. Tempel hingga tiga tautan Google Maps untuk menemukan pola keluhan dan celah layanan kompetitor."
              href="/dashboard/petasaingan"
            />
            <div className="module-body module-body-reverse">
              <div className="module-preview-grid">
                <RadarFragment />
                <HookFragment />
              </div>
              <OutputList items={MODULE_2_OUTPUT} />
            </div>
          </article>
        </div>

        <div className="mt-10 flex justify-center" data-reveal>
          <Link href="/daftar" className="action">
            Mulai analisis gratis
          </Link>
        </div>
      </div>
    </section>
  );
}
