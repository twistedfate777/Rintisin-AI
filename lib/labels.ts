import type {
  JobStatus,
  KategoriEkraf,
  RiskLevel,
  StepStatus,
  ViabilityStatus,
} from "@/lib/types";

// Enum codes are never shown raw (Requirement 3.3, 3.8): every lookup has an Indonesian fallback.

export const KATEGORI_LABEL: Record<KategoriEkraf, string> = {
  KULINER: "Kuliner",
  FASHION: "Fashion",
  KRIYA: "Kriya",
  BEAUTY: "Beauty",
};

export const VIABILITY_LABEL: Record<ViabilityStatus, string> = {
  VIABLE: "Layak",
  VIABLE_WITH_NOTES: "Layak dengan Catatan",
  NOT_VIABLE: "Belum Layak",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
};

export const TREND_LABEL: Record<string, string> = {
  EVERGREEN_NICHE: "Niche Evergreen",
  EVERGREEN_MASS: "Evergreen Massal",
  RISING_TREND: "Tren Naik",
  FAD_PEAKING: "Tren Musiman di Puncak",
  DECLINING: "Menurun",
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: "Menunggu",
  SCRAPING: "Mengambil ulasan",
  ANALYZING: "Menganalisis",
  COMPLETED: "Selesai",
  FAILED: "Gagal",
};

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  IDLE: "Belum dijalankan",
  RUNNING: "Sedang diproses",
  SUCCESS: "Berhasil",
  FAILED: "Gagal",
};

export const FALLBACK_LABEL = "Kategori lain";

/** Looks up an Indonesian label; unknown codes get the design's fallback label. */
export function labelFor(map: Record<string, string>, code: unknown): string {
  if (typeof code === "string" && Object.prototype.hasOwnProperty.call(map, code)) {
    return map[code];
  }
  return FALLBACK_LABEL;
}
