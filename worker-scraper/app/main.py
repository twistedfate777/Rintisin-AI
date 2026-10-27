"""FastAPI entrypoint for Rintisin AI Scraper_Worker (Requirements 15, 16, 17, 18, 19, 20, 25)."""

from __future__ import annotations

import hmac
import os
from typing import Any, Dict, List, Optional

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.map_reduce import CompetitorMapInput, run_map_reduce_pipeline
from app.pre_filter import INSUFFICIENT_REVIEWS_REASON, run_pre_filter
from app.scraper import acquire_competitor_reviews
from app.url_parser import resolve_and_parse_maps_url

app = FastAPI(title="Rintisin AI Scraper Worker", version="1.0.0")


class DispatchPayload(BaseModel):
    radar_id: str = Field(..., min_length=1)
    maps_urls: Optional[List[str]] = None


class WorkerEnvConfig:
    def __init__(
        self,
        worker_secret: str,
        supabase_url: str,
        supabase_service_key: str,
        groq_api_key: str,
    ) -> None:
        self.worker_secret = worker_secret
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_service_key = supabase_service_key
        self.groq_api_key = groq_api_key


def load_worker_env() -> Optional[WorkerEnvConfig]:
    """
    Requirement 15.5 & 15.7: Read secrets strictly from environment variables.
    Return None if any required secret is missing or empty.
    """
    worker_secret = (os.environ.get("WORKER_SECRET") or "").strip()
    supabase_url = (
        os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or ""
    ).strip()
    supabase_service_key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    groq_api_key = (os.environ.get("GROQ_API_KEY") or "").strip()

    if not worker_secret or not supabase_url or not supabase_service_key or not groq_api_key:
        return None

    return WorkerEnvConfig(
        worker_secret=worker_secret,
        supabase_url=supabase_url,
        supabase_service_key=supabase_service_key,
        groq_api_key=groq_api_key,
    )


def _supabase_headers(service_key: str) -> Dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


async def fetch_radar_job_by_id(
    cfg: WorkerEnvConfig,
    radar_id: str,
    http_client: httpx.AsyncClient,
) -> Optional[Dict[str, Any]]:
    """Requirement 15.2 & 15.3: Fetch strictly the single row matching radar_id."""
    url = f"{cfg.supabase_url}/rest/v1/module2_radars"
    resp = await http_client.get(
        url,
        params={"id": f"eq.{radar_id}", "select": "id,status,maps_urls"},
        headers=_supabase_headers(cfg.supabase_service_key),
        timeout=10.0,
    )
    if resp.status_code != 200:
        return None
    rows = resp.json()
    if not isinstance(rows, list) or len(rows) != 1:
        return None
    return rows[0]


async def update_radar_job_by_id(
    cfg: WorkerEnvConfig,
    radar_id: str,
    patch: Dict[str, Any],
    http_client: httpx.AsyncClient,
) -> bool:
    """Requirement 15.3 & 20.1: Update strictly the single row matching radar_id."""
    url = f"{cfg.supabase_url}/rest/v1/module2_radars"
    resp = await http_client.patch(
        url,
        params={"id": f"eq.{radar_id}"},
        headers={**_supabase_headers(cfg.supabase_service_key), "Prefer": "return=minimal"},
        json=patch,
        timeout=10.0,
    )
    return 200 <= resp.status_code < 300


