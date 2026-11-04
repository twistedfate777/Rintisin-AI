import type {
  FailedCompetitor,
  GroqModelId,
  JobStatus,
  Module2Result,
  RadarJob,
} from "@/lib/types";
import { guardStoredModule2 } from "@/lib/validation/response-guard";

// ============================================================================
// Constants & Status Ordering (Requirement 14.3, 14.4, 20.5, 21.3)
// ============================================================================

export const DISPATCH_TIMEOUT_MS = 5_000;
export const JOB_TIMEOUT_MS = 300_000;
export const DISPATCH_UNAVAILABLE_MESSAGE =
  "Server analisis sedang tidak tersedia. Silakan coba lagi.";
export const ACTIVE_JOB_CONFLICT_MESSAGE =
  "Masih ada analisis kompetitor yang sedang berjalan. Tunggu sampai selesai.";
export const JOB_CREATE_FAILED_MESSAGE =
  "Analisis gagal dimulai. Periksa koneksi Anda lalu coba lagi.";

const STAGE_RANK: Record<JobStatus, number> = {
  PENDING: 0,
  SCRAPING: 1,
  ANALYZING: 2,
  COMPLETED: 3,
  FAILED: 3,
};

/**
 * Requirement 21.3: Returns true only when `incoming` is at the same or a later stage
 * than `current` (`PENDING < SCRAPING < ANALYZING < COMPLETED/FAILED`).
 * Once in a terminal status, further changes are ignored.
 */
export function shouldAcceptJobStatusUpdate(current: JobStatus, incoming: JobStatus): boolean {
  if (current === "COMPLETED" || current === "FAILED") {
    return false;
  }
  return STAGE_RANK[incoming] >= STAGE_RANK[current];
}

// ============================================================================
// Database Row Mapping (Requirement 12.7, 12.12, 21.6, 21.9)
// ============================================================================

export interface RadarJobDbRow {
  id: string;
  user_id: string;
  maps_urls: unknown;
  status: JobStatus;
  result: unknown | null;
  failed_competitors: unknown;
  error_message: string | null;
  map_models?: GroqModelId[] | null;
  reduce_model?: GroqModelId | null;
  is_degraded: boolean;
  created_at: string;
}

function sanitizeFailedCompetitors(raw: unknown): FailedCompetitor[] {
  if (!Array.isArray(raw)) return [];
  const items: FailedCompetitor[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === "object") {
      const rec = entry as Record<string, unknown>;
      if (typeof rec.maps_url === "string" && typeof rec.reason === "string") {
        items.push({ maps_url: rec.maps_url, reason: rec.reason });
      }
    }
  }
  return items;
}

function sanitizeMapsUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

/**
 * Maps a `public.module2_radars` row to `RadarJob`, re-validating `result` with
 * Response_Guard when status is `COMPLETED` (Requirement 12.7, 21.6, 21.9).
 */
export function mapDbRowToRadarJob(row: RadarJobDbRow): RadarJob {
  let isDegraded = Boolean(row.is_degraded);
  let result: Module2Result | null = null;

  if (row.status === "COMPLETED") {
    const guarded = guardStoredModule2(row.result, isDegraded);
    result = guarded.data;
    isDegraded = isDegraded || guarded.is_degraded;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    maps_urls: sanitizeMapsUrls(row.maps_urls),
    status: row.status,
    result,
    failed_competitors: sanitizeFailedCompetitors(row.failed_competitors),
    error_message: row.error_message ?? null,
    map_models: Array.isArray(row.map_models) ? row.map_models : null,
    reduce_model: row.reduce_model ?? null,
    is_degraded: isDegraded,
  };
}

// ============================================================================
// Worker Dispatch (Requirement 14.2, 14.3, 14.4)
// ============================================================================

export interface DispatchWorkerOptions {
  workerUrl?: string;
  workerSecret?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export type DispatchOutcome =
  | { ok: true; nextStatus: "SCRAPING"; mode?: "external" | "inprocess" }
  | { ok: false; nextStatus: "FAILED"; errorMessage: string };

/**
 * Returns true only when an external Scraper_Worker URL is explicitly configured
 * (and is not the template placeholder or `"internal"` / `"vercel"`).
 */
export function isExternalWorkerConfigured(rawUrl?: string): boolean {
  const url = (rawUrl ?? process.env.SCRAPER_WORKER_URL ?? "").trim();
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower === "internal" || lower === "vercel") return false;
  if (lower.includes("<space-name>")) return false;
  if (lower.includes(".vercel.app") || lower.includes("localhost:3000")) return false;
  return true;
}

/**
 * Dispatches `{ radar_id }` to Scraper_Worker with Worker_Secret header and a 5-second timeout.
 * Only waits for acknowledgment (HTTP 2xx), never for scraping or LLM analysis (Req 14.2–14.4).
 */
export async function dispatchToScraperWorker(
  radarId: string,
  options: DispatchWorkerOptions = {}
): Promise<DispatchOutcome> {
  const baseUrl = (options.workerUrl ?? process.env.SCRAPER_WORKER_URL ?? "").trim().replace(/\/+$/, "");
  const secret = options.workerSecret ?? process.env.WORKER_SECRET ?? "";
  const timeoutMs = options.timeoutMs ?? DISPATCH_TIMEOUT_MS;
  const fetchImpl = options.fetchFn ?? globalThis.fetch;

  if (!baseUrl || !secret) {
    return {
      ok: false,
      nextStatus: "FAILED",
      errorMessage: DISPATCH_UNAVAILABLE_MESSAGE,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": secret,
      },
      body: JSON.stringify({ radar_id: radarId }),
      signal: controller.signal,
    });

    if (response.ok) {
      return { ok: true, nextStatus: "SCRAPING" };
    }

    return {
      ok: false,
      nextStatus: "FAILED",
      errorMessage: DISPATCH_UNAVAILABLE_MESSAGE,
    };
  } catch {
    return {
      ok: false,
      nextStatus: "FAILED",
      errorMessage: DISPATCH_UNAVAILABLE_MESSAGE,
    };
  } finally {
    clearTimeout(timer);
  }
}
