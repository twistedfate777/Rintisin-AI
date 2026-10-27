import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  extractFeatureIdFromFullUrl,
  formatCanonicalMapsUrl,
  isAllowedRedirectUrl,
  normalizeReviewText,
  runPreFilter,
} from "@/lib/services/module2-inprocess-worker";
import { isExternalWorkerConfigured } from "@/lib/services/module2-service";

describe("module2-inprocess-worker (Vercel Serverless Mode)", () => {
  it("satisfies Maps_URL_Formatter -> Maps_URL_Parser round-trip property (Req 16.7)", () => {
    const hexPartArb = fc.stringMatching(/^[0-9a-fA-F]{1,16}$/);
    fc.assert(
      fc.property(hexPartArb, hexPartArb, (p1, p2) => {
        const fid = `0x${p1}:0x${p2}`;
        const canonical = formatCanonicalMapsUrl(fid);
        const parsed = extractFeatureIdFromFullUrl(canonical);
        expect(parsed.ok).toBe(true);
        expect(parsed.featureId).toBe(fid.toLowerCase());
      }),
      { numRuns: 100 }
    );
  });

  it("enforces HTTPS and exact Google Maps hostname allowlist (Req 15.4, 15.6)", () => {
    expect(isAllowedRedirectUrl("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isAllowedRedirectUrl("https://www.google.com/maps/place/x")).toBe(true);
    expect(isAllowedRedirectUrl("http://www.google.com/maps/place/x")).toBe(false);
    expect(isAllowedRedirectUrl("https://evil.google.com.attacker.com/x")).toBe(false);
  });

  it("satisfies Text_Normalizer idempotence and letter-collapse rules (Req 18.4, 18.5)", () => {
    expect(
      normalizeReviewText("  Laaaamaaa   bangeeet   tunggu   pesanannya 😭🔥 100%!!  ")
    ).toBe("Lama banget tunggu pesanannya 100%!!");

    fc.assert(
      fc.property(fc.string(), (s) => {
        const once = normalizeReviewText(s);
        const twice = normalizeReviewText(once);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 }
    );
  });

  it("filters <=3 words, deduplicates case-insensitively keeping newest, and stratifies up to 80 (Req 18.6–18.11)", () => {
    const out = runPreFilter([
      { rating: 5, text: "Enak banget mantap", review_date: 100 }, // 3 words -> dropped
      {
        rating: 2,
        text: "<b>Pelayanan</b> sangaaat laaama sekali sampai menunggu satu jam",
        review_date: 100,
      },
      {
        rating: 1,
        text: "pelayanan sangat lama sekali sampai menunggu satu jam",
        review_date: 300,
      },
      {
        rating: 5,
        text: "Tempatnya sangat nyaman bersih dan kopinya enak sekali untuk kerja",
        review_date: 400,
      },
    ]);

    expect(out).toHaveLength(2);
    expect(out[0]?.rating).toBe(1);
    expect(out[0]?.text).not.toContain("<b>");
  });

  it("detects when in-process Vercel mode should be used vs external worker", () => {
    expect(isExternalWorkerConfigured("")).toBe(false);
    expect(isExternalWorkerConfigured("vercel")).toBe(false);
    expect(isExternalWorkerConfigured("internal")).toBe(false);
    expect(isExternalWorkerConfigured("https://<space-name>.hf.space")).toBe(false);
    expect(isExternalWorkerConfigured("https://my-worker.example.com")).toBe(true);
  });
});
