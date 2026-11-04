"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  mockStep1,
  mockStep1Degraded,
  mockStep2,
  mockStep2Empty,
} from "@/lib/mock/module1";
import { mockId, module1Store, sleep, useModule1Rows } from "@/lib/mock/store";
import { mapDbRowToModule1Analysis, type Module1DbRow } from "@/lib/services/module1-service";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { IdeaInput, Module1Analysis, Step1Result, Step2Result } from "@/lib/types";

export const MODULE1_SCENARIOS = [
  { value: "", label: "Formulir" },
  { value: "selesai", label: "Hasil lengkap" },
  { value: "memuat", label: "Langkah 2 berjalan" },
  { value: "langkah2-gagal", label: "Langkah 2 gagal" },
  { value: "langkah1-gagal", label: "Langkah 1 gagal" },
  { value: "terdegradasi", label: "Data tidak lengkap" },
  { value: "kosong", label: "Daftar kosong" },
] as const;

export type Module1Scenario = (typeof MODULE1_SCENARIOS)[number]["value"];

const STEP1_MS = 1500;
const STEP2_MS = 2000;

const emptyStep1: Step1Result = {
  feasibility_audit: { ...mockStep1.feasibility_audit, operational_risks: [] },
  target_market_mapper: {
    primary_segment: { ...mockStep1.target_market_mapper.primary_segment, core_pain_points: [] },
    effective_channels: [],
  },
};

function resultsFor(scenario: string): { step1: Step1Result; step2: Step2Result; degraded: boolean } {
  if (scenario === "terdegradasi") return { step1: mockStep1Degraded, step2: mockStep2, degraded: true };
  if (scenario === "kosong") return { step1: emptyStep1, step2: mockStep2Empty, degraded: false };
  return { step1: mockStep1, step2: mockStep2, degraded: false };
}

/** A ready-made record for a demo state, so each state can be opened by URL. */
export function demoAnalysis(scenario: string, input: IdeaInput): Module1Analysis | null {
  if (!scenario) return null;
  const { step1, step2, degraded } = resultsFor(scenario);
  const base: Module1Analysis = {
    id: `demo-${scenario}`,
    created_at: "2026-10-19T08:00:00.000Z",
    input,
    step1_status: "SUCCESS",
    step2_status: "SUCCESS",
    step1_result: step1,
    step2_result: step2,
    is_degraded: degraded,
  };
  if (scenario === "langkah1-gagal")
    return { ...base, step1_status: "FAILED", step2_status: "IDLE", step1_result: null, step2_result: null };
  if (scenario === "langkah2-gagal") return { ...base, step2_status: "FAILED", step2_result: null };
  if (scenario === "memuat") return { ...base, step2_status: "RUNNING", step2_result: null };
  return base;
}

function isMockAnalysisId(id: string): boolean {
  return id.startsWith("demo-") || id.startsWith("lt-");
}

interface ApiStepResponse {
  analysis?: Module1Analysis;
  error?: string;
}

function hasMoreCompleteStatus(current: Module1Analysis, candidate: Module1Analysis): boolean {
  if (current.id !== candidate.id) return false;
  const rank = (s: Module1Analysis["step1_status"]) =>
    s === "SUCCESS" || s === "FAILED" ? 2 : s === "RUNNING" ? 1 : 0;
  if (rank(candidate.step1_status) > rank(current.step1_status)) return true;
  if (rank(candidate.step2_status) > rank(current.step2_status)) return true;
  if (!current.step1_result && Boolean(candidate.step1_result)) return true;
  if (!current.step2_result && Boolean(candidate.step2_result)) return true;
  return false;
}

