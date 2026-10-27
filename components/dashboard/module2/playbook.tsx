"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { EmptyState } from "@/components/dashboard/common";
import { Button } from "@/components/ui/button";
import type { PlaybookItem } from "@/lib/types";

const COPIED_MS = 2000;

function CopyHookButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      // Exactly the hook: no label, no extra text (Req 23.2).
      await navigator.clipboard.writeText(text);
      setState("copied");
      // 2 seconds from the latest press (Req 23.3).
      timer.current = setTimeout(() => setState("idle"), COPIED_MS);
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button variant="outline" size="sm" onClick={copy} aria-live="polite">
        {state === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {state === "copied" ? "Tersalin" : "Salin hook"}
      </Button>
      {state === "error" ? (
        <p role="alert" className="text-[13px] text-negative">
          Teks gagal disalin. Izinkan akses clipboard di browser, atau blok dan salin teksnya secara manual.
        </p>
      ) : null}
    </div>
  );
}

export function Playbook({ items }: { items: PlaybookItem[] }) {
  if (items.length === 0) {
    return <EmptyState>Belum ada strategi yang bisa disusun dari kelemahan kompetitor pada analisis ini.</EmptyState>;
  }
  return (
    <ul className={`grid grid-cols-1 gap-[var(--gap)] md:grid-cols-2 ${items.length >= 3 ? "xl:grid-cols-3" : ""}`}>
      {items.map((item, i) => (
        <li key={`${item.target_weakness}-${i}`} className="flex flex-col gap-4 rounded-xl border border-border p-5">
          <div>
            <h3 className="text-[13px] text-ink-muted">Kelemahan yang disasar</h3>
            <p className="mt-1 text-sm font-semibold text-ink">{item.target_weakness}</p>
          </div>
          <div>
            <h3 className="text-[13px] text-ink-muted">Strategi operasional</h3>
            <p className="mt-1 text-sm text-ink">{item.actionable_strategy}</p>
          </div>
          <div className="mt-auto rounded-md bg-raised p-3">
            <h3 className="text-[13px] text-ink-muted">Hook pemasaran</h3>
            <p className="mt-1 mb-3 text-[15px] leading-6 font-medium text-ink">{item.marketing_hook}</p>
            <CopyHookButton text={item.marketing_hook} />
          </div>
        </li>
      ))}
    </ul>
  );
}
