"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

export const TOUR_TRIGGER_STORAGE_KEY = "rintisin_trigger_onboarding_tour";
export const TOUR_SEEN_STORAGE_PREFIX = "rintisin_onboarding_seen:";
export const TOUR_START_EVENT = "rintisin:start-onboarding-tour";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  /** Primary selector (e.g. desktop sidebar item) */
  selector: string;
  /** Fallback selector when primary is hidden on mobile/tablet */
  fallbackSelector?: string;
}

export const ONBOARDING_TOUR_STEPS: TourStep[] = [
  {
    id: "beranda",
    title: "Pantau seluruh riset bisnis di Beranda",
    description:
      "Halaman Beranda merangkum hasil validasi ide terakhir, celah pasar kompetitor terlebar, serta riwayat analisis terbaru Anda dalam satu layar.",
    selector: '[data-tour="nav-beranda"]',
    fallbackSelector: '[data-tour="checklist-onboarding"]',
  },
  {
    id: "lokaltrend",
    title: "Validasi ide produk di LokalTrend Radar",
    description:
      "Isi draf ide produk, pilih kategori (Kuliner, Fashion, Kriya, atau Beauty), modal awal, dan kota target. AI akan mengaudit estimasi HPP, margin kotor, risiko operasional, hingga langkah Go-To-Market.",
    selector: '[data-tour="nav-lokaltrend"]',
    fallbackSelector: '[data-tour="card-lokaltrend"]',
  },
  {
    id: "petasaingan",
    title: "Bedah celah kompetitor lewat PetaSaingan Ekraf",
    description:
      "Masukkan 1–3 URL Google Maps kompetitor lokal Anda. Sistem membedah ulasan pelanggan mereka untuk memetakan skor kualitas, harga, layanan, fasilitas, serta strategi merebut pasar.",
    selector: '[data-tour="nav-petasaingan"]',
    fallbackSelector: '[data-tour="card-petasaingan"]',
  },
  {
    id: "riwayat",
    title: "Simpan & buka ulang laporan di Riwayat",
    description:
      "Setiap analisis ide maupun kompetitor tersimpan otomatis di menu Riwayat. Membuka kembali laporan lama tidak akan memotong kuota AI Anda.",
    selector: '[data-tour="nav-riwayat"]',
    fallbackSelector: '[data-tour="card-riwayat"]',
  },
];

export function triggerOnboardingTourOnNextLoad() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(TOUR_TRIGGER_STORAGE_KEY, "1");
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(TOUR_SEEN_STORAGE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

export function startOnboardingTourNow() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  placement: "right" | "bottom";
}

function findVisibleElement(step: TourStep): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const candidates = [step.selector, step.fallbackSelector].filter(Boolean) as string[];
  for (const sel of candidates) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return null;
}

