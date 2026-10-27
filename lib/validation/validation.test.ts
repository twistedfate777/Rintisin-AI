import { describe, expect, it } from "vitest";
import { validateIdeaForm } from "@/lib/validation/idea-form";
import {
  DUPLICATE_URL_MESSAGE,
  INVALID_URL_MESSAGE,
  isMapsUrl,
  validateCompetitorForm,
} from "@/lib/validation/competitor-form";
import { validateAuthForm } from "@/lib/validation/auth-form";

const validIdea = {
  product_idea: "Sambal bawang rendah kalori dengan minyak kelapa murni",
  category: "KULINER",
  initial_capital_idr: 15_000_000,
  target_city: "Jakarta Selatan",
};

describe("validateIdeaForm", () => {
  it("accepts a valid form and trims text", () => {
    const result = validateIdeaForm({ ...validIdea, target_city: "  Bandung  " });
    expect(result.success && result.data.target_city).toBe("Bandung");
  });

  it("checks the idea length after trimming (20–1.000)", () => {
    expect(validateIdeaForm({ ...validIdea, product_idea: `   ${"a".repeat(19)}   ` }).success).toBe(false);
    expect(validateIdeaForm({ ...validIdea, product_idea: "a".repeat(20) }).success).toBe(true);
    expect(validateIdeaForm({ ...validIdea, product_idea: "a".repeat(1001) }).success).toBe(false);
  });

  it("requires an integer capital of Rp 1–Rp 10.000.000.000", () => {
    for (const bad of [undefined, 0, 1.5, 10_000_000_001]) {
      const result = validateIdeaForm({ ...validIdea, initial_capital_idr: bad });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.initial_capital_idr).toContain("Rp 10.000.000.000");
    }
    expect(validateIdeaForm({ ...validIdea, initial_capital_idr: 1 }).success).toBe(true);
    expect(validateIdeaForm({ ...validIdea, initial_capital_idr: 10_000_000_000 }).success).toBe(true);
  });

  it("rejects a missing or unknown category", () => {
    for (const bad of [undefined, "", "OTOMOTIF"]) {
      const result = validateIdeaForm({ ...validIdea, category: bad });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.category).toBeDefined();
    }
  });

  it("checks the city length after trimming (2–100)", () => {
    expect(validateIdeaForm({ ...validIdea, target_city: " a " }).success).toBe(false);
    expect(validateIdeaForm({ ...validIdea, target_city: "a".repeat(101) }).success).toBe(false);
  });
});

describe("Maps URL validation", () => {
  it("accepts the four Maps_URL formats", () => {
    expect(isMapsUrl("https://www.google.com/maps/place/Kopi+Senja/@-6.2,106.8,17z")).toBe(true);
    expect(isMapsUrl("https://maps.google.com/?cid=123")).toBe(true);
    expect(isMapsUrl("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isMapsUrl("https://goo.gl/maps/abc123")).toBe(true);
  });

  it("rejects other URLs and URLs over 2.048 characters", () => {
    expect(isMapsUrl("http://maps.app.goo.gl/abc")).toBe(false);
    expect(isMapsUrl("https://kopisenja.id/maps/place/x")).toBe(false);
    expect(isMapsUrl(`https://maps.app.goo.gl/${"a".repeat(2048)}`)).toBe(false);
  });

  it("flags each invalid field by index", () => {
    const result = validateCompetitorForm(["https://maps.app.goo.gl/abc", "bukan url"]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[1]).toBe(INVALID_URL_MESSAGE);
      expect(result.errors[0]).toBeUndefined();
    }
  });

  it("flags every duplicate, comparing scheme and host case-insensitively", () => {
    const result = validateCompetitorForm([
      "https://maps.app.goo.gl/abc",
      " HTTPS://MAPS.APP.GOO.GL/abc ",
      "https://maps.app.goo.gl/ABC",
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toBe(DUPLICATE_URL_MESSAGE);
      expect(result.errors[1]).toBe(DUPLICATE_URL_MESSAGE);
      expect(result.errors[2]).toBeUndefined(); // the path keeps its case
    }
  });

  it("allows 1–3 URLs", () => {
    expect(validateCompetitorForm([]).success).toBe(false);
    expect(
      validateCompetitorForm([
        "https://goo.gl/maps/a",
        "https://goo.gl/maps/b",
        "https://goo.gl/maps/c",
        "https://goo.gl/maps/d",
      ]).success
    ).toBe(false);
  });
});

describe("validateAuthForm", () => {
  it("enforces email format and a 8–72 character password", () => {
    expect(validateAuthForm({ email: "rini@contoh.id", password: "12345678" }).success).toBe(true);
    expect(validateAuthForm({ email: "bukan-email", password: "12345678" }).success).toBe(false);
    expect(validateAuthForm({ email: "rini@contoh.id", password: "1234567" }).success).toBe(false);
    expect(validateAuthForm({ email: "rini@contoh.id", password: "a".repeat(73) }).success).toBe(false);
    expect(validateAuthForm({ email: `${"a".repeat(250)}@x.id`, password: "12345678" }).success).toBe(false);
  });
});