export function useModule1Run(initial: Module1Analysis | null, scenario: string) {
  const [analysis, setAnalysis] = useState<Module1Analysis | null>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const failuresLeft = useRef({ step1: 0, step2: 0 });
  const storeRows = useModule1Rows();

  const commit = useCallback((next: Module1Analysis, persist: boolean) => {
    setAnalysis(next);
    if (persist) module1Store.upsert(next);
  }, []);

  // Keep local state in sync if the store receives a completed update for the active analysis.
  const storeMatch = analysis ? storeRows.find((r) => r.id === analysis.id) : null;
  if (analysis && storeMatch && hasMoreCompleteStatus(analysis, storeMatch)) {
    setAnalysis(storeMatch);
  }

  // Poll DB while Step 1 or Step 2 is RUNNING on a real DB record so the UI never gets stuck
  // if the HTTP response is delayed or the user opened the detail page mid-run.
  useEffect(() => {
    if (!analysis || scenario || isMockAnalysisId(analysis.id)) return;
    const isRunning =
      analysis.step1_status === "RUNNING" || analysis.step2_status === "RUNNING";
    if (!isRunning) return;

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    const pollDb = async () => {
      try {
        const { data, error } = await supabase
          .from("module1_analyses")
          .select("*")
          .eq("id", analysis.id)
          .single();

        if (!cancelled && !error && data) {
          const mapped = mapDbRowToModule1Analysis(data as Module1DbRow);
          if (hasMoreCompleteStatus(analysis, mapped)) {
            commit(mapped, true);
          }
        }
      } catch {
        // Ignore transient network errors during background poll.
      }
    };

    const intervalId = window.setInterval(() => {
      void pollDb();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [analysis, scenario, commit]);

  const runDemoStep2 = useCallback(
    async (afterStep1: Module1Analysis, persist: boolean) => {
      const running: Module1Analysis = { ...afterStep1, step2_status: "RUNNING", step2_result: null };
      commit(running, persist);
      await sleep(STEP2_MS);
      if (failuresLeft.current.step2 > 0) {
        failuresLeft.current.step2 -= 1;
        commit({ ...running, step2_status: "FAILED" }, persist);
        return;
      }
      commit({ ...running, step2_status: "SUCCESS", step2_result: resultsFor(scenario).step2 }, persist);
    },
    [commit, scenario]
  );

  const runDemoStep1 = useCallback(
    async (base: Module1Analysis, persist: boolean) => {
      const running: Module1Analysis = {
        ...base,
        step1_status: "RUNNING",
        step2_status: "IDLE",
        step1_result: null,
        step2_result: null,
      };
      commit(running, persist);
      await sleep(STEP1_MS);
      if (failuresLeft.current.step1 > 0) {
        failuresLeft.current.step1 -= 1;
        commit({ ...running, step1_status: "FAILED" }, persist);
        return;
      }
      const { step1, degraded } = resultsFor(scenario);
      const done: Module1Analysis = {
        ...running,
        step1_status: "SUCCESS",
        step1_result: step1,
        is_degraded: degraded,
      };
      commit(done, persist);
      await runDemoStep2(done, persist);
    },
    [commit, runDemoStep2, scenario]
  );

  const runServerStep2 = useCallback(
    async (afterStep1: Module1Analysis) => {
      // Requirement 5.3 & 5.12: keep Step 1 result visible while Step 2 shows skeleton.
      const running: Module1Analysis = {
        ...afterStep1,
        step2_status: "RUNNING",
        step2_result: null,
      };
      commit(running, true);

      try {
        const res = await fetch("/api/module1/step2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysis_id: afterStep1.id, analysis: afterStep1 }),
        });
        const payload = (await res.json()) as ApiStepResponse;
        if (payload.analysis) {
          commit(payload.analysis, true);
          return;
        }
        commit({ ...running, step2_status: "FAILED", step2_result: null }, true);
      } catch {
        commit({ ...running, step2_status: "FAILED", step2_result: null }, true);
      }
    },
    [commit]
  );

  const runServerStep1 = useCallback(
    async (params: { input?: IdeaInput; analysisRow?: Module1Analysis }) => {
      setServerError(null);
      if (params.analysisRow) {
        commit(
          {
            ...params.analysisRow,
            step1_status: "RUNNING",
            step2_status: "IDLE",
            step1_result: null,
            step2_result: null,
          },
          true
        );
      }

      try {
        const res = await fetch("/api/module1/step1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            params.analysisRow ? { analysis_id: params.analysisRow.id } : { input: params.input }
          ),
        });
        const payload = (await res.json()) as ApiStepResponse;

        if (!payload.analysis) {
          // Pre-DB validation or auth failure: keep IdeaForm mounted and show error (Req 4.9, 4.10).
          if (params.analysisRow) {
            commit({ ...params.analysisRow, step1_status: "FAILED" }, true);
          } else {
            setServerError(
              payload.error ?? "Analisis gagal dimulai. Periksa kembali isian atau coba lagi."
            );
          }
          return;
        }

        commit(payload.analysis, true);
        if (payload.analysis.step1_status === "SUCCESS" && payload.analysis.step1_result) {
          await runServerStep2(payload.analysis);
        }
      } catch {
        if (params.analysisRow) {
          commit({ ...params.analysisRow, step1_status: "FAILED" }, true);
        } else {
          setServerError("Layanan AI sedang tidak tersedia. Silakan coba lagi.");
        }
      }
    },
    [commit, runServerStep2]
  );

  const guard = useCallback(async (task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    try {
      await task();
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  }, []);

  /** Demo records (id "demo-…") are not written to the history store. */
  const persistOf = (row: Module1Analysis) => !row.id.startsWith("demo-");

  const start = (input: IdeaInput) =>
    guard(() => {
      if (scenario) {
        failuresLeft.current = {
          step1: scenario === "langkah1-gagal" ? 1 : 0,
          step2: scenario === "langkah2-gagal" ? 1 : 0,
        };
        return runDemoStep1(
          {
            id: mockId("lt"),
            created_at: new Date().toISOString(),
            input,
            step1_status: "IDLE",
            step2_status: "IDLE",
            step1_result: null,
            step2_result: null,
            is_degraded: false,
          },
          true
        );
      }
      return runServerStep1({ input });
    });

  const retryStep1 = () =>
    guard(async () => {
      if (!analysis) return;
      if (scenario || isMockAnalysisId(analysis.id)) {
        await runDemoStep1(analysis, persistOf(analysis));
        return;
      }
      await runServerStep1({ analysisRow: analysis });
    });

  const retryStep2 = () =>
    guard(async () => {
      if (!analysis?.step1_result) return;
      if (scenario || isMockAnalysisId(analysis.id)) {
        await runDemoStep2(analysis, persistOf(analysis));
        return;
      }
      await runServerStep2(analysis);
    });

  const reset = () => {
    if (!busyRef.current) {
      setServerError(null);
      setAnalysis(null);
    }
  };

  return { analysis, submitting, serverError, start, retryStep1, retryStep2, reset };
}
