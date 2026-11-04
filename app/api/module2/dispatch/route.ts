import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { after, NextResponse } from "next/server";
import { runInProcessRadarPipeline } from "@/lib/services/module2-inprocess-worker";
import {
  ACTIVE_JOB_CONFLICT_MESSAGE,
  JOB_CREATE_FAILED_MESSAGE,
  JOB_TIMEOUT_MS,
  dispatchToScraperWorker,
  isExternalWorkerConfigured,
  mapDbRowToRadarJob,
  type RadarJobDbRow,
} from "@/lib/services/module2-service";
import { createSupabaseFetch, getSupabaseConfig } from "@/lib/supabase/env";
import { requireAuthenticatedUser } from "@/lib/supabase/server";
import { validateCompetitorForm } from "@/lib/validation/competitor-form";

// Allow up to 60 seconds on Vercel Hobby for background `after()` execution.
export const maxDuration = 60;

const MISSING_TABLE_MESSAGE =
  "Tabel database module2_radars belum ditemukan di Supabase. Jalankan file supabase/migrations/0001_init_rintisin_schema.sql di SQL Editor Supabase Anda.";

async function createBackgroundSupabaseClient(requestClient: SupabaseClient): Promise<SupabaseClient> {
  try {
    const { url, publishableKey } = getSupabaseConfig();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, "");
    if (serviceRoleKey) {
      return createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: createSupabaseFetch(url, serviceRoleKey),
          headers: { apikey: serviceRoleKey },
        },
      });
    }

    const {
      data: { session },
    } = await requestClient.auth.getSession();
    const accessToken = session?.access_token;
    return createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: createSupabaseFetch(url, publishableKey),
        headers: {
          apikey: publishableKey,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      },
    });
  } catch {
    return requestClient;
  }
}

function isMissingTableError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const code = (err.code ?? "").toUpperCase();
  const msg = (err.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("module2_radars") && (msg.includes("does not exist") || msg.includes("schema cache"))
  );
}

/**
 * POST /api/module2/dispatch
 * Validates URLs server-side, checks for any active Radar_Job belonging to the user,
 * inserts a PENDING Radar_Job, and either:
 * - Dispatches `{ radar_id }` to external Scraper_Worker when `SCRAPER_WORKER_URL` is configured, OR
 * - Runs the built-in Vercel/Next.js in-process pipeline via `after()` when `SCRAPER_WORKER_URL`
 *   is unset / `"vercel"` / `"internal"`.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) {
      return auth.response;
    }

    let body: { urls?: unknown };
    try {
      body = (await request.json()) as { urls?: unknown };
    } catch {
      return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
    }

    if (!Array.isArray(body.urls)) {
      return NextResponse.json(
        { error: "Daftar URL kompetitor tidak valid.", fieldErrors: { 0: "Isi URL Google Maps kompetitor." } },
        { status: 400 }
      );
    }

    const rawUrls = body.urls.map((u) => (typeof u === "string" ? u : ""));
    const validation = validateCompetitorForm(rawUrls);
    if (!validation.success) {
      // Requirement 13.5: do not create Radar_Job, return per-field validation messages.
      return NextResponse.json(
        {
          error: "Periksa kembali URL Google Maps kompetitor yang Anda masukkan.",
          fieldErrors: validation.errors,
        },
        { status: 400 }
      );
    }

    const { supabase, user, isDemo } = auth;
    if (isDemo) {
      return NextResponse.json({ demoFallback: true });
    }

    // Requirement 13.7: reject if user still has an active Radar_Job (PENDING, SCRAPING, or ANALYZING)
    // that has not exceeded the 300-second timeout (Requirement 20.5).
    const timeoutMs = typeof JOB_TIMEOUT_MS === "number" && Number.isFinite(JOB_TIMEOUT_MS) ? JOB_TIMEOUT_MS : 300_000;
    const cutoffIso = new Date(Date.now() - timeoutMs).toISOString();
    const { data: activeRows, error: activeCheckErr } = await supabase
      .from("module2_radars")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .in("status", ["PENDING", "SCRAPING", "ANALYZING"])
      .gt("created_at", cutoffIso)
      .limit(1);

    if (activeCheckErr) {
      console.error("[module2/dispatch] activeCheckErr:", activeCheckErr);
      if (isMissingTableError(activeCheckErr)) {
        return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 500 });
      }
      return NextResponse.json({ error: JOB_CREATE_FAILED_MESSAGE }, { status: 500 });
    }

    if (activeRows && activeRows.length > 0) {
      return NextResponse.json({ error: ACTIVE_JOB_CONFLICT_MESSAGE }, { status: 409 });
    }

    // Requirement 14.1: create exactly one Radar_Job with user_id from session, input URLs in order, status PENDING.
    let { data: inserted, error: insertErr } = await supabase
      .from("module2_radars")
      .insert({
        user_id: user.id,
        maps_urls: validation.urls,
        status: "PENDING",
        result: null,
        failed_competitors: [],
        error_message: null,
        is_degraded: false,
      })
      .select("*")
      .single();

    if (insertErr && (insertErr.code === "PGRST204" || insertErr.message?.includes("column"))) {
      // Fallback if the user's table was created without optional columns like `is_degraded`
      const fallbackInsert = await supabase
        .from("module2_radars")
        .insert({
          user_id: user.id,
          maps_urls: validation.urls,
          status: "PENDING",
        })
        .select("*")
        .single();
      inserted = fallbackInsert.data;
      insertErr = fallbackInsert.error;
    }

    if (insertErr || !inserted) {
      console.error("[module2/dispatch] insertErr:", insertErr);
      if (isMissingTableError(insertErr)) {
        return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 500 });
      }
      // Requirement 14.6: do not dispatch to Scraper_Worker if DB insert fails.
      return NextResponse.json({ error: JOB_CREATE_FAILED_MESSAGE }, { status: 500 });
    }

    const createdRow = inserted as RadarJobDbRow;
    const useExternalWorker = isExternalWorkerConfigured();

    const dispatchOutcome = useExternalWorker
      ? await dispatchToScraperWorker(createdRow.id)
      : ({ ok: true, nextStatus: "SCRAPING", mode: "inprocess" } as const);

    const updatePayload = dispatchOutcome.ok
      ? { status: "SCRAPING" as const, error_message: null }
      : { status: "FAILED" as const, error_message: dispatchOutcome.errorMessage };

    const { data: updated } = await supabase
      .from("module2_radars")
      .update(updatePayload)
      .eq("id", createdRow.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    const finalRow = (updated as RadarJobDbRow | null) ?? {
      ...createdRow,
      ...updatePayload,
    };

    if (!useExternalWorker && dispatchOutcome.ok) {
      const bgSupabase = await createBackgroundSupabaseClient(supabase);
      after(async () => {
        await runInProcessRadarPipeline(bgSupabase, createdRow.id, user.id, validation.urls);
      });
    }

    return NextResponse.json({
      job: mapDbRowToRadarJob(finalRow),
    });
  } catch (err) {
    console.error("[module2/dispatch] unhandled error:", err);
    return NextResponse.json({ error: JOB_CREATE_FAILED_MESSAGE }, { status: 500 });
  }
}
