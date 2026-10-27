import { z } from "zod";

// Shared Competitor_Form schema (Requirement 13). The server action will reuse it unchanged.

export const MAX_COMPETITORS = 3;
export const MAX_URL_LENGTH = 2048;

const MAPS_URL_PATTERNS: RegExp[] = [
  /^https:\/\/www\.google\.com\/maps\/place\/\S+$/i,
  /^https:\/\/maps\.google\.com\/\S*$/i,
  /^https:\/\/maps\.app\.goo\.gl\/\S+$/i,
  /^https:\/\/goo\.gl\/maps\/\S+$/i,
];

export const INVALID_URL_MESSAGE =
  "Format URL tidak valid. Gunakan tautan tempat dari Google Maps (google.com/maps/place, maps.google.com, maps.app.goo.gl, atau goo.gl/maps).";
export const DUPLICATE_URL_MESSAGE = "URL ini sama dengan URL kompetitor lain.";
export const EMPTY_URL_MESSAGE = "Isi URL Google Maps kompetitor.";

export function isMapsUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return false;
  return MAPS_URL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Trims, and lower-cases only the scheme and host, so paths keep their case. */
export function normalizeUrlForCompare(value: string): string {
  const trimmed = value.trim();
  const match = /^([a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/i.exec(trimmed);
  return match ? match[1].toLowerCase() + match[2] : trimmed;
}

const mapsUrlSchema = z
  .string()
  .trim()
  .min(1, EMPTY_URL_MESSAGE)
  .max(MAX_URL_LENGTH, INVALID_URL_MESSAGE)
  .refine(isMapsUrl, INVALID_URL_MESSAGE);

export const competitorFormSchema = z
  .object({
    urls: z.array(mapsUrlSchema).min(1).max(MAX_COMPETITORS),
  })
  .superRefine((value, ctx) => {
    const seen = new Map<string, number[]>();
    value.urls.forEach((url, index) => {
      const key = normalizeUrlForCompare(url);
      seen.set(key, [...(seen.get(key) ?? []), index]);
    });
    for (const indexes of seen.values()) {
      if (indexes.length < 2) continue;
      for (const index of indexes) {
        ctx.addIssue({ code: "custom", path: ["urls", index], message: DUPLICATE_URL_MESSAGE });
      }
    }
  });

export type CompetitorFormValues = z.infer<typeof competitorFormSchema>;

/** Returns the trimmed URLs, or one message per invalid field index. */
export function validateCompetitorForm(
  urls: string[]
): { success: true; urls: string[] } | { success: false; errors: Record<number, string> } {
  const result = competitorFormSchema.safeParse({ urls });
  if (result.success) return { success: true, urls: result.data.urls };
  const errors: Record<number, string> = {};
  for (const issue of result.error.issues) {
    const index = issue.path[1];
    if (typeof index === "number" && !errors[index]) errors[index] = issue.message;
  }
  return { success: false, errors };
}
