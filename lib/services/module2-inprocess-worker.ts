import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FALLBACK_MODEL,
  PRIMARY_MODEL,
  callGroqJson,
  toUserAiErrorMessage,
} from "@/lib/ai/groq-client";
import { clampRating, clampScore } from "@/lib/numbers";
import type {
  CompetitorBreakdown,
  FailedCompetitor,
  GroqModelId,
  Module2Result,
} from "@/lib/types";
import {
  guardModule2Response,
  normalizeSentimentDistribution,
} from "@/lib/validation/response-guard";

const DEFAULT_STRING = "Data tidak tersedia";

// ============================================================================
// 1. Maps_URL_Parser & Maps_URL_Formatter (Req 15.4, 15.6, 16.1–16.7)
// ============================================================================

const ALLOWED_REDIRECT_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

const FULL_MAPS_PREFIXES = [
  "https://www.google.com/maps/",
  "https://maps.google.com/",
];

const SHORTLINK_PREFIXES = [
  "https://maps.app.goo.gl/",
  "https://goo.gl/maps/",
];

const MAX_REDIRECT_HOPS = 5;
const REDIRECT_TIMEOUT_MS = 10_000;
export const UNRECOGNIZED_MAPS_URL_REASON = "URL Google Maps tidak dapat dikenali";
export const INSUFFICIENT_REVIEWS_REASON = "Ulasan informatif tidak cukup";

const FEATURE_ID_EXACT_RE = /^0x[0-9a-fA-F]{1,16}:0x[0-9a-fA-F]{1,16}$/;
const FEATURE_ID_SUBSTRING_RE =
  /(?<![0-9a-fA-F])(0x[0-9a-fA-F]{1,16}:0x[0-9a-fA-F]{1,16})(?![0-9a-fA-F])/;

export interface MapsUrlParseResult {
  ok: boolean;
  featureId?: string;
  canonicalUrl?: string;
  resolvedUrl?: string;
  reason?: string;
}

export function isValidFeatureId(value: string): boolean {
  return FEATURE_ID_EXACT_RE.test(value);
}

export function formatCanonicalMapsUrl(featureId: string): string {
  if (!isValidFeatureId(featureId)) {
    throw new Error("Feature_ID tidak valid");
  }
  return `https://www.google.com/maps/place/${featureId.toLowerCase()}`;
}

export function isAllowedRedirectUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_REDIRECT_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isFullGoogleMapsUrl(url: string): boolean {
  return FULL_MAPS_PREFIXES.some((prefix) => url.startsWith(prefix));
}

const EXPLICIT_PLACE_FID_GLOBAL_RE =
  /(?:!1s|ftid=)(0x[0-9a-fA-F]{1,16}:0x[0-9a-fA-F]{1,16})(?![0-9a-fA-F])/gi;

export function extractFeatureIdFromFullUrl(url: string): MapsUrlParseResult {
  if (!isFullGoogleMapsUrl(url)) {
    return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
  }
  let decodedUrl = url;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch {
    decodedUrl = url.replace(/%3A/gi, ":");
  }
  const candidates = [decodedUrl, url.replace(/%3A/gi, ":"), url];
  for (const candidate of candidates) {
    const explicitMatches = Array.from(candidate.matchAll(EXPLICIT_PLACE_FID_GLOBAL_RE));
    if (explicitMatches.length > 0) {
      const lastExplicit = explicitMatches[explicitMatches.length - 1]?.[1];
      if (lastExplicit) {
        const fid = lastExplicit.toLowerCase();
        return {
          ok: true,
          featureId: fid,
          canonicalUrl: formatCanonicalMapsUrl(fid),
        };
      }
    }
    const match = FEATURE_ID_SUBSTRING_RE.exec(candidate);
    if (match?.[1]) {
      const fid = match[1].toLowerCase();
      return {
        ok: true,
        featureId: fid,
        canonicalUrl: formatCanonicalMapsUrl(fid),
      };
    }
  }
  return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
}

