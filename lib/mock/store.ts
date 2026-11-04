"use client";

import { useEffect, useSyncExternalStore } from "react";
import { mockModule1History } from "@/lib/mock/module1";
import { mockRadarHistory } from "@/lib/mock/module2";
import { mapDbRowToModule1Analysis, type Module1DbRow } from "@/lib/services/module1-service";
import { mapDbRowToRadarJob, type RadarJobDbRow } from "@/lib/services/module2-service";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEMO_SESSION_COOKIE } from "@/lib/supabase/demo-auth";
import type { Module1Analysis, RadarJob } from "@/lib/types";

function hasBrowserDemoCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${DEMO_SESSION_COOKIE}=`));
}

function createStore<T extends { id: string; created_at: string }>(initial: T[]) {
  let rows = initial;
  let hydratedFromDb = false;
  let hydrating = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => rows,
    getServerSnapshot: () => initial,
    isHydrated: () => hydratedFromDb,
    isHydrating: () => hydrating,
    setHydrating(value: boolean) {
      hydrating = value;
    },
    replaceAll(nextRows: T[]) {
      rows = nextRows;
      hydratedFromDb = true;
      emit();
    },
    upsert(row: T) {
      const exists = rows.some((r) => r.id === row.id);
      rows = exists ? rows.map((r) => (r.id === row.id ? row : r)) : [row, ...rows];
      emit();
    },
    remove(id: string) {
      rows = rows.filter((r) => r.id !== id);
      emit();
    },
  };
}

export const module1Store = createStore<Module1Analysis>([]);
export const radarStore = createStore<RadarJob>([]);

function byNewest<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function refreshModule1StoreFromDb(): Promise<void> {
  if (module1Store.isHydrating()) return;
  module1Store.setHydrating(true);
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      if (hasBrowserDemoCookie() && module1Store.getSnapshot().length === 0) {
        module1Store.replaceAll(mockModule1History);
      }
      return;
    }

    const { data, error } = await supabase
      .from("module1_analyses")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      module1Store.replaceAll((data as Module1DbRow[]).map(mapDbRowToModule1Analysis));
    }
  } catch {
    if (hasBrowserDemoCookie() && module1Store.getSnapshot().length === 0) {
      module1Store.replaceAll(mockModule1History);
    }
  } finally {
    module1Store.setHydrating(false);
  }
}

export async function refreshRadarStoreFromDb(): Promise<void> {
  if (radarStore.isHydrating()) return;
  radarStore.setHydrating(true);
  try {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      if (hasBrowserDemoCookie() && radarStore.getSnapshot().length === 0) {
        radarStore.replaceAll(mockRadarHistory);
      }
      return;
    }

    // Requirement 24.1: at most 20 entries per page, sorted descending by created_at.
    const { data, error } = await supabase
      .from("module2_radars")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && Array.isArray(data)) {
      radarStore.replaceAll((data as RadarJobDbRow[]).map(mapDbRowToRadarJob));
    }
  } catch {
    if (hasBrowserDemoCookie() && radarStore.getSnapshot().length === 0) {
      radarStore.replaceAll(mockRadarHistory);
    }
  } finally {
    radarStore.setHydrating(false);
  }
}

export function useModule1Rows(): Module1Analysis[] {
  const rows = useSyncExternalStore(
    module1Store.subscribe,
    module1Store.getSnapshot,
    module1Store.getServerSnapshot
  );

  useEffect(() => {
    if (!module1Store.isHydrated()) {
      void refreshModule1StoreFromDb();
    }
  }, []);

  return byNewest(rows);
}

export function useRadarRows(): RadarJob[] {
  const rows = useSyncExternalStore(
    radarStore.subscribe,
    radarStore.getSnapshot,
    radarStore.getServerSnapshot
  );

  useEffect(() => {
    if (!radarStore.isHydrated()) {
      void refreshRadarStoreFromDb();
    }
  }, []);

  return byNewest(rows);
}

const MODULE1_DELETE_FAILED = "Penghapusan analisis gagal. Silakan coba lagi.";
const MODULE2_DELETE_FAILED = "Penghapusan analisis kompetitor gagal. Silakan coba lagi.";

function isMockRecordId(id: string): boolean {
  return id.startsWith("lt-") || id.startsWith("ps-") || id.startsWith("demo-");
}

/**
 * Deletes a Module1_Analysis row that has no step currently RUNNING (Requirement 10.4, 10.7).
 * Only removes the row from the UI list after Database deletion succeeds.
 */
export async function deleteModule1Analysis(
  row: Module1Analysis
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (row.step1_status === "RUNNING" || row.step2_status === "RUNNING") {
    return { ok: false, error: "Analisis yang sedang diproses tidak dapat dihapus." };
  }

  if (isMockRecordId(row.id)) {
    module1Store.remove(row.id);
    return { ok: true };
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("module1_analyses")
      .delete()
      .eq("id", row.id)
      .neq("step1_status", "RUNNING")
      .neq("step2_status", "RUNNING");

    if (error) {
      return { ok: false, error: MODULE1_DELETE_FAILED };
    }

    module1Store.remove(row.id);
    return { ok: true };
  } catch {
    return { ok: false, error: MODULE1_DELETE_FAILED };
  }
}

/**
 * Deletes a Radar_Job row that has reached Status_Terminal (Requirement 24.3, 24.4, 24.5).
 * Re-verifies terminal status at deletion time and keeps the row if Database deletion fails.
 */
export async function deleteRadarJob(
  job: RadarJob
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (job.status !== "COMPLETED" && job.status !== "FAILED") {
    return { ok: false, error: MODULE2_DELETE_FAILED };
  }

  if (isMockRecordId(job.id)) {
    radarStore.remove(job.id);
    return { ok: true };
  }

  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("module2_radars")
      .delete()
      .eq("id", job.id)
      .in("status", ["COMPLETED", "FAILED"])
      .select("id");

    if (error || !data || data.length === 0) {
      return { ok: false, error: MODULE2_DELETE_FAILED };
    }

    radarStore.remove(job.id);
    return { ok: true };
  } catch {
    return { ok: false, error: MODULE2_DELETE_FAILED };
  }
}

let counter = 0;
/** A short mock id; the real ids are database UUIDs. */
export function mockId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36).slice(-5)}${counter}`;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
