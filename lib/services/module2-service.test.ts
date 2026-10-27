import { describe, expect, it, vi } from "vitest";
import { mockResultFull, mockUrls } from "@/lib/mock/module2";
import {
  DISPATCH_UNAVAILABLE_MESSAGE,
  dispatchToScraperWorker,
  mapDbRowToRadarJob,
  shouldAcceptJobStatusUpdate,
} from "@/lib/services/module2-service";

describe("shouldAcceptJobStatusUpdate (Requirement 21.3)", () => {
  it("accepts forward progressions and ignores backward status transitions", () => {
    expect(shouldAcceptJobStatusUpdate("PENDING", "SCRAPING")).toBe(true);
    expect(shouldAcceptJobStatusUpdate("SCRAPING", "ANALYZING")).toBe(true);
    expect(shouldAcceptJobStatusUpdate("ANALYZING", "COMPLETED")).toBe(true);
    expect(shouldAcceptJobStatusUpdate("SCRAPING", "FAILED")).toBe(true);

    // Backward or post-terminal transitions must be ignored
    expect(shouldAcceptJobStatusUpdate("ANALYZING", "SCRAPING")).toBe(false);
    expect(shouldAcceptJobStatusUpdate("SCRAPING", "PENDING")).toBe(false);
    expect(shouldAcceptJobStatusUpdate("COMPLETED", "ANALYZING")).toBe(false);
    expect(shouldAcceptJobStatusUpdate("FAILED", "SCRAPING")).toBe(false);
  });
});

describe("dispatchToScraperWorker (Requirement 14.2–14.4)", () => {
  it("sends radar_id and X-Worker-Secret header and transitions to SCRAPING on 2xx (Req 14.2, 14.3)", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ accepted: true }), { status: 202 })
    );

    const out = await dispatchToScraperWorker("radar-uuid-123", {
      workerUrl: "https://worker.example.space/",
      workerSecret: "secret-xyz-123",
      fetchFn: fetchMock,
    });

    expect(out).toEqual({ ok: true, nextStatus: "SCRAPING" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://worker.example.space/dispatch");
    expect((init?.headers as Record<string, string>)["X-Worker-Secret"]).toBe("secret-xyz-123");
    expect(JSON.parse(String(init?.body))).toEqual({ radar_id: "radar-uuid-123" });
  });

  it("transitions to FAILED with DISPATCH_UNAVAILABLE_MESSAGE on non-2xx, network error, or 5s timeout (Req 14.4)", async () => {
    const non2xxFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response("error", { status: 502 }));
    expect(
      await dispatchToScraperWorker("radar-1", {
        workerUrl: "https://worker.example.space",
        workerSecret: "secret",
        fetchFn: non2xxFetch,
      })
    ).toEqual({
      ok: false,
      nextStatus: "FAILED",
      errorMessage: DISPATCH_UNAVAILABLE_MESSAGE,
    });

    const slowFetch: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });

    expect(
      await dispatchToScraperWorker("radar-2", {
        workerUrl: "https://worker.example.space",
        workerSecret: "secret",
        timeoutMs: 30,
        fetchFn: slowFetch,
      })
    ).toEqual({
      ok: false,
      nextStatus: "FAILED",
      errorMessage: DISPATCH_UNAVAILABLE_MESSAGE,
    });
  });
});

describe("mapDbRowToRadarJob (Requirement 21.6, 21.9)", () => {
  it("re-validates COMPLETED result with Response_Guard and recovers malformed JSON without crashing", () => {
    const cleanRow = mapDbRowToRadarJob({
      id: "job-1",
      user_id: "user-1",
      maps_urls: mockUrls,
      status: "COMPLETED",
      result: mockResultFull,
      failed_competitors: [],
      error_message: null,
      is_degraded: false,
      created_at: "2026-10-20T00:00:00.000Z",
    });
    expect(cleanRow.is_degraded).toBe(false);
    expect(cleanRow.result).toEqual(mockResultFull);

    const corruptedRow = mapDbRowToRadarJob({
      id: "job-2",
      user_id: "user-1",
      maps_urls: mockUrls,
      status: "COMPLETED",
      result: { market_overview: {} }, // missing fields
      failed_competitors: [{ maps_url: mockUrls[2], reason: "URL Google Maps tidak dapat dikenali" }],
      error_message: null,
      is_degraded: false,
      created_at: "2026-10-20T00:00:00.000Z",
    });
    expect(corruptedRow.is_degraded).toBe(true);
    expect(corruptedRow.result?.market_overview.dominant_market_complaint).toBe("Data tidak tersedia");
    expect(corruptedRow.failed_competitors).toHaveLength(1);
  });
});