async function extractFeatureIdFromHtmlFallback(
  url: string,
  fetchImpl: typeof fetch,
  partialFid?: string
): Promise<MapsUrlParseResult> {
  if (!isAllowedRedirectUrl(url)) {
    return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const resp = await fetchImpl(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9",
      },
    });
    if (!resp.ok) {
      return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
    }
    const rawHtml = await resp.text();
    let html = rawHtml;
    try {
      html = rawHtml.replace(/%3A/gi, ":");
    } catch {
      html = rawHtml;
    }

    // 0. If we have a partial `0x0:0x<cid>` featureId from a mobile share URL, find the matching full `0x<cell>:0x<cid>`
    if (partialFid && partialFid.startsWith("0x0:")) {
      const cidHex = partialFid.slice(4);
      const cidUpgradeRe = new RegExp(
        `(?<![0-9a-fA-F])(0x[1-9a-fA-F][0-9a-fA-F]{0,15}:${cidHex})(?![0-9a-fA-F])`,
        "i"
      );
      const upgraded = cidUpgradeRe.exec(html);
      if (upgraded?.[1]) {
        const fid = upgraded[1].toLowerCase();
        return {
          ok: true,
          featureId: fid,
          canonicalUrl: formatCanonicalMapsUrl(fid),
          resolvedUrl: url,
        };
      }
    }

    // 1. Prefer explicit `!1s0x...:0x...` or `/maps/preview/place` preload link in the HTML (preferring non-0x0:)
    const explicitMatches = Array.from(html.matchAll(EXPLICIT_PLACE_FID_GLOBAL_RE));
    const nonZeroExplicit = explicitMatches.find(
      (m) => m[1] && !m[1].toLowerCase().startsWith("0x0:")
    );
    const chosenExplicit = nonZeroExplicit?.[1] ?? explicitMatches[0]?.[1];
    if (chosenExplicit) {
      const fid = chosenExplicit.toLowerCase();
      return {
        ok: true,
        featureId: fid,
        canonicalUrl: formatCanonicalMapsUrl(fid),
        resolvedUrl: url,
      };
    }

    // 2. Fallback to any `0x...:0x...` in the HTML
    const match = FEATURE_ID_SUBSTRING_RE.exec(html);
    if (match?.[1]) {
      const fid = match[1].toLowerCase();
      return {
        ok: true,
        featureId: fid,
        canonicalUrl: formatCanonicalMapsUrl(fid),
        resolvedUrl: url,
      };
    }
    return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
  } catch {
    return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveAndParseMapsUrl(
  rawUrl: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<MapsUrlParseResult> {
  const trimmed = rawUrl.trim();
  if (isFullGoogleMapsUrl(trimmed)) {
    const direct = extractFeatureIdFromFullUrl(trimmed);
    if (direct.ok) {
      if (direct.featureId?.startsWith("0x0:")) {
        const upgraded = await extractFeatureIdFromHtmlFallback(trimmed, fetchImpl, direct.featureId);
        if (upgraded.ok && upgraded.featureId && !upgraded.featureId.startsWith("0x0:")) {
          return upgraded;
        }
      }
      return { ...direct, resolvedUrl: trimmed };
    }
    return extractFeatureIdFromHtmlFallback(trimmed, fetchImpl);
  }
  if (!SHORTLINK_PREFIXES.some((p) => trimmed.startsWith(p)) || !isAllowedRedirectUrl(trimmed)) {
    return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
  }

  const deadline = Date.now() + REDIRECT_TIMEOUT_MS;
  let currentUrl = trimmed;
  let hops = 0;

  while (hops < MAX_REDIRECT_HOPS) {
    if (isFullGoogleMapsUrl(currentUrl)) {
      const extracted = extractFeatureIdFromFullUrl(currentUrl);
      if (extracted.ok) {
        if (extracted.featureId?.startsWith("0x0:")) {
          const upgraded = await extractFeatureIdFromHtmlFallback(
            currentUrl,
            fetchImpl,
            extracted.featureId
          );
          if (upgraded.ok && upgraded.featureId && !upgraded.featureId.startsWith("0x0:")) {
            return upgraded;
          }
        }
        return { ...extracted, resolvedUrl: currentUrl };
      }
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0 || !isAllowedRedirectUrl(currentUrl)) {
      return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const resp = await fetchImpl(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept-Language": "id-ID,id;q=0.9",
        },
      });
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const location = resp.headers.get("location");
        if (!location) {
          return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
        }
        const nextUrl = new URL(location, currentUrl).toString();
        if (!isAllowedRedirectUrl(nextUrl)) {
          return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
        }
        currentUrl = nextUrl;
        hops += 1;
      } else {
        break;
      }
    } catch {
      return { ok: false, reason: UNRECOGNIZED_MAPS_URL_REASON };
    } finally {
      clearTimeout(timer);
    }
  }

  const fromResolvedUrl = extractFeatureIdFromFullUrl(currentUrl);
  if (fromResolvedUrl.ok) {
    if (fromResolvedUrl.featureId?.startsWith("0x0:")) {
      const upgraded = await extractFeatureIdFromHtmlFallback(
        currentUrl,
        fetchImpl,
        fromResolvedUrl.featureId
      );
      if (upgraded.ok && upgraded.featureId && !upgraded.featureId.startsWith("0x0:")) {
        return upgraded;
      }
    }
    return { ...fromResolvedUrl, resolvedUrl: currentUrl };
  }
  return extractFeatureIdFromHtmlFallback(currentUrl, fetchImpl);
}

