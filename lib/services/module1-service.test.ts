import { describe, expect, it, vi } from "vitest";
import { GroqClientError } from "@/lib/ai/groq-client";
import { mockIdeaInput, mockStep1, mockStep2 } from "@/lib/mock/module1";
import {
  MODULE1_BASE_SYSTEM_PROMPT,
  MODULE1_MAX_TOKENS,
  buildStep1Messages,
  buildStep2Messages,
  mapDbRowToModule1Analysis,
  runModule1Step1Ai,
  runModule1Step2Ai,
} from "@/lib/services/module1-service";

describe("module1-service prompts & mapping (Requirement 5, 10, 12.7)", () => {
  it("includes exact base system prompt, Indonesian instruction, and category context (Req 5.9, 5.10)", () => {
    const step1Msgs = buildStep1Messages(mockIdeaInput);
    expect(step1Msgs[0].role).toBe("system");
    expect(step1Msgs[0].content).toContain(MODULE1_BASE_SYSTEM_PROMPT);
    expect(step1Msgs[0].content).toContain("Bahasa Indonesia");
    expect(step1Msgs[0].content).toContain(mockIdeaInput.target_city);
    expect(step1Msgs[0].content).toContain("PIRT");

    const step2Msgs = buildStep2Messages(mockIdeaInput, mockStep1);
    expect(step2Msgs[0].content).toContain(MODULE1_BASE_SYSTEM_PROMPT);
    expect(step2Msgs[1].content).toContain(mockStep1.target_market_mapper.primary_segment.persona_label);
  });

  it("executes Step 1 and Step 2 with MODULE1_MAX_TOKENS and passes output through Response_Guard (Req 5.2–5.5)", async () => {
    const caller1 = vi.fn().mockResolvedValueOnce({
      rawText: JSON.stringify(mockStep1),
      modelUsed: "openai/gpt-oss-120b" as const,
    });
    const out1 = await runModule1Step1Ai(mockIdeaInput, caller1);
    expect(out1.ok).toBe(true);
    if (out1.ok) {
      expect(out1.modelUsed).toBe("openai/gpt-oss-120b");
      expect(out1.isDegraded).toBe(false);
      expect(out1.result).toEqual(mockStep1);
    }
    expect(caller1).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTokens: MODULE1_MAX_TOKENS,
      })
    );

    const caller2 = vi.fn().mockResolvedValueOnce({
      rawText: JSON.stringify(mockStep2),
      modelUsed: "openai/gpt-oss-20b" as const,
    });
    const out2 = await runModule1Step2Ai(mockIdeaInput, mockStep1, caller2);
    expect(out2.ok).toBe(true);
    if (out2.ok) {
      expect(out2.modelUsed).toBe("openai/gpt-oss-20b");
      expect(out2.result).toEqual(mockStep2);
    }
  });

  it("maps Groq failures to safe Indonesian error messages (Req 5.11, 11.6, 11.7)", async () => {
    const failingCaller = vi.fn().mockRejectedValueOnce(new GroqClientError("QUOTA"));
    const out = await runModule1Step1Ai(mockIdeaInput, failingCaller);
    expect(out).toEqual({
      ok: false,
      userError: "Kuota AI sedang penuh. Silakan coba lagi beberapa saat lagi.",
    });
  });

  it("re-validates DB rows with Response_Guard and marks degraded if stored JSON is incomplete (Req 12.7, 12.12)", () => {
    const mapped = mapDbRowToModule1Analysis({
      id: "uuid-1",
      user_id: "user-1",
      product_idea: mockIdeaInput.product_idea,
      category: mockIdeaInput.category,
      initial_capital_idr: mockIdeaInput.initial_capital_idr,
      target_city: mockIdeaInput.target_city,
      step1_status: "SUCCESS",
      step2_status: "IDLE",
      step1_result: { feasibility_audit: {} }, // incomplete JSON stored in DB
      step2_result: null,
      is_degraded: false,
      created_at: "2026-10-20T00:00:00.000Z",
    });

    expect(mapped.is_degraded).toBe(true);
    expect(mapped.step1_result?.feasibility_audit.trend_sustainability.analysis).toBe(
      "Data tidak tersedia"
    );
  });
});
