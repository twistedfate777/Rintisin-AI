import { NextResponse } from "next/server";
import {
  mapDbRowToModule1Analysis,
  runModule1Step2Ai,
  type Module1DbRow,
} from "@/lib/services/module1-service";
import { requireAuthenticatedUser } from "@/lib/supabase/server";
import type { Module1Analysis } from "@/lib/types";
import { guardStoredStep1 } from "@/lib/validation/response-guard";

const NOT_FOUND_ERROR = "Analisis ini tidak ditemukan atau bukan milik akun Anda.";
const STEP1_INCOMPLETE_ERROR = "Langkah 1 belum selesai. Jalankan Langkah 1 terlebih dahulu.";
const DB_SAVE_ERROR = "Gagal menyimpan hasil Langkah 2. Silakan coba lagi.";

export const maxDuration = 60;

/**
 * POST /api/module1/step2
 * Executes Modul_1 Langkah_2 using context derived strictly from the stored Langkah_1 result,
 * preserving Langkah_1 data whether Langkah_2 succeeds or fails (Requirement 1.3, 5.4–5.7, 5.11).
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return auth.response;
  }

  let body: { analysis_id?: unknown; analysis?: unknown };
  try {
    body = (await request.json()) as { analysis_id?: unknown; analysis?: unknown };
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const analysisId = typeof body.analysis_id === "string" ? body.analysis_id.trim() : "";
  if (!analysisId) {
    return NextResponse.json({ error: "ID analisis wajib disertakan." }, { status: 400 });
  }

  const { supabase, user, isDemo } = auth;
  let row: Module1DbRow | null = null;
  let persistedInDb = !isDemo;

  if (!isDemo) {
    const { data: existing, error: fetchErr } = await supabase
      .from("module1_analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (!fetchErr && existing) {
      row = existing as Module1DbRow;
    }
  }

  if (!row && isDemo && body.analysis && typeof body.analysis === "object") {
    const clientAnalysis = body.analysis as Module1Analysis;
    if (clientAnalysis.input && clientAnalysis.step1_result) {
      persistedInDb = false;
      row = {
        id: analysisId,
        user_id: user.id,
        product_idea: clientAnalysis.input.product_idea,
        category: clientAnalysis.input.category,
        initial_capital_idr: clientAnalysis.input.initial_capital_idr,
        target_city: clientAnalysis.input.target_city,
        step1_status: clientAnalysis.step1_status,
        step2_status: "RUNNING",
        step1_result: clientAnalysis.step1_result,
        step2_result: null,
        is_degraded: Boolean(clientAnalysis.is_degraded),
        created_at: clientAnalysis.created_at || new Date().toISOString(),
      };
    }
  }

  if (!row) {
    return NextResponse.json({ error: NOT_FOUND_ERROR }, { status: 404 });
  }

  if (row.step1_status !== "SUCCESS" || !row.step1_result) {
    return NextResponse.json({ error: STEP1_INCOMPLETE_ERROR }, { status: 400 });
  }

  if (persistedInDb) {
    await supabase
      .from("module1_analyses")
      .update({ step2_status: "RUNNING", step2_result: null, step2_model: null })
      .eq("id", analysisId)
      .eq("user_id", user.id);
  }

  const guardedStep1 = guardStoredStep1(row.step1_result, row.is_degraded);

  const outcome = await runModule1Step2Ai(
    {
      product_idea: row.product_idea,
      category: row.category,
      initial_capital_idr: Number(row.initial_capital_idr),
      target_city: row.target_city,
    },
    guardedStep1.data
  );

  if (!outcome.ok) {
    // Requirement 5.7 & 5.11: mark step2_status as FAILED, do not overwrite step1_result.
    const { data: failedRow } = persistedInDb
      ? await supabase
          .from("module1_analyses")
          .update({
            step2_status: "FAILED",
            step2_result: null,
          })
          .eq("id", analysisId)
          .eq("user_id", user.id)
          .select("*")
          .single()
      : { data: null };

    return NextResponse.json({
      analysis: mapDbRowToModule1Analysis(
        (failedRow as Module1DbRow | null) ?? {
          ...row,
          step2_status: "FAILED",
          step2_result: null,
        }
      ),
      error: outcome.userError,
    });
  }

  const combinedDegraded = Boolean(row.is_degraded) || guardedStep1.is_degraded || outcome.isDegraded;
  if (!persistedInDb) {
    return NextResponse.json({
      analysis: mapDbRowToModule1Analysis({
        ...row,
        step2_status: "SUCCESS",
        step2_result: outcome.result,
        step2_model: outcome.modelUsed,
        is_degraded: combinedDegraded,
      }),
    });
  }
  const { data: successRow, error: saveErr } = await supabase
    .from("module1_analyses")
    .update({
      step2_status: "SUCCESS",
      step2_result: outcome.result,
      step2_model: outcome.modelUsed,
      is_degraded: combinedDegraded,
    })
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (saveErr || !successRow) {
    return NextResponse.json(
      {
        analysis: mapDbRowToModule1Analysis({
          ...row,
          step2_status: "FAILED",
          step2_result: null,
        }),
        error: DB_SAVE_ERROR,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    analysis: mapDbRowToModule1Analysis(successRow as Module1DbRow),
  });
}