// ============================================================================
// 2. Pre_Filter & Text_Normalizer (Req 18.1–18.12)
// ============================================================================

export interface RawScrapedReview {
  rating?: unknown;
  text?: unknown;
  review_date?: unknown;
  id?: string;
}

export interface CleanReview {
  rating: number;
  text: string;
}

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200D\uFE0E\uFE0F\u20E3]/gu;
const HTML_TAG_RE = /<[^>]+>/g;

function collapseRepeatedLetters(input: string): string {
  const chars = Array.from(input);
  const out: string[] = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    let j = i + 1;
    if (/\p{L}/u.test(ch)) {
      while (j < chars.length && chars[j] === ch) {
        j += 1;
      }
      const len = j - i;
      out.push(len >= 3 ? ch : ch.repeat(len));
    } else {
      out.push(ch);
    }
    i = j;
  }
  return out.join("");
}

/**
 * Requirement 18.4 & 18.5: Remove emojis, collapse >=3 identical consecutive letters to 1,
 * keep 2-letter doubles ("tunggu"), collapse spaces, and trim. Idempotent.
 */
export function normalizeReviewText(raw: string): string {
  const noEmojis = raw.replace(EMOJI_RE, "");
  const collapsedLetters = collapseRepeatedLetters(noEmojis);
  return collapsedLetters.replace(/\s+/g, " ").trim();
}

export function runPreFilter(rawReviews: RawScrapedReview[]): CleanReview[] {
  interface InternalItem {
    rating: number;
    text: string;
    ts: number;
    idx: number;
  }

  const cleaned: InternalItem[] = [];
  rawReviews.forEach((item, idx) => {
    const rNum = typeof item.rating === "number" ? item.rating : Number.NaN;
    if (!Number.isInteger(rNum) || rNum < 1 || rNum > 5) return;
    if (typeof item.text !== "string") return;

    const noHtml = item.text.replace(HTML_TAG_RE, "");
    const norm = normalizeReviewText(noHtml);
    const words = norm ? norm.split(" ").filter(Boolean) : [];
    if (words.length <= 3) return;

    const ts =
      typeof item.review_date === "number" && Number.isFinite(item.review_date)
        ? item.review_date
        : typeof item.review_date === "string"
          ? Date.parse(item.review_date) || 0
          : 0;

    cleaned.push({ rating: rNum, text: norm, ts, idx });
  });

  // Case-insensitive deduplication keeping newest timestamp
  const dedup = new Map<string, InternalItem>();
  for (const item of cleaned) {
    const key = item.text.toLowerCase();
    const prev = dedup.get(key);
    if (!prev || item.ts > prev.ts) {
      dedup.set(key, item);
    }
  }

  const unique = Array.from(dedup.values());
  const critical = unique
    .filter((r) => r.rating >= 1 && r.rating <= 3 && r.text.length > 30)
    .sort((a, b) => b.text.length - a.text.length || b.ts - a.ts || a.idx - b.idx);

  const positive = unique
    .filter((r) => r.rating >= 4 && r.rating <= 5 && r.text.length > 40)
    .sort((a, b) => b.ts - a.ts || a.idx - b.idx);

  let selectedCrit = critical.slice(0, 40);
  let selectedPos = positive.slice(0, 40);

  if (selectedCrit.length < 40 && positive.length > 40) {
    selectedPos = positive.slice(0, 40 + (40 - selectedCrit.length));
  } else if (selectedPos.length < 40 && critical.length > 40) {
    selectedCrit = critical.slice(0, 40 + (40 - selectedPos.length));
  }

  const combined = [...selectedCrit, ...selectedPos];
  if (combined.length === 0 && unique.length > 0) {
    return unique.slice(0, 80).map((r) => ({ rating: r.rating, text: r.text }));
  }

  return combined
    .slice(0, 80)
    .map((r) => ({ rating: r.rating, text: r.text }));
}

// ============================================================================
// 3. Zero-Cost Acquisition (Akuisisi_Primer RPC + Place Metadata)
// ============================================================================

const PRIMARY_RPC_URL = "https://www.google.com/maps/rpc/listugcposts";