async def execute_radar_job_pipeline(
    cfg: WorkerEnvConfig,
    radar_id: str,
    maps_urls: List[str],
) -> None:
    """
    Full asynchronous Scraper_Worker pipeline for a single Radar_Job (Requirements 16–20):
    - Never includes secrets, stack traces, exception names, or file paths in error_message (Req 15.8, 20.4).
    """
    async with httpx.AsyncClient() as http_client:
        try:
            await update_radar_job_by_id(
                cfg,
                radar_id,
                {"status": "SCRAPING"},
                http_client,
            )

            ready_for_map: List[CompetitorMapInput] = []
            failed_competitors: List[Dict[str, str]] = []
            transitioned_to_analyzing = False

            for raw_url in maps_urls[:3]:
                parsed = await resolve_and_parse_maps_url(raw_url, http_client=http_client)
                if not parsed.ok or not parsed.feature_id:
                    failed_competitors.append(
                        {
                            "maps_url": raw_url,
                            "reason": parsed.reason or "URL Google Maps tidak dapat dikenali",
                        }
                    )
                    continue

                scraped = await acquire_competitor_reviews(
                    parsed.feature_id, http_client=http_client
                )
                if not scraped.ok or not scraped.reviews:
                    failed_competitors.append(
                        {
                            "maps_url": raw_url,
                            "reason": scraped.failure_reason
                            or "Gagal mengambil ulasan dari Google Maps",
                        }
                    )
                    continue

                stratified = run_pre_filter(scraped.reviews)
                if not stratified:
                    # Requirement 18.12: 0 reviews after Pre_Filter
                    failed_competitors.append(
                        {
                            "maps_url": raw_url,
                            "reason": INSUFFICIENT_REVIEWS_REASON,
                        }
                    )
                    continue

                # Requirement 19.1: Transition SCRAPING -> ANALYZING exactly once when the first
                # competitor produces >= 1 stratified review, before the first Fase_Map call.
                if not transitioned_to_analyzing:
                    transitioned_to_analyzing = True
                    await update_radar_job_by_id(
                        cfg,
                        radar_id,
                        {"status": "ANALYZING"},
                        http_client,
                    )

                ready_for_map.append(
                    CompetitorMapInput(
                        maps_url=raw_url,
                        competitor_name=scraped.competitor_name,
                        avg_rating=scraped.avg_rating,
                        reviews=stratified,
                    )
                )

            # Requirement 20.2: If all competitors failed before Fase_Map, mark FAILED with per-URL reasons
            if not ready_for_map:
                per_url_details = "; ".join(
                    f"{fc['maps_url']} ({fc['reason']})" for fc in failed_competitors
                )
                await update_radar_job_by_id(
                    cfg,
                    radar_id,
                    {
                        "status": "FAILED",
                        "failed_competitors": failed_competitors,
                        "error_message": (
                            f"Seluruh URL kompetitor gagal diproses: {per_url_details}."
                            if per_url_details
                            else "Seluruh URL kompetitor gagal diproses."
                        ),
                    },
                    http_client,
                )
                return

            outcome = await run_map_reduce_pipeline(
                competitors=ready_for_map,
                initial_failed=failed_competitors,
                api_key=cfg.groq_api_key,
                http_client=http_client,
            )

            if not outcome.ok or outcome.result is None:
                await update_radar_job_by_id(
                    cfg,
                    radar_id,
                    {
                        "status": "FAILED",
                        "failed_competitors": outcome.failed_competitors or failed_competitors,
                        "map_models": outcome.map_models,
                        "reduce_model": outcome.reduce_model,
                        "error_message": outcome.error_message
                        or "Analisis AI gagal diselesaikan. Silakan coba lagi.",
                    },
                    http_client,
                )
                return

            # Requirement 20.1: Atomic single update for COMPLETED + result + is_degraded
            await update_radar_job_by_id(
                cfg,
                radar_id,
                {
                    "status": "COMPLETED",
                    "result": outcome.result,
                    "is_degraded": outcome.is_degraded,
                    "failed_competitors": outcome.failed_competitors or [],
                    "map_models": outcome.map_models,
                    "reduce_model": outcome.reduce_model,
                    "error_message": None,
                },
                http_client,
            )
        except Exception:
            # Requirement 20.4: Generic Indonesian error without stack trace, exception name, path, or secret
            try:
                await update_radar_job_by_id(
                    cfg,
                    radar_id,
                    {
                        "status": "FAILED",
                        "error_message": (
                            "Terjadi gangguan internal saat memproses analisis kompetitor. "
                            "Silakan coba lagi."
                        ),
                    },
                    http_client,
                )
            except Exception:
                pass


@app.get("/health")
async def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/dispatch", status_code=202)
async def dispatch_radar_job(
    payload: DispatchPayload,
    background_tasks: BackgroundTasks,
    x_worker_secret: Optional[str] = Header(default=None, alias="X-Worker-Secret"),
) -> Dict[str, str]:
    """
    Requirements 15.1, 15.2, 15.7, 15.8:
    - Reject if environment secrets are missing/empty (Req 15.7).
    - Verify X-Worker-Secret header case-sensitively; return 401 if missing/mismatched (Req 15.1).
    - Verify radar_id exists in Database with status PENDING or SCRAPING before starting (Req 15.2).
    """
    cfg = load_worker_env()
    if cfg is None:
        raise HTTPException(
            status_code=503,
            detail="Konfigurasi layanan worker belum lengkap.",
        )

    if not x_worker_secret or not hmac.compare_digest(x_worker_secret, cfg.worker_secret):
        raise HTTPException(
            status_code=401,
            detail="Tidak diizinkan.",
        )

    async with httpx.AsyncClient() as http_client:
        row = await fetch_radar_job_by_id(cfg, payload.radar_id, http_client)

    if not row or row.get("status") not in ("PENDING", "SCRAPING"):
        raise HTTPException(
            status_code=404,
            detail="Radar_Job tidak ditemukan atau status tidak valid untuk diproses.",
        )

    db_urls = row.get("maps_urls")
    urls: List[str] = (
        [str(u) for u in db_urls if isinstance(u, str)]
        if isinstance(db_urls, list) and db_urls
        else [str(u) for u in (payload.maps_urls or []) if isinstance(u, str)]
    )

    if not urls:
        raise HTTPException(
            status_code=400,
            detail="Daftar Maps_URL pada Radar_Job kosong.",
        )

    background_tasks.add_task(execute_radar_job_pipeline, cfg, payload.radar_id, urls)
    return {"status": "accepted", "radar_id": payload.radar_id}
