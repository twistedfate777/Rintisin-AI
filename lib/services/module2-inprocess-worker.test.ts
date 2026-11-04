import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  acquireCompetitorReviewsRpc,
  extractFeatureIdFromFullUrl,
  formatCanonicalMapsUrl,
  isAllowedRedirectUrl,
  normalizeReviewText,
  resolveAndParseMapsUrl,
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

  it("upgrades 0x0:0x<cid> from maps.app.goo.gl shortlinks via HTML fallback", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "https://maps.app.goo.gl/HJNLpewubRVJtbrUA") {
        return new Response(null, {
          status: 302,
          headers: {
            location:
              "https://www.google.com/maps/place/Kopi+Nusantara/data=!4m2!3m1!1s0x0:0x9f1e2d3c4b5a6978?g_st=ac",
          },
        });
      }
      return new Response(
        '<html><head><link href="/maps/preview/place?pb=!1m2!1y123!2y456!1s0x2e69f3e945e34b9d%3A0x9f1e2d3c4b5a6978" rel="preload"></head></html>',
        { status: 200 }
      );
    };

    const parsed = await resolveAndParseMapsUrl(
      "https://maps.app.goo.gl/HJNLpewubRVJtbrUA",
      mockFetch
    );
    expect(parsed.ok).toBe(true);
    expect(parsed.featureId).toBe("0x2e69f3e945e34b9d:0x9f1e2d3c4b5a6978");
    expect(parsed.resolvedUrl).toContain("https://www.google.com/maps/place/Kopi+Nusantara");
  });

  it("extracts natural-language review text while ignoring base64 CAES/ChZ tokens in listugcposts", async () => {
    const longBase64Token =
      "CAESY0NBRVFDaHBFUTJwRlNVRlNTWEJEWjI5QlVEY3lSM2QzWXpKVGJsOWZSV2hFUVVGQlIyZHVNRzR0V1Zoa2NsSmZSVUZCUVVGQlIyZHVNRzR0V1Zoa2NsSmZSVUZCUVVGQg==";
    const rpcPayload =
      ")]}'\n" +
      JSON.stringify([
        null,
        "",
        [
          [
            [
              "ChZDSUhNMG9nS0VJQ0FnSUNVck95Z1JnEAE",
              ["Budi Santoso", null, null, "2 minggu lalu"],
              [
                [5],
                null,
                longBase64Token,
                [
                  "Kopinya sangat enak, tempatnya nyaman buat kerja seharian dan pelayanannya ramah sekali.",
                ],
              ],
              1710000000000,
            ],
          ],
        ],
      ]);

    const mockFetch: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("listugcposts")) {
        return new Response(rpcPayload, { status: 200 });
      }
      return new Response(
        '<html><head><meta property="og:title" content="Kopi Nusantara · Kedai Kopi"><meta property="og:description" content="★★★★☆ · 4,7 · Kedai Kopi"></head></html>',
        { status: 200 }
      );
    };

    const res = await acquireCompetitorReviewsRpc(
      "https://www.google.com/maps/place/Kopi+Nusantara",
      "0x2e69f3e945e34b9d:0x9f1e2d3c4b5a6978",
      mockFetch
    );

    expect(res.ok).toBe(true);
    expect(res.competitorName).toBe("Kopi Nusantara");
    expect(res.avgRating).toBe(4.7);
    expect(res.reviews).toHaveLength(1);
    expect(res.reviews[0]?.text).toBe(
      "Kopinya sangat enak, tempatnya nyaman buat kerja seharian dan pelayanannya ramah sekali."
    );
  });
});