function buildRpcPbCandidates(featureId: string, sortCode: number, pageToken = ""): string[] {
  const fid = encodeURIComponent(featureId);
  const tok = encodeURIComponent(pageToken);
  const pageBlock10 = pageToken ? `!2m2!1i10!2s${tok}` : `!2m1!1i10`;
  const pageBlock20 = `!2m2!1i20!2s${tok}`;

  return [
    // 1. Standard Google Maps web client `listugcposts` pb format
    `!1m6!1s${fid}!6m4!4m1!1e1!4m1!1e3${pageBlock10}!5m2!1s!7e81!8m9!2b1!3b1!5b1!7b1!12m4!1b1!2b1!4m1!1e1!11m4!1e3!2e1!6m1!1e2!13m1!1e${sortCode}`,
    // 2. Compact pb format without empty 5m2!1s or 11m0
    `!1m6!1s${fid}!6m4!4m1!1e1!4m1!1e3${pageBlock10}!5m1!7e81!8m5!1b1!2b1!3b1!5b1!7b1!13m1!1e${sortCode}`,
    // 3. Unencoded colon featureId variant
    `!1m6!1s${featureId}!6m4!4m1!1e1!4m1!1e3${pageBlock10}!5m2!1s!7e81!8m9!2b1!3b1!5b1!7b1!12m4!1b1!2b1!4m1!1e1!11m4!1e3!2e1!6m1!1e2!13m1!1e${sortCode}`,
    // 4. Legacy 20-item pb format
    `!1m6!1s${fid}!6m4!4m1!1e1!4m1!1e3${pageBlock20}!5m2!1s!7e81!8m9!2b1!3b1!5b1!7b1!12m4!1b1!2b1!4m1!1e1!13m1!1e${sortCode}`,
  ];
}

const NON_REVIEW_TOKEN_RE = /^(?:CAES|ChZ|Chd|0ahUKE|CiR|AF1Qip|https?:\/\/|0x[0-9a-fA-F])/i;
const RELATIVE_TIME_ONLY_RE =
  /^(?:sebulan|setahun|seminggu|sehari|\d+\s+(?:detik|menit|jam|hari|minggu|bulan|tahun))\s+(?:yang\s+)?lalu$/i;

function isLikelyNaturalReviewString(value: string): boolean {
  const s = value.trim();
  if (s.length < 8) return false;
  if (NON_REVIEW_TOKEN_RE.test(s)) return false;
  if (!s.includes(" ")) return false;
  if (RELATIVE_TIME_ONLY_RE.test(s)) return false;
  return true;
}

function collectCandidateStrings(node: unknown, acc: string[]): void {
  if (typeof node === "string") {
    if (isLikelyNaturalReviewString(node)) {
      acc.push(node.trim());
    }
  } else if (Array.isArray(node)) {
    for (const child of node) {
      collectCandidateStrings(child, acc);
    }
  }
}

function extractRatingFromNode(inner: unknown[], fullEntry: unknown[]): number | null {
  const checkIntRating = (v: unknown): number | null =>
    typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5 ? v : null;

  // 1. Standard `inner[2][0][0]` or `inner[2][0]`
  if (Array.isArray(inner[2])) {
    const sub = inner[2];
    if (Array.isArray(sub[0])) {
      const r = checkIntRating(sub[0][0]);
      if (r !== null) return r;
    }
    const rDirect = checkIntRating(sub[0]);
    if (rDirect !== null) return rDirect;
  }

  // 2. Alternative `fullEntry[2][0][0]` or `inner[1][4][0]`
  if (Array.isArray(fullEntry[2]) && Array.isArray(fullEntry[2][0])) {
    const r = checkIntRating((fullEntry[2][0] as unknown[])[0]);
    if (r !== null) return r;
  }

  // 3. Scan `inner[2]` for a 1-element rating tuple `[1..5]`
  if (Array.isArray(inner[2])) {
    for (const item of inner[2]) {
      if (Array.isArray(item) && item.length === 1) {
        const r = checkIntRating(item[0]);
        if (r !== null) return r;
      }
    }
  }

  return null;
}

function parseRpcPayload(rawBody: string): { reviews: RawScrapedReview[]; nextToken: string } {
  const body = rawBody.trim().replace(/^\)\]\}'\s*/, "");
  const data = JSON.parse(body) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("Invalid RPC payload");
  }
  const nextToken = typeof data[1] === "string" ? data[1] : "";
  const rawEntries = Array.isArray(data[2]) ? data[2] : [];
  const reviews: RawScrapedReview[] = [];

  for (const entry of rawEntries) {
    if (!Array.isArray(entry) || entry.length === 0) continue;
    const inner =
      Array.isArray(entry[0]) && entry[0].length >= 3 ? (entry[0] as unknown[]) : entry;
    if (!Array.isArray(inner)) continue;

    const id = typeof inner[0] === "string" ? inner[0] : "";
    const ts =
      Array.isArray(inner[1]) && typeof inner[1][6] === "number" ? inner[1][6] : 0;

    const rating = extractRatingFromNode(inner, entry);
    let text = "";
    const searchRoot = Array.isArray(inner[2]) ? inner[2] : inner;
    const candidates: string[] = [];
    collectCandidateStrings(searchRoot, candidates);
    if (candidates.length > 0) {
      text = candidates.reduce((a, b) => (b.length >= a.length ? b : a), "");
    }

    if (rating !== null && text) {
      reviews.push({ id, rating, text, review_date: ts });
    }
  }

  return { reviews, nextToken };
}

