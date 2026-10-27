import { describe, expect, it, vi } from "vitest";
import {
  AI_QUOTA_ERROR_MESSAGE,
  AI_SERVICE_ERROR_MESSAGE,
  FALLBACK_MODEL,
  GROQ_API_URL,
  GroqClientError,
  PRIMARY_MODEL,
  callGroqJson,
  toUserAiErrorMessage,
  type GroqMessage,
} from "@/lib/ai/groq-client";

const sampleMessages: GroqMessage[] = [
  { role: "system", content: "Anda adalah konsultan UMKM." },
  { role: "user", content: "Audit ide sambal bawang." },
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("callGroqJson (Requirement 11)", () => {
  it("sends response_format json_object to PRIMARY_MODEL and records modelUsed (Req 11.1, 11.8)", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse(200, {
        choices: [{ message: { content: '{"ok":true}' } }],
      })
    );

    const result = await callGroqJson({
      apiKey: "gsk_test_secret_key",
      messages: sampleMessages,
      maxTokens: 1200,
      fetchFn: fetchMock,
    });

    expect(result).toEqual({
      rawText: '{"ok":true}',
      modelUsed: PRIMARY_MODEL,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(GROQ_API_URL);
    const parsedBody = JSON.parse(String(init?.body));
    expect(parsedBody.model).toBe("openai/gpt-oss-120b");
    expect(parsedBody.max_tokens).toBe(1200);
    expect(parsedBody.response_format).toEqual({ type: "json_object" });
  });

  it("automatically falls back once to FALLBACK_MODEL with identical parameters on HTTP 429 (Req 11.1, 11.2, 11.8)", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: "rate limit" } }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          choices: [{ message: { content: '{"fallback":true}' } }],
        })
      );

    const result = await callGroqJson({
      apiKey: "gsk_test_secret_key",
      messages: sampleMessages,
      maxTokens: 1200,
      temperature: 0.3,
      fetchFn: fetchMock,
    });

    expect(result).toEqual({
      rawText: '{"fallback":true}',
      modelUsed: FALLBACK_MODEL,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(firstBody.model).toBe(PRIMARY_MODEL);
    expect(secondBody.model).toBe(FALLBACK_MODEL);
    expect(secondBody.messages).toEqual(firstBody.messages);
    expect(secondBody.max_tokens).toBe(firstBody.max_tokens);
    expect(secondBody.temperature).toBe(firstBody.temperature);
    expect(secondBody.response_format).toEqual({ type: "json_object" });
  });

  it("stops and throws QUOTA error when FALLBACK_MODEL also returns HTTP 429 (Req 11.3, 11.7)", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate limit primary" }))
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate limit fallback" }));

    await expect(
      callGroqJson({
        apiKey: "gsk_test_secret_key",
        messages: sampleMessages,
        fetchFn: fetchMock,
      })
    ).rejects.toMatchObject({
      type: "QUOTA",
      userMessage: AI_QUOTA_ERROR_MESSAGE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops immediately with QUOTA error without retrying when direct FALLBACK_MODEL call returns 429 (Req 11.3)", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate limit map phase" }));

    await expect(
      callGroqJson({
        apiKey: "gsk_test_secret_key",
        model: FALLBACK_MODEL,
        messages: sampleMessages,
        fetchFn: fetchMock,
      })
    ).rejects.toMatchObject({
      type: "QUOTA",
      userMessage: AI_QUOTA_ERROR_MESSAGE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on HTTP 5xx, non-429 4xx, or network errors and returns SERVICE error (Req 11.5, 11.6)", async () => {
    for (const status of [400, 401, 500, 503]) {
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(jsonResponse(status, { error: `HTTP ${status} internal detail` }));

      try {
        await callGroqJson({
          apiKey: "gsk_secret_12345",
          messages: sampleMessages,
          fetchFn: fetchMock,
        });
        expect.unreachable("Should have thrown GroqClientError");
      } catch (err) {
        expect(err).toBeInstanceOf(GroqClientError);
        expect((err as GroqClientError).type).toBe("SERVICE");
        const msg = toUserAiErrorMessage(err);
        expect(msg).toBe(AI_SERVICE_ERROR_MESSAGE);
        expect(msg).not.toContain(String(status));
        expect(msg).not.toContain("gsk_secret_12345");
        expect(msg).not.toContain(PRIMARY_MODEL);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }

    const networkFailFetch = vi.fn<typeof fetch>().mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(
      callGroqJson({
        apiKey: "gsk_secret_12345",
        messages: sampleMessages,
        fetchFn: networkFailFetch,
      })
    ).rejects.toMatchObject({
      type: "SERVICE",
      userMessage: AI_SERVICE_ERROR_MESSAGE,
    });
    expect(networkFailFetch).toHaveBeenCalledTimes(1);
  });

  it("aborts in-flight request and returns TIMEOUT error when duration reaches timeoutMs (Req 11.4)", async () => {
    const slowFetch: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const abortErr = new Error("The operation was aborted");
          abortErr.name = "AbortError";
          reject(abortErr);
        });
      });

    await expect(
      callGroqJson({
        apiKey: "gsk_test_secret_key",
        messages: sampleMessages,
        timeoutMs: 40,
        fetchFn: slowFetch,
      })
    ).rejects.toMatchObject({
      type: "TIMEOUT",
      userMessage: AI_SERVICE_ERROR_MESSAGE,
    });
  });
});
