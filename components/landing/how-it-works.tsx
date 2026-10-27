"use client";

import { useState } from "react";
import { RunFragment, type RunStage } from "@/components/landing/fragments";

const STEPS: { stage: RunStage; statement: string; support: string; detail: string[] }[] = [
  {
    stage: "isi",
    statement: "Isi formulir terstruktur",
    support: "Empat kolom, bukan esai panjang.",
    detail: ["Draf ide produk", "Kategori ekraf", "Estimasi modal awal", "Kota target pasar"],
  },
  {
    stage: "audit",
    statement: "AI mengaudit dengan asumsi Indonesia",
    support: "Dua panggilan berantai, supaya hasil tidak terpotong.",
    detail: [
      "Ongkir dan ekspedisi lokal",
      "Daya beli kota target",
      "Komisi marketplace dan ojek online",
      "Perizinan NIB, PIRT, dan Halal",
    ],
  },
  {
    stage: "hasil",
    statement: "Dashboard siap ditindaklanjuti",
    support: "Angka kunci dihitung sistem, bukan dikarang model.",
    detail: [
      "Margin dan status kelayakan",
      "Risiko dengan mitigasinya",
      "Segmen pasar dan UVP",
      "Rencana aksi berurutan",
    ],
  },
];

/**
 * How it works. The dealt blueprint pins the fragment beside three statements in blocks 80vh tall;
 * that left a column of empty ground beside every statement, so the section is rebuilt dense: the
 * three steps are a row of panels that select the stage, and the real fragment answers beneath them
 * at full width. Nothing scrolls past an empty half-screen, and the fragment is still one piece of
 * the real interface changing state, not three pictures.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);

  return (
    <section className="section" aria-labelledby="cara-kerja-judul" id="cara-kerja">
      <div className="frame">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 id="cara-kerja-judul" className="head max-w-[20ch]" data-reveal>
            Dari satu formulir ke rencana aksi
          </h2>
          <p className="max-w-[38ch] text-ink" data-reveal>
            Tiga langkah, dan Anda bisa melihat apa yang terjadi di setiap langkah.
          </p>
        </div>

        <ol className="mt-12 grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-3" data-reveal>
          {STEPS.map((step, index) => (
            <li key={step.stage}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-pressed={index === active}
                className="step-card"
              >
                <span className="step-mark" aria-hidden="true">
                  {index === active ? <span className="step-dot" /> : null}
                </span>
                <span className="lead block max-w-[20ch]">{step.statement}</span>
                <span className="small mt-2 block text-ink-muted">{step.support}</span>
                <span className="mt-5 block">
                  {step.detail.map((line) => (
                    <span key={line} className="step-detail">
                      {line}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-2" data-reveal style={{ "--d": "120ms" } as React.CSSProperties}>
          <RunFragment stage={STEPS[active].stage} />
        </div>
      </div>
    </section>
  );
}