function extractEmbeddedReviewsFromArbitraryJson(
  node: unknown,
  out: RawScrapedReview[],
  seenTexts: Set<string>
): void {
  if (!Array.isArray(node) || out.length >= 80) return;

  // Check if `node` looks like a review item `[id, authorArr, [[rating], ...text...]]`
  if (
    node.length >= 3 &&
    typeof node[0] === "string" &&
    (node[0].startsWith("ChZ") || node[0].startsWith("Chd")) &&
    Array.isArray(node[2])
  ) {
    const rating = extractRatingFromNode(node, node);
    const candidates: string[] = [];
    collectCandidateStrings(node[2], candidates);
    const text =
      candidates.length > 0
        ? candidates.reduce((a, b) => (b.length >= a.length ? b : a), "")
        : "";
    if (rating !== null && text && !seenTexts.has(text.toLowerCase())) {
      seenTexts.add(text.toLowerCase());
      out.push({ id: node[0], rating, text, review_date: 0 });
      return;
    }
  }

  for (const child of node) {
    if (Array.isArray(child)) {
      extractEmbeddedReviewsFromArbitraryJson(child, out, seenTexts);
    }
  }
}

async function fetchPlaceMetadata(
  sourceUrl: string,
  featureId: string,
  fetchImpl: typeof fetch
): Promise<{
  competitorName: string;
  avgRating: number | null;
  embeddedReviews: RawScrapedReview[];
}> {
  let competitorName = "";
  let avgRating: number | null = null;
  const embeddedReviews: RawScrapedReview[] = [];
  const seenTexts = new Set<string>();

  // Try extracting place name from URL path `/maps/place/<Name>/` first
  const placeMatch = /\/maps\/place\/([^/@?]+)/i.exec(sourceUrl);
  if (placeMatch?.[1] && !placeMatch[1].startsWith("0x")) {
    try {
      competitorName = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
    } catch {
      competitorName = placeMatch[1].replace(/\+/g, " ").trim();
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const targetUrl = isFullGoogleMapsUrl(sourceUrl) ? sourceUrl : formatCanonicalMapsUrl(featureId);
    const resp = await fetchImpl(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9",
      },
      signal: controller.signal,
    });
    if (resp.ok) {
      const html = await resp.text();
      const titleMatch = /<meta\s+property="og:title"\s+content="([^"]+)"/i.exec(html);
      if (titleMatch?.[1]) {
        const rawTitle = titleMatch[1].split("·")[0]?.replace(/- Google Maps$/i, "").trim();
        if (rawTitle && !rawTitle.startsWith("Google Maps")) {
          competitorName = rawTitle;
        }
      }
      const descMatch = /<meta\s+property="og:description"\s+content="([^"]+)"/i.exec(html);
      if (descMatch?.[1]) {
        const ratingMatch = /([1-5][.,]\d)/.exec(descMatch[1]);
        if (ratingMatch?.[1]) {
          const parsed = Number.parseFloat(ratingMatch[1].replace(",", "."));
          if (parsed >= 1.0 && parsed <= 5.0) {
            avgRating = Math.round(parsed * 10) / 10;
          }
        }
      }

      // Check if HTML contains a preload link to `/maps/preview/place?...`
      const previewMatch = /href="(\/maps\/preview\/place\?[^"]+)"/i.exec(html);
      if (previewMatch?.[1]) {
        const previewPath = previewMatch[1].replace(/&amp;/g, "&");
        const previewResp = await fetchImpl(`https://www.google.com${previewPath}`, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "id-ID,id;q=0.9",
          },
          signal: controller.signal,
        });
        if (previewResp.ok) {
          const previewText = (await previewResp.text()).trim().replace(/^\)\]\}'\s*/, "");
          try {
            const previewData = JSON.parse(previewText) as unknown;
            extractEmbeddedReviewsFromArbitraryJson(previewData, embeddedReviews, seenTexts);
          } catch {
            // ignore preview JSON parse error
          }
        }
      }
    }
  } catch {
    // Metadata is optional per Requirement 17.9
  } finally {
    clearTimeout(timer);
  }

  return { competitorName, avgRating, embeddedReviews };
}

