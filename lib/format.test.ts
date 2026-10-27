import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  formatDigitGroups,
  formatInteger,
  formatPercent0,
  formatPercent1,
  formatRating,
  formatRupiah,
  parseDigitGroups,
  truncateText,
} from "@/lib/format";
import { clampScore, grossMargin } from "@/lib/numbers";
import { FALLBACK_LABEL, TREND_LABEL, VIABILITY_LABEL, labelFor } from "@/lib/labels";

describe("formatRupiah", () => {
  it("uses the Rp prefix, a space and dot thousands separators", () => {
    expect(formatRupiah(35000)).toBe("Rp 35.000");
    expect(formatRupiah(10_000_000_000)).toBe("Rp 10.000.000.000");
  });
  it("prints zero and rounds to the rupiah", () => {
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatRupiah(17999.6)).toBe("Rp 18.000");
    expect(formatRupiah(-0.2)).toBe("Rp 0");
  });
  it("never prints NaN for bad input", () => {
    expect(formatRupiah(Number.NaN)).toBe("Rp 0");
    expect(formatRupiah("85")).toBe("Rp 0");
  });
});

describe("percent, count and rating formats", () => {
  it("uses a comma decimal and one decimal place", () => {
    expect(formatPercent1(48.571)).toBe("48,6%");
    expect(formatPercent1(42.5)).toBe("42,5%");
    expect(formatPercent0(74)).toBe("74%");
    expect(formatInteger(1240)).toBe("1.240");
    expect(formatRating(4.3)).toBe("4,3");
  });
});

describe("capital input grouping", () => {
  it("groups digits and parses them back", () => {
    expect(formatDigitGroups("15000000")).toBe("15.000.000");
    expect(formatDigitGroups("00a12")).toBe("12");
    expect(parseDigitGroups("15.000.000")).toBe(15_000_000);
    expect(parseDigitGroups("")).toBeUndefined();
  });

  it("round-trips any non-negative integer (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000_000 }), (n) => {
        expect(parseDigitGroups(formatDigitGroups(String(n)))).toBe(n);
      })
    );
  });
});

describe("chart guards", () => {
  it("clamps any input to a finite 0–100 value (property)", () => {
    fc.assert(
      fc.property(fc.oneof(fc.double(), fc.string(), fc.constant(null), fc.constant(undefined)), (v) => {
        const out = clampScore(v);
        expect(Number.isFinite(out)).toBe(true);
        expect(out).toBeGreaterThanOrEqual(0);
        expect(out).toBeLessThanOrEqual(100);
      })
    );
  });

  it("computes the mock margin as (price − cogs) ÷ price", () => {
    expect(grossMargin(35000, 18000)).toBe(48.6);
    expect(grossMargin(0, 18000)).toBe(0);
  });
});

describe("labels", () => {
  it("maps codes to Indonesian and falls back for unknown codes", () => {
    expect(labelFor(VIABILITY_LABEL, "VIABLE_WITH_NOTES")).toBe("Layak dengan Catatan");
    expect(labelFor(TREND_LABEL, "EVERGREEN_NICHE")).toBe("Niche Evergreen");
    expect(labelFor(TREND_LABEL, "SOMETHING_NEW")).toBe(FALLBACK_LABEL);
    expect(labelFor(TREND_LABEL, "toString")).toBe(FALLBACK_LABEL);
  });
});

describe("truncateText", () => {
  it("keeps short text and cuts long text to the limit", () => {
    expect(truncateText("Sambal bawang", 80)).toBe("Sambal bawang");
    const long = "a ".repeat(100);
    expect(truncateText(long, 80).length).toBeLessThanOrEqual(80);
  });
});
