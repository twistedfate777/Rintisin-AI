"use client";

import { useEffect, useSyncExternalStore } from "react";
import { mockModule1History } from "@/lib/mock/module1";
import { mockRadarHistory } from "@/lib/mock/module2";
import { mapDbRowToModule1Analysis, type Module1DbRow } from "@/lib/services/module1-service";
import { mapDbRowToRadarJob, type RadarJobDbRow } from "@/lib/services/module2-service";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEMO_SESSION_COOKIE } from "@/lib/supabase/demo-auth";
import type { Module1Analysis, RadarJob } from "@/lib/types";

const DEMO_MODULE1_STORAGE_KEY = "rintisin_demo_module1_rows_v1";
const DEMO_RADAR_STORAGE_KEY = "rintisin_demo_radar_rows_v1";

function hasBrowserDemoCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${DEMO_SESSION_COOKIE}=`));
}

function readDemoStorage<T>(key: string, fallback: T[]): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function writeDemoStorage<T>(key: string, rows: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // Ignore storage quota/security errors.
  }
}

function mergeRowsById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of incoming) {
    map.set(row.id, row);
  }
  // Keep in-memory rows (e.g. newly created or in-progress analyses) on top of incoming rows.
  for (const row of current) {
    map.set(row.id, row);
  }
  return Array.from(map.values());
}

function createStore<T extends { id: string; created_at: string }>(
  initial: T[],
  demoStorageKey: string
) {
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
      if (hasBrowserDemoCookie()) {
        writeDemoStorage(demoStorageKey, rows);
      }
      emit();
    },
    upsert(row: T) {
      if (hasBrowserDemoCookie() && !hydratedFromDb) {
        const stored = readDemoStorage<T>(demoStorageKey, initial);
        rows = mergeRowsById(rows, stored);
        hydratedFromDb = true;
      }
      const exists = rows.some((r) => r.id === row.id);
      rows = exists ? rows.map((r) => (r.id === row.id ? row : r)) : [row, ...rows];
      if (hasBrowserDemoCookie()) {
        writeDemoStorage(demoStorageKey, rows);
      }
      emit();
    },
    remove(id: string) {
      rows = rows.filter((r) => r.id !== id);
      if (hasBrowserDemoCookie()) {
        writeDemoStorage(demoStorageKey, rows);
      }
      emit();
    },
  };
}

export const module1Store = createStore<Module1Analysis>([], DEMO_MODULE1_STORAGE_KEY);
export const radarStore = createStore<RadarJob>([], DEMO_RADAR_STORAGE_KEY);

function byNewest<T extends { created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function refreshModule1StoreFromDb(): Promise<void> {
  if (module1Store.isHydrating()) return;
  module1Store.setHydrating(true);
  try {
    if (hasBrowserDemoCookie()) {
      const stored = readDemoStorage(DEMO_MODULE1_STORAGE_KEY, mockModule1History);
      const merged = mergeRowsById(module1Store.getSnapshot(), stored);
      module1Store.replaceAll(merged);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return;
    }

    const { data, error } = await supabase
      .from("module1_analyses")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      const dbRows = (data as Module1DbRow[]).map(mapDbRowToModule1Analysis);
      const localMockRows = module1Store
        .getSnapshot()
        .filter((r) => isMockRecordId(r.id) && !r.id.startsWith("demo-"));
      module1Store.replaceAll(mergeRowsById(localMockRows, dbRows));
    }
  } catch {
    if (hasBrowserDemoCookie()) {
      const stored = readDemoStorage(DEMO_MODULE1_STORAGE_KEY, mockModule1History);
      module1Store.replaceAll(mergeRowsById(module1Store.getSnapshot(), stored));
    }
  } finally {
    module1Store.setHydrating(false);
  }
}

export async function refreshRadarStoreFromDb(): Promise<void> {
  if (radarStore.isHydrating()) return;
  radarStore.setHydrating(true);
  try {
    if (hasBrowserDemoCookie()) {
      const stored = readDemoStorage(DEMO_RADAR_STORAGE_KEY, mockRadarHistory);
      const merged = mergeRowsById(radarStore.getSnapshot(), stored);
      radarStore.replaceAll(merged);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return;
    }

    // Requirement 24.1: at most 20 entries per page, sorted descending by created_at.
    const { data, error } = await supabase
      .from("module2_radars")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && Array.isArray(data)) {
      const dbRows = (data as RadarJobDbRow[]).map(mapDbRowToRadarJob);
      const localMockRows = radarStore
        .getSnapshot()
        .filter((r) => isMockRecordId(r.id) && !r.id.startsWith("demo-"));
      radarStore.replaceAll(mergeRowsById(localMockRows, dbRows));
    }
  } catch {
    if (hasBrowserDemoCookie()) {
      const stored = readDemoStorage(DEMO_RADAR_STORAGE_KEY, mockRadarHistory);
      radarStore.replaceAll(mergeRowsById(radarStore.getSnapshot(), stored));
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