export async function acquireCompetitorReviewsRpc(
  sourceUrl: string,
  featureId: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<{
  ok: boolean;
  competitorName: string;
  avgRating: number | null;
  reviews: RawScrapedReview[];
  failureReason?: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22_000);
  const collected: RawScrapedReview[] = [];
  const seen = new Set<string>();

  try {
    const metaPromise = fetchPlaceMetadata(sourceUrl, featureId, fetchImpl);

    for (const sortCode of [2, 4]) {
      let pageToken = "";
      for (let page = 0; page < 4; page++) {
        if (collected.length >= 150) break;
        const pbCandidates = buildRpcPbCandidates(featureId, sortCode, pageToken);
        let pageReviews: RawScrapedReview[] = [];
        let nextToken = "";

        for (const pb of pbCandidates) {
          try {
            const resp = await fetchImpl(
              `${PRIMARY_RPC_URL}?authuser=0&hl=id&gl=id&pb=${pb}`,
              {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
                  Referer: "https://www.google.com/maps/",
                },
                signal: controller.signal,
              }
            );
            if (!resp.ok) continue;
            const text = await resp.text();
            const parsed = parseRpcPayload(text);
            if (parsed.reviews.length > 0) {
              pageReviews = parsed.reviews;
              nextToken = parsed.nextToken;
              break;
            }
          } catch {
            // Try next pb candidate
          }
        }

        let added = 0;
        for (const rev of pageReviews) {
          const key = rev.id || `${String(rev.rating)}:${String(rev.text)}`;
          if (!seen.has(key)) {
            seen.add(key);
            collected.push(rev);
            added += 1;
            if (collected.length >= 150) break;
          }
        }
        if (added === 0 || !nextToken) break;
        pageToken = nextToken;
      }
    }

    const { competitorName, avgRating, embeddedReviews } = await metaPromise;
    if (collected.length === 0 && embeddedReviews.length > 0) {
      for (const rev of embeddedReviews) {
        collected.push(rev);
      }
    }

    let computedRating = avgRating;
    if (computedRating === null && collected.length > 0) {
      const sum = collected.reduce(
        (acc, r) => acc + (typeof r.rating === "number" ? r.rating : 0),
        0
      );
      computedRating = Math.round((sum / collected.length) * 10) / 10;
    }

    if (collected.length === 0) {
      return {
        ok: false,
        competitorName,
        avgRating: computedRating,
        reviews: [],
        failureReason: "Tempat ini belum memiliki ulasan atau tidak dapat diakses",
      };
    }

    return {
      ok: true,
      competitorName,
      avgRating: computedRating,
      reviews: collected.slice(0, 150),
    };
  } catch {
    return {
      ok: false,
      competitorName: "",
      avgRating: null,
      reviews: [],
      failureReason: "Gagal mengambil ulasan dari Google Maps",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 4. In-Process Map-Reduce Pipeline (Requirements 19 & 20)
// ============================================================================

interface ValidatedMapEntry {
  mapsUrl: string;
  competitorName: string;
  avgRating: number | null;
  reviewsCount: number;
  modelUsed: GroqModelId;
  isDegraded: boolean;
  data: {
    sentiment_distribution: { positive: number; neutral: number; negative: number };
    core_strengths: string[];
    exploitable_weaknesses: string[];
    aspect_scores: {
      product_quality: number;
      pricing_value: number;
      service_speed: number;
      ambience_facility: number;
    };
    dominant_complaint: string;
  };
}

function guardSingleMapJson(raw: unknown): {
  data: ValidatedMapEntry["data"];
  isDegraded: boolean;
} {
  let degraded = false;
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : ((degraded = true), {});

  const sentTracker = { degraded: false };
  const sentValue = normalizeSentimentDistribution(obj.sentiment_distribution, sentTracker);
  if (sentTracker.degraded) degraded = true;

  const cleanList = (v: unknown): string[] => {
    if (!Array.isArray(v)) {
      degraded = true;
      return [DEFAULT_STRING];
    }
    const items = v
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
    if (items.length === 0) {
      degraded = true;
      return [DEFAULT_STRING];
    }
    return items.slice(0, 5);
  };

  const strengths = cleanList(obj.core_strengths);
  const weaknesses = cleanList(obj.exploitable_weaknesses);

  const asp =
    obj.aspect_scores && typeof obj.aspect_scores === "object"
      ? (obj.aspect_scores as Record<string, unknown>)
      : ((degraded = true), {});

  const scoreField = (v: unknown): number => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
    if (!Number.isFinite(n)) {
      degraded = true;
      return 0;
    }
    return clampScore(n);
  };

  const dominantComplaint =
    typeof obj.dominant_complaint === "string" && obj.dominant_complaint.trim()
      ? obj.dominant_complaint.trim()
      : ((degraded = true), DEFAULT_STRING);

  return {
    data: {
      sentiment_distribution: sentValue,
      core_strengths: strengths,
      exploitable_weaknesses: weaknesses,
      aspect_scores: {
        product_quality: scoreField(asp.product_quality),
        pricing_value: scoreField(asp.pricing_value),
        service_speed: scoreField(asp.service_speed),
        ambience_facility: scoreField(asp.ambience_facility),
      },
      dominant_complaint: dominantComplaint,
    },
    isDegraded: degraded,
  };
}

export async function runInProcessRadarPipeline(
  supabase: SupabaseClient,
  radarId: string,
  userId: string,
  mapsUrls: string[]
): Promise<void> {
  const updateJob = async (patch: Record<string, unknown>) => {
    await supabase
      .from("module2_radars")
      .update(patch)
      .eq("id", radarId)
      .eq("user_id", userId);
  };

  try {
    const readyForMap: {
      mapsUrl: string;
      competitorName: string;
      avgRating: number | null;
      reviews: CleanReview[];
    }[] = [];
    const failedCompetitors: FailedCompetitor[] = [];
    let transitionedToAnalyzing = false;

    for (const rawUrl of mapsUrls.slice(0, 3)) {
      const parsed = await resolveAndParseMapsUrl(rawUrl);
      if (!parsed.ok || !parsed.featureId) {
        failedCompetitors.push({
          maps_url: rawUrl,
          reason: parsed.reason ?? UNRECOGNIZED_MAPS_URL_REASON,
        });
        continue;
      }

      const scraped = await acquireCompetitorReviewsRpc(
        parsed.resolvedUrl ?? rawUrl,
        parsed.featureId
      );
      if (!scraped.ok || scraped.reviews.length === 0) {
        failedCompetitors.push({
          maps_url: rawUrl,
          reason: scraped.failureReason ?? "Gagal mengambil ulasan dari Google Maps",
        });
        continue;
      }

      const stratified = runPreFilter(scraped.reviews);
      if (stratified.length === 0) {
        failedCompetitors.push({
          maps_url: rawUrl,
          reason: INSUFFICIENT_REVIEWS_REASON,
        });
        continue;
      }

      if (!transitionedToAnalyzing) {
        transitionedToAnalyzing = true;
        await updateJob({ status: "ANALYZING" });
      }

      readyForMap.push({
        mapsUrl: rawUrl,
        competitorName: scraped.competitorName,
        avgRating: scraped.avgRating,
        reviews: stratified,
      });
    }

    if (readyForMap.length === 0) {
      const details = failedCompetitors
        .map((fc) => `${fc.maps_url} (${fc.reason})`)
        .join("; ");
      await updateJob({
        status: "FAILED",
        failed_competitors: failedCompetitors,
        error_message: `Seluruh URL kompetitor gagal diproses: ${details}.`,
      });
      return;
    }

    // Requirement 19.2: Run Fase_Map in parallel using Model_Fallback (openai/gpt-oss-20b)
    const mapOutcomes = await Promise.all(
      readyForMap.map(async (item, index): Promise<ValidatedMapEntry | null> => {
        const systemPrompt =
          "Anda adalah analis intelijen kompetitor UMKM Indonesia. Tulis seluruh nilai teks dalam Bahasa Indonesia yang profesional dan dapat langsung ditindaklanjuti. Kembalikan HANYA objek JSON valid.";
        const userPrompt = [
          `Nama Tempat: ${item.competitorName || `Kompetitor ${index + 1}`}`,
          `Rata-rata Rating: ${item.avgRating ?? "Tidak tersedia"}`,
          `Sampel Ulasan (${item.reviews.length} ulasan):`,
          JSON.stringify(item.reviews),
          "",
          "Hasilkan JSON dengan struktur:",
          '{"sentiment_distribution":{"positive":60,"neutral":20,"negative":20},"core_strengths":["..."],"exploitable_weaknesses":["..."],"aspect_scores":{"product_quality":75,"pricing_value":70,"service_speed":65,"ambience_facility":70},"dominant_complaint":"..."}',
        ].join("\n");

        try {
          const call = await callGroqJson({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            maxTokens: 2500,
            model: FALLBACK_MODEL,
          });

          const rawTrimmed = call.rawText.trim();
          const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(rawTrimmed);
          const jsonText = fenceMatch ? fenceMatch[1] : rawTrimmed;
          const parsedJson = JSON.parse(jsonText) as unknown;
          const guarded = guardSingleMapJson(parsedJson);
          return {
            mapsUrl: item.mapsUrl,
            competitorName: item.competitorName || `Kompetitor ${index + 1}`,
            avgRating: item.avgRating,
            reviewsCount: item.reviews.length,
            modelUsed: call.modelUsed,
            isDegraded: guarded.isDegraded,
            data: guarded.data,
          };
        } catch {
          failedCompetitors.push({
            maps_url: item.mapsUrl,
            reason: "Analisis ulasan AI gagal untuk kompetitor ini",
          });
          return null;
        }
      })
    );

    const validatedMaps = mapOutcomes.filter(
      (entry): entry is ValidatedMapEntry => entry !== null
    );

    if (validatedMaps.length === 0) {
      await updateJob({
        status: "FAILED",
        failed_competitors: failedCompetitors,
        map_models: [FALLBACK_MODEL],
        error_message: "Seluruh analisis ulasan kompetitor gagal diselesaikan.",
      });
      return;
    }

    // Requirement 19.3: Fase_Reduce with max 1,000 input tokens using Model_Primer (openai/gpt-oss-120b)
    const compactMapSummary = JSON.stringify(
      validatedMaps.map((m, i) => ({
        index: i + 1,
        competitor_name: m.competitorName,
        avg_rating: m.avgRating,
        reviews_analyzed: m.reviewsCount,
        sentiment_distribution: m.data.sentiment_distribution,
        core_strengths: m.data.core_strengths.slice(0, 3),
        exploitable_weaknesses: m.data.exploitable_weaknesses.slice(0, 3),
        aspect_scores: m.data.aspect_scores,
        dominant_complaint: m.data.dominant_complaint.slice(0, 150),
      }))
    ).slice(0, 3400);

    const reduceSystemPrompt =
      "Anda adalah konsultan strategi pasar UMKM Indonesia. Tulis seluruh nilai teks dalam Bahasa Indonesia yang profesional dan dapat langsung ditindaklanjuti. Kembalikan HANYA objek JSON valid.";
    const reduceUserPrompt = [
      "Ringkasan hasil analisis per kompetitor:",
      compactMapSummary,
      "",
      "Hasilkan JSON dengan struktur:",
      '{"market_overview":{"total_reviews_analyzed":0,"dominant_market_complaint":"...","unmet_customer_need":"..."},"competitors_breakdown":[{"competitor_name":"...","avg_rating":4.5,"sentiment_distribution":{"positive":60,"neutral":20,"negative":20},"core_strengths":["..."],"exploitable_weaknesses":["..."],"aspect_scores":{"product_quality":75,"pricing_value":70,"service_speed":65,"ambience_facility":70}}],"steal_the_market_playbook":[{"target_weakness":"...","actionable_strategy":"...","marketing_hook":"..."}]}',
    ].join("\n");

    let reduceCall: { rawText: string; modelUsed: GroqModelId };
    try {
      reduceCall = await callGroqJson({
        messages: [
          { role: "system", content: reduceSystemPrompt },
          { role: "user", content: reduceUserPrompt },
        ],
        maxTokens: 4096,
      });
    } catch (err) {
      await updateJob({
        status: "FAILED",
        failed_competitors: failedCompetitors,
        map_models: validatedMaps.map((m) => m.modelUsed),
        reduce_model: PRIMARY_MODEL,
        error_message: toUserAiErrorMessage(err),
      });
      return;
    }

    const guardedReduce = await guardModule2Response({
      rawText: reduceCall.rawText,
      modelUsed: reduceCall.modelUsed,
    });

    // Requirement 19.6 & 19.7: Overwrite total_reviews_analyzed, competitor_name, and avg_rating
    const totalReviewsAnalyzed = Math.min(
      240,
      validatedMaps.reduce((acc, m) => acc + m.reviewsCount, 0)
    );

    const finalBreakdown: CompetitorBreakdown[] = validatedMaps.map((m, idx) => {
      const llmEntry = guardedReduce.data.competitors_breakdown[idx];
      return {
        competitor_name: m.competitorName || `Kompetitor ${idx + 1}`,
        avg_rating: m.avgRating !== null ? clampRating(m.avgRating) : 0,
        sentiment_distribution:
          llmEntry?.sentiment_distribution ?? m.data.sentiment_distribution,
        core_strengths:
          llmEntry?.core_strengths.length ? llmEntry.core_strengths : m.data.core_strengths,
        exploitable_weaknesses:
          llmEntry?.exploitable_weaknesses.length
            ? llmEntry.exploitable_weaknesses
            : m.data.exploitable_weaknesses,
        aspect_scores: llmEntry?.aspect_scores ?? m.data.aspect_scores,
      };
    });

    const finalResult: Module2Result = {
      market_overview: {
        ...guardedReduce.data.market_overview,
        total_reviews_analyzed: totalReviewsAnalyzed,
      },
      competitors_breakdown: finalBreakdown,
      steal_the_market_playbook: guardedReduce.data.steal_the_market_playbook,
    };

    const isDegraded =
      guardedReduce.is_degraded || validatedMaps.some((m) => m.isDegraded);

    // Requirement 20.1: Single atomic update to COMPLETED
    await updateJob({
      status: "COMPLETED",
      result: finalResult,
      is_degraded: isDegraded,
      failed_competitors: failedCompetitors,
      map_models: validatedMaps.map((m) => m.modelUsed),
      reduce_model: reduceCall.modelUsed,
      error_message: null,
    });
  } catch {
    await updateJob({
      status: "FAILED",
      error_message:
        "Terjadi gangguan internal saat memproses analisis kompetitor. Silakan coba lagi.",
    });
  }
}
