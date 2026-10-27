// The product's mark: a radar sweep (two arcs and a found point), drawn from "LokalTrend Radar".
export function BrandMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <rect width="24" height="24" rx="6" fill="var(--brand)" />
      <path d="M6 18a12 12 0 0 1 12-12" fill="none" stroke="var(--brand-fill)" strokeWidth="2" strokeLinecap="round" />
      <path d="M10 18a8 8 0 0 1 8-8" fill="none" stroke="var(--brand-fill)" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.5" cy="16.5" r="2" fill="var(--brand-fill)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="text-[15px] font-semibold text-ink">Rintisin AI</span>
    </span>
  );
}
