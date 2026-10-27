import type { GroqModelId } from "@/lib/types";

// Server-only GroqCloud client with HTTP 429 auto-fallback and 8-second timeout (Requirement 11).

export const PRIMARY_MODEL: GroqModelId = "openai/gpt-oss-120b";
export const FALLBACK_MODEL: GroqModelId = "openai/gpt-oss-20b";

export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_TIMEOUT_MS = 8_000;

export const AI_QUOTA_ERROR_MESSAGE = "Kuota AI sedang penuh. Silakan coba lagi beberapa saat lagi.";
export const AI_SERVICE_ERROR_MESSAGE =
  "Layanan AI sedang tidak tersedia. Silakan coba lagi beberapa saat lagi.";

export type GroqErrorType = "QUOTA" | "TIMEOUT" | "SERVICE";

export class GroqClientError extends Error {
  readonly type: GroqErrorType;
  readonly userMessage: string;

  constructor(type: GroqErrorType, internalReason?: string) {
    const userMessage = type === "QUOTA" ? AI_QUOTA_ERROR_MESSAGE : AI_SERVICE_ERROR_MESSAGE;
    super(internalReason ?? userMessage);
    this.name = "GroqClientError";
    this.type = type;
    this.userMessage = userMessage;
  }
}

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatRequest {
  messages: GroqMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Defaults to PRIMARY_MODEL ("openai/gpt-oss-120b"). Use FALLBACK_MODEL for Fase_Map. */
  model?: GroqModelId;
  /** Optional custom timeout in ms (defaults to 8000ms per Requirement 11.4). */
  timeoutMs?: number;
  /** Optional custom fetch implementation for unit testing. */
  fetchFn?: typeof fetch;
  /** Optional API key override for unit testing; defaults to process.env.GROQ_API_KEY. */
  apiKey?: string;
}

export interface GroqChatResponse {
  rawText: string;
  modelUsed: GroqModelId;
}

interface GroqCompletionPayload {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
}

function buildRequestBody(
  model: GroqModelId,
  messages: GroqMessage[],
  maxTokens: number,
  temperature: number
): string {
  return JSON.stringify({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    // Requirement 11.1: always include json_object response_format on both primary and fallback calls.
    response_format: { type: "json_object" },
  });
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  return name === "AbortError" || name === "TimeoutError";
}

/**
 * Calls GroqCloud Chat Completions with `response_format: { type: "json_object" }`,
 * automatic single retry on FALLBACK_MODEL when PRIMARY_MODEL returns HTTP 429,
 * and an 8-second total deadline across the entire invocation (Requirement 11.1–11.8).
 */
export async function callGroqJson(request: GroqChatRequest): Promise<GroqChatResponse> {
  const apiKey = (request.apiKey ?? process.env.GROQ_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new GroqClientError("SERVICE", "Missing GROQ_API_KEY");
  }

  const fetchImpl = request.fetchFn ?? globalThis.fetch;
  const initialModel: GroqModelId = request.model ?? PRIMARY_MODEL;
  const maxTokens = request.maxTokens ?? 1200;
  const temperature = request.temperature ?? 0.2;
  const timeoutMs = request.timeoutMs ?? GROQ_TIMEOUT_MS;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const invokeModel = async (model: GroqModelId): Promise<Response> => {
    const body = buildRequestBody(model, request.messages, maxTokens, temperature);
    return fetchImpl(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: controller.signal,
    });
  };

  const extractContent = async (response: Response, model: GroqModelId): Promise<GroqChatResponse> => {
    const data = (await response.json()) as GroqCompletionPayload;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new GroqClientError("SERVICE", "Groq response missing string content");
    }
    return { rawText: content, modelUsed: model };
  };

  try {
    const firstResponse = await invokeModel(initialModel);

    if (firstResponse.ok) {
      return await extractContent(firstResponse, initialModel);
    }

    if (firstResponse.status === 429) {
      // Requirement 11.3: if FALLBACK_MODEL itself was called directly (e.g. Fase_Map) and returned 429, stop immediately.
      if (initialModel === FALLBACK_MODEL) {
        throw new GroqClientError("QUOTA");
      }

      // Requirement 11.2: when PRIMARY_MODEL returns 429, retry once with FALLBACK_MODEL using identical parameters.
      if (timedOut || controller.signal.aborted) {
        throw new GroqClientError("TIMEOUT");
      }

      const fallbackResponse = await invokeModel(FALLBACK_MODEL);
      if (fallbackResponse.ok) {
        return await extractContent(fallbackResponse, FALLBACK_MODEL);
      }

      if (fallbackResponse.status === 429) {
        throw new GroqClientError("QUOTA");
      }

      throw new GroqClientError("SERVICE");
    }

    // Requirement 11.5: HTTP 5xx or HTTP 4xx other than 429 -> SERVICE error without fallback.
    throw new GroqClientError("SERVICE");
  } catch (error) {
    if (timedOut || isAbortError(error)) {
      throw new GroqClientError("TIMEOUT");
    }
    if (error instanceof GroqClientError) {
      throw error;
    }
    // Requirement 11.5: network error -> SERVICE error without fallback.
    throw new GroqClientError("SERVICE");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Maps any thrown error from Groq_Client to a safe Indonesian message for the end user,
 * never leaking HTTP status codes, model names, API keys, raw responses, or stack traces (Req 11.6, 11.7).
 */
export function toUserAiErrorMessage(error: unknown): string {
  if (error instanceof GroqClientError) {
    return error.userMessage;
  }
  return AI_SERVICE_ERROR_MESSAGE;
}