export function OnboardingTour({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const seenKey = `${TOUR_SEEN_STORAGE_PREFIX}${(userEmail || "guest").toLowerCase()}`;
  const currentStep = ONBOARDING_TOUR_STEPS[stepIndex] ?? ONBOARDING_TOUR_STEPS[0];

  const measureTarget = useCallback((step: TourStep) => {
    const el = findVisibleElement(step);
    if (!el) {
      setTargetRect(null);
      return;
    }

    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    const rect = el.getBoundingClientRect();
    const isSidebarTarget = rect.left < 260 && rect.width <= 260 && window.innerWidth >= 1024;

    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      placement: isSidebarTarget ? "right" : "bottom",
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let shouldOpen = false;
    try {
      const triggered = window.sessionStorage.getItem(TOUR_TRIGGER_STORAGE_KEY);
      const alreadySeen = window.localStorage.getItem(seenKey);
      if (triggered === "1" || !alreadySeen) {
        shouldOpen = true;
      }
    } catch {
      shouldOpen = false;
    }

    if (shouldOpen) {
      const timer = window.setTimeout(() => {
        setStepIndex(0);
        setOpen(true);
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [seenKey, pathname]);

  useEffect(() => {
    const handleStart = () => {
      setStepIndex(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_START_EVENT, handleStart);
    return () => window.removeEventListener(TOUR_START_EVENT, handleStart);
  }, []);

  useEffect(() => {
    if (!open) return;
    const rafId = window.requestAnimationFrame(() => measureTarget(currentStep));

    const onLayoutChange = () => measureTarget(currentStep);
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, currentStep, measureTarget]);

  const finishTour = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(seenKey, "1");
      window.sessionStorage.removeItem(TOUR_TRIGGER_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, [seenKey]);

  const nextStep = useCallback(() => {
    if (stepIndex < ONBOARDING_TOUR_STEPS.length - 1) {
      setStepIndex((prev) => prev + 1);
    } else {
      finishTour();
    }
  }, [stepIndex, finishTour]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        finishTour();
      } else if (event.key === "ArrowRight") {
        nextStep();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, finishTour, nextStep]);

  if (!open) return null;

  const isLastStep = stepIndex === ONBOARDING_TOUR_STEPS.length - 1;
  const pad = 6;

  // Compute popover position based on targetRect
  const popoverWidth = 320;
  let popoverStyle: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };
  let arrowSide: "left" | "top" | null = null;
  let arrowOffset = 24;

  if (targetRect && typeof window !== "undefined") {
    if (targetRect.placement === "right") {
      const desiredTop = Math.max(16, Math.min(window.innerHeight - 250, targetRect.top - 12));
      const desiredLeft = targetRect.left + targetRect.width + pad + 16;
      const targetCenterY = targetRect.top + targetRect.height / 2;
      arrowOffset = Math.max(20, Math.min(180, targetCenterY - desiredTop));
      popoverStyle = {
        top: `${desiredTop}px`,
        left: `${desiredLeft}px`,
      };
      arrowSide = "left";
    } else {
      const desiredTop = Math.min(
        window.innerHeight - 240,
        targetRect.top + targetRect.height + pad + 14
      );
      const desiredLeft = Math.max(
        16,
        Math.min(window.innerWidth - popoverWidth - 16, targetRect.left)
      );
      arrowOffset = Math.max(24, Math.min(popoverWidth - 32, targetRect.left - desiredLeft + 32));
      popoverStyle = {
        top: `${Math.max(16, desiredTop)}px`,
        left: `${desiredLeft}px`,
      };
      arrowSide = "top";
    }
  }

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      aria-describedby="onboarding-tour-desc"
    >
      {/* Clickable backdrop when no target is highlighted */}
      {!targetRect ? (
        <div
          className="fixed inset-0 bg-[#121410]/45 transition-opacity"
          onClick={finishTour}
          aria-hidden="true"
        />
      ) : (
        <>
          {/* Spotlight cutout with outer dark overlay */}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed rounded-xl transition-all duration-200"
            style={{
              top: `${targetRect.top - pad}px`,
              left: `${targetRect.left - pad}px`,
              width: `${targetRect.width + pad * 2}px`,
              height: `${targetRect.height + pad * 2}px`,
              boxShadow:
                "0 0 0 9999px rgba(18, 20, 16, 0.42), 0 0 24px 6px rgba(255, 255, 255, 0.75)",
              border: "2px solid #ffffff",
              background: "rgba(255, 255, 255, 0.14)",
            }}
          />
          {/* Click absorber outside popover */}
          <div className="fixed inset-0" onClick={finishTour} aria-hidden="true" />
        </>
      )}

      {/* Floating Tour Popover Card */}
      <div
        style={{ ...popoverStyle, width: `min(${popoverWidth}px, calc(100vw - 32px))` }}
        className="fixed z-10 rounded-2xl bg-surface p-5 text-ink shadow-[0_20px_50px_rgba(18,20,16,0.28)] ring-1 ring-border transition-all duration-200"
      >
        {/* Pointer arrow matching the Brevo callout */}
        {arrowSide === "left" ? (
          <span
            aria-hidden="true"
            style={{ top: `${arrowOffset - 8}px` }}
            className="
              absolute -left-2 size-4 rotate-45 bg-surface
              border-b border-l border-border
            "
          />
        ) : null}
        {arrowSide === "top" ? (
          <span
            aria-hidden="true"
            style={{ left: `${arrowOffset - 8}px` }}
            className="
              absolute -top-2 size-4 rotate-45 bg-surface
              border-t border-l border-border
            "
          />
        ) : null}

        <button
          type="button"
          onClick={finishTour}
          aria-label="Tutup panduan"
          className="absolute top-3.5 right-3.5 flex size-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>

        <p className="text-[11px] font-medium tracking-wide text-brand uppercase">
          Langkah {stepIndex + 1} dari {ONBOARDING_TOUR_STEPS.length}
        </p>
        <h2
          id="onboarding-tour-title"
          className="mt-1 pr-6 text-[16px] leading-[22px] font-semibold text-ink"
        >
          {currentStep.title}
        </h2>
        <p
          id="onboarding-tour-desc"
          className="mt-2 text-[13px] leading-[19px] text-ink-muted"
        >
          {currentStep.description}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finishTour}
            className="inline-flex h-9 items-center justify-center rounded-full border border-ink px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-hover"
          >
            Akhiri tur
          </button>
          <button
            type="button"
            onClick={nextStep}
            className="inline-flex h-9 items-center justify-center rounded-full bg-ink px-5 text-[13px] font-semibold text-surface transition-opacity hover:opacity-90"
          >
            {isLastStep ? "Selesai" : "Lanjut"}
          </button>
        </div>
      </div>
    </div>
  );
}
