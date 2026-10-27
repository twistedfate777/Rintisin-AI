// Indonesian number and date formatting. Every figure on screen goes through these.

const integerFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const oneDecimalFormat = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function finiteOr(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** "Rp 35.000": prefix, one space, rounded to the rupiah, dot thousands separators. */
export function formatRupiah(value: unknown): string {
  const rounded = Math.round(finiteOr(value));
  // Normalise -0 so a tiny negative rounding prints as "Rp 0".
  return `Rp ${integerFormat.format(rounded === 0 ? 0 : rounded)}`;
}

/** "48,6%": one decimal, comma separator. */
export function formatPercent1(value: unknown): string {
  return `${oneDecimalFormat.format(finiteOr(value))}%`;
}

/** "74%": an integer percentage. */
export function formatPercent0(value: unknown): string {
  return `${integerFormat.format(Math.round(finiteOr(value)))}%`;
}

/** "1.240": an integer count with dot separators. */
export function formatInteger(value: unknown): string {
  return integerFormat.format(Math.round(finiteOr(value)));
}

/** "4,3": a rating on the 0–5 scale with one decimal. */
export function formatRating(value: unknown): string {
  return oneDecimalFormat.format(finiteOr(value));
}

/** Digits typed into the capital field, shown with dot separators ("35.000.000"). */
export function formatDigitGroups(digits: string): string {
  const clean = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (clean === "") return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Parses a grouped digit string back to a number; empty input gives undefined. */
export function parseDigitGroups(text: string): number | undefined {
  const clean = text.replace(/\D/g, "");
  if (clean === "") return undefined;
  return Number(clean);
}

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** "18 Okt 2026 14.22" in WIB. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormat.format(date).replace(",", "");
}

/** Cuts text to at most `max` characters on a word boundary, with an ellipsis. */
export function truncateText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
