// Guards for chart inputs: charts never receive NaN, Infinity or out-of-range values.

/** Clamps to 0–100; anything that is not a finite number becomes 0. */
export function clampScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Clamps a rating to 0–5; anything that is not a finite number becomes 0. */
export function clampRating(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
}

/** Gross margin from price and cost, rounded to one decimal, clamped to 0–100. */
export function grossMargin(priceIdr: number, cogsIdr: number): number {
  if (!(priceIdr > 0)) return 0;
  return clampScore(Math.round(((priceIdr - cogsIdr) / priceIdr) * 1000) / 10);
}
