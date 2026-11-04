import { NextResponse } from "next/server";
import {
  mapDbRowToModule1Analysis,
  runModule1Step1Ai,
  type Module1DbRow,
} from "@/lib/services/module1-service";
import { requireAuthenticatedUser } from "@/lib/supabase/server";
import { validateIdeaForm } from "@/lib/validation/idea-form";

const DB_SAVE_ERROR = "Analisis gagal dimulai. Periksa koneksi Anda lalu coba lagi.";
const NOT_FOUND_ERROR = "Analisis ini tidak ditemukan atau bukan milik akun Anda.";

export const maxDuration = 60;

/**
 * POST /api/module1/step1
 * Handles both initial submission (`{ input }`) and Step 1 retry (`{ analysis_id }`)
 * within a single 10-second server invocation (Requirement 1.3, 4.4–4.10, 5.1–5.3, 5.8, 5.11).
 */
export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return auth.response;
  }

  let body: { input?: unknown; analysis_id?: unknown };
  try {
    body = (await request.json()) as { input?: unknown; analysis_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const { supabase, user, isDemo } = auth;
  let targetRow: Module1DbRow;
  let persistedInDb = !isDemo;

  if (typeof body.analysis_id === "string" && body.analysis_id.trim().length > 0) {
    // Retry Step 1 on an existing Module1_Analysis row (Requirement 5.8).
    const analysisId = body.analysis_id.trim();
    const { data: existing, error: fetchErr } = await supabase
      .from("module1_analyses")
      .select("*")
      .eq("id", analysisId)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !existing) {
      if (isDemo && body.input) {
        const validation = validateIdeaForm(body.input);
        if (!validation.success) {
          return NextResponse.json(
            { error: "Periksa kembali isian formulir ide produk.", fieldErrors: validation.errors },
            { status: 400 }
          );
        }
        persistedInDb = false;
        targetRow = {
          id: analysisId,
          user_id: user.id,
          product_idea: validation.data.product_idea,
          category: validation.data.category,
          initial_capital_idr: validation.data.initial_capital_idr,
          target_city: validation.data.target_city,
          step1_status: "RUNNING",
          step2_status: "IDLE",
          step1_result: null,
          step2_result: null,
          step1_model: null,
          step2_model: null,
          is_degraded: false,
          created_at: new Date().toISOString(),
        };
      } else {
        return NextResponse.json({ error: NOT_FOUND_ERROR }, { status: 404 });
      }
    } else {
      const { data: updatedRunning, error: updateRunningErr } = await supabase
        .from("module1_analyses")
        .update({
          step1_status: "RUNNING",
          step2_status: "IDLE",
          step1_result: null,
          step2_result: null,
          step1_model: null,
          step2_model: null,
          is_degraded: false,
        })
        .eq("id", analysisId)
        .eq("user_id", user.id)
        .select("*")
        .single();

      if (updateRunningErr || !updatedRunning) {
        return NextResponse.json({ error: DB_SAVE_ERROR }, { status: 500 });
      }
      targetRow = updatedRunning as Module1DbRow;
    }
  } else {
    // New Step 1 submission: re-validate all 4 fields server-side with shared Zod schema (Req 4.4, 4.6, 4.9).
    const validation = validateIdeaForm(body.input);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Periksa kembali isian formulir ide produk.",
          fieldErrors: validation.errors,
        },
        { status: 400 }
      );
    }

    if (isDemo) {
      persistedInDb = false;
      const randomSuffix = Math.random().toString(36).slice(2, 5);
      targetRow = {
        id: `lt-${Date.now().toString(36).slice(-5)}${randomSuffix}`,
        user_id: user.id,
        product_idea: validation.data.product_idea,
        category: validation.data.category,
        initial_capital_idr: validation.data.initial_capital_idr,
        target_city: validation.data.target_city,
        step1_status: "RUNNING",
        step2_status: "IDLE",
        step1_result: null,
        step2_result: null,
        step1_model: null,
        step2_model: null,
        is_degraded: false,
        created_at: new Date().toISOString(),
      };
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("module1_analyses")
        .insert({
          user_id: user.id,
          product_idea: validation.data.product_idea,
          category: validation.data.category,
          initial_capital_idr: validation.data.initial_capital_idr,
          target_city: validation.data.target_city,
          step1_status: "RUNNING",
          step2_status: "IDLE",
          step1_result: null,
          step2_result: null,
          is_degraded: false,
        })
        .select("*")
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json({ error: DB_SAVE_ERROR }, { status: 500 });
      }
      targetRow = inserted as Module1DbRow;
    }
  }

  const outcome = await runModule1Step1Ai({
    product_idea: targetRow.product_idea,
    category: targetRow.category,
    initial_capital_idr: Number(targetRow.initial_capital_idr),
    target_city: targetRow.target_city,
  });

  if (!outcome.ok) {
    // Requirement 5.8 & 5.11: mark step1_status as FAILED, do not save partial step1_result, preserve input.
    const { data: failedRow } = persistedInDb
      ? await supabase
          .from("module1_analyses")
          .update({
            step1_status: "FAILED",
            step1_result: null,
          })
          .eq("id", targetRow.id)
          .eq("user_id", user.id)
          .select("*")
          .single()
      : { data: null };

    const mapped = mapDbRowToModule1Analysis(
      (failedRow as Module1DbRow | null) ?? {
        ...targetRow,
        step1_status: "FAILED",
        step1_result: null,
      }
    );

    return NextResponse.json({
      analysis: mapped,
      error: outcome.userError,
    });
  }

  if (!persistedInDb) {
    return NextResponse.json({
      analysis: mapDbRowToModule1Analysis({
        ...targetRow,
        step1_status: "SUCCESS",
        step1_result: outcome.result,
        step1_model: outcome.modelUsed,
        is_degraded: outcome.isDegraded,
      }),
    });
  }

  const { data: successRow, error: saveSuccessErr } = await supabase
    .from("module1_analyses")
    .update({
      step1_status: "SUCCESS",
      step1_result: outcome.result,
      step1_model: outcome.modelUsed,
      is_degraded: outcome.isDegraded,
    })
    .eq("id", targetRow.id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (saveSuccessErr || !successRow) {
    return NextResponse.json(
      {
        analysis: mapDbRowToModule1Analysis({
          ...targetRow,
          step1_status: "FAILED",
          step1_result: null,
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
