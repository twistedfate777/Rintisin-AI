"""Map-Reduce LLM analysis and worker-side Response_Guard (Requirements 11, 12, 19, 20)."""

from __future__ import annotations

import asyncio
import json
import math
import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

from app.pre_filter import UlasanBersih

GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_PRIMARY_MODEL = "openai/gpt-oss-120b"
DEFAULT_FALLBACK_MODEL = "openai/gpt-oss-20b"
DEFAULT_STRING = "Data tidak tersedia"
MAX_REDUCE_INPUT_TOKENS = 1000


def get_primary_model() -> str:
    return (os.environ.get("GROQ_PRIMARY_MODEL") or DEFAULT_PRIMARY_MODEL).strip()


def get_fallback_model() -> str:
    return (os.environ.get("GROQ_FALLBACK_MODEL") or DEFAULT_FALLBACK_MODEL).strip()


@dataclass
class CompetitorMapInput:
    maps_url: str
    competitor_name: str
    avg_rating: Optional[float]
    reviews: List[UlasanBersih]


@dataclass
class CompetitorMapOutput:
    ok: bool
    maps_url: str
    competitor_name: str
    avg_rating: Optional[float]
    reviews_count: int
    model_used: str = DEFAULT_FALLBACK_MODEL
    data: Optional[Dict[str, Any]] = None
    is_degraded: bool = False
    failure_reason: Optional[str] = None


@dataclass
class MapReduceFinalOutcome:
    ok: bool
    result: Optional[Dict[str, Any]] = None
    failed_competitors: List[Dict[str, str]] = None  # type: ignore[assignment]
    is_degraded: bool = False
    map_models: List[str] = None  # type: ignore[assignment]
    reduce_model: Optional[str] = None
    error_message: Optional[str] = None


def _coerce_finite_number(val: Any) -> Optional[float]:
    if isinstance(val, bool) or val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if math.isfinite(val) else None
    if isinstance(val, str):
        s = val.strip().replace("%", "").replace(",", ".")
        if not s:
            return None
        try:
            num = float(s)
            return num if math.isfinite(num) else None
        except ValueError:
            return None
    return None


def clamp_score_0_100(val: Any) -> Tuple[int, bool]:
    """
    Requirement 12.4 & 19.5: Coerce finite number and clamp to 0..100 without marking degraded;
    only mark degraded if missing/NaN/Infinity.
    """
    num = _coerce_finite_number(val)
    if num is None:
        return 0, True
    clamped = max(0.0, min(100.0, num))
    return int(round(clamped)), False


def normalize_sentiment_distribution(raw: Any) -> Tuple[Dict[str, int], bool]:
    """
    Requirement 19.8: Normalize positive, neutral, negative to integers 0..100 summing to 100
    while preserving relative order. If all 3 are 0 or invalid, apply Nilai_Default and mark degraded.
    """
    if not isinstance(raw, dict):
        return {"positive": 34, "neutral": 33, "negative": 33}, True

    p_raw, p_deg = clamp_score_0_100(raw.get("positive"))
    neu_raw, neu_deg = clamp_score_0_100(raw.get("neutral"))
    neg_raw, neg_deg = clamp_score_0_100(raw.get("negative"))
    degraded = p_deg or neu_deg or neg_deg

    total = p_raw + neu_raw + neg_raw
    if total <= 0:
        return {"positive": 34, "neutral": 33, "negative": 33}, True

    if total == 100:
        return {"positive": p_raw, "neutral": neu_raw, "negative": neg_raw}, degraded

    keys = ["positive", "neutral", "negative"]
    vals = [p_raw, neu_raw, neg_raw]
    exact = [(v * 100.0) / total for v in vals]
    floors = [int(math.floor(x)) for x in exact]
    remainder = 100 - sum(floors)

    # Distribute remainder by largest fractional part, breaking ties by larger original value
    order = sorted(
        range(3),
        key=lambda i: (-(exact[i] - floors[i]), -vals[i], i),
    )
    for idx in range(remainder):
        floors[order[idx]] += 1

    return {
        keys[0]: floors[0],
        keys[1]: floors[1],
        keys[2]: floors[2],
    }, degraded


def guard_map_output(raw_obj: Any) -> Tuple[Dict[str, Any], bool]:
    """Validate and repair a single competitor's Fase_Map JSON output."""
    if not isinstance(raw_obj, dict):
        raw_obj = {}
        degraded = True
    else:
        degraded = False

    sent_raw = raw_obj.get("sentiment_distribution")
    sent, sent_deg = normalize_sentiment_distribution(sent_raw)
    if sent_deg:
        degraded = True

    def _clean_str_list(v: Any) -> Tuple[List[str], bool]:
        if not isinstance(v, list):
            return [DEFAULT_STRING], True
        items = [str(x).strip() for x in v if isinstance(x, (str, int, float)) and str(x).strip()]
        if not items:
            return [DEFAULT_STRING], True
        return items[:5], False

    strengths, str_deg = _clean_str_list(raw_obj.get("core_strengths"))
    weaknesses, weak_deg = _clean_str_list(raw_obj.get("exploitable_weaknesses"))
    if str_deg or weak_deg:
        degraded = True

    aspects_in = raw_obj.get("aspect_scores")
    if not isinstance(aspects_in, dict):
        aspects_in = {}
        degraded = True

    pq, pq_d = clamp_score_0_100(aspects_in.get("product_quality"))
    pv, pv_d = clamp_score_0_100(aspects_in.get("pricing_value"))
    ss, ss_d = clamp_score_0_100(aspects_in.get("service_speed"))
    af, af_d = clamp_score_0_100(aspects_in.get("ambience_facility"))
    if pq_d or pv_d or ss_d or af_d:
        degraded = True

    dom_complaint = raw_obj.get("dominant_complaint")
    if not isinstance(dom_complaint, str) or not dom_complaint.strip():
        dom_complaint = DEFAULT_STRING
        degraded = True
    else:
        dom_complaint = dom_complaint.strip()

    return {
        "sentiment_distribution": sent,
        "core_strengths": strengths,
        "exploitable_weaknesses": weaknesses,
        "aspect_scores": {
            "product_quality": pq,
            "pricing_value": pv,
            "service_speed": ss,
            "ambience_facility": af,
        },
        "dominant_complaint": dom_complaint,
    }, degraded


def guard_reduce_output(
    raw_obj: Any,
    validated_maps: List[CompetitorMapOutput],
) -> Tuple[Dict[str, Any], bool]:
    """
    Validate and repair Fase_Reduce output (Requirements 19.5–19.8):
    - Overwrite `total_reviews_analyzed` (0..240) with exact sum of reviews in Sampel_Terstratifikasi
      across validated Fase_Map competitors (Req 19.6).
    - Construct `competitors_breakdown` with exactly 1 entry per validated Fase_Map competitor,
      overwriting `competitor_name` and `avg_rating` from scraper acquisition data (Req 19.7).
    - Normalize `sentiment_distribution` to sum to 100 (Req 19.8).
    """
    degraded = any(m.is_degraded for m in validated_maps)
    if not isinstance(raw_obj, dict):
        raw_obj = {}
        degraded = True

    # 1. market_overview
    mo_in = raw_obj.get("market_overview")
    if not isinstance(mo_in, dict):
        mo_in = {}
        degraded = True

    dom_complaint = mo_in.get("dominant_market_complaint")
    if not isinstance(dom_complaint, str) or not dom_complaint.strip():
        dom_complaint = DEFAULT_STRING
        degraded = True
    else:
        dom_complaint = dom_complaint.strip()

    unmet_need = mo_in.get("unmet_customer_need")
    if not isinstance(unmet_need, str) or not unmet_need.strip():
        unmet_need = DEFAULT_STRING
        degraded = True
    else:
        unmet_need = unmet_need.strip()

    total_reviews = max(0, min(240, sum(m.reviews_count for m in validated_maps)))

    # 2. competitors_breakdown (Requirement 19.7: exact 1 entry per validated Fase_Map competitor)
    llm_breakdown = raw_obj.get("competitors_breakdown")
    if not isinstance(llm_breakdown, list):
        llm_breakdown = []

    breakdown_out: List[Dict[str, Any]] = []
    for idx, map_item in enumerate(validated_maps):
        llm_entry = (
            llm_breakdown[idx]
            if idx < len(llm_breakdown) and isinstance(llm_breakdown[idx], dict)
            else {}
        )
        map_data = map_item.data or {}

        # Prefer scraper place name and avg_rating (Requirement 17.9 & 19.7)
        if map_item.competitor_name and map_item.competitor_name.strip():
            comp_name = map_item.competitor_name.strip()
        else:
            comp_name = f"Kompetitor {idx + 1}"
            degraded = True

        if map_item.avg_rating is not None and 0.0 <= map_item.avg_rating <= 5.0:
            avg_rating = round(float(map_item.avg_rating), 1)
        else:
            avg_rating = 0.0
            degraded = True

        sent_source = llm_entry.get("sentiment_distribution") or map_data.get("sentiment_distribution")
        sent, sent_deg = normalize_sentiment_distribution(sent_source)
        if sent_deg:
            degraded = True

        def _pick_list(primary: Any, fallback_list: Any) -> List[str]:
            nonlocal degraded
            for candidate in (primary, fallback_list):
                if isinstance(candidate, list):
                    cleaned = [str(x).strip() for x in candidate if str(x).strip()]
                    if cleaned:
                        return cleaned[:5]
            degraded = True
            return [DEFAULT_STRING]

        strengths = _pick_list(llm_entry.get("core_strengths"), map_data.get("core_strengths"))
        weaknesses = _pick_list(
            llm_entry.get("exploitable_weaknesses"), map_data.get("exploitable_weaknesses")
        )

        asp_source = llm_entry.get("aspect_scores")
        if not isinstance(asp_source, dict):
            asp_source = map_data.get("aspect_scores") or {}

        pq, pq_d = clamp_score_0_100(asp_source.get("product_quality"))
        pv, pv_d = clamp_score_0_100(asp_source.get("pricing_value"))
        ss, ss_d = clamp_score_0_100(asp_source.get("service_speed"))
        af, af_d = clamp_score_0_100(asp_source.get("ambience_facility"))
        if pq_d or pv_d or ss_d or af_d:
            degraded = True

        breakdown_out.append(
            {
                "competitor_name": comp_name,
                "avg_rating": avg_rating,
                "sentiment_distribution": sent,
                "core_strengths": strengths,
                "exploitable_weaknesses": weaknesses,
                "aspect_scores": {
                    "product_quality": pq,
                    "pricing_value": pv,
                    "service_speed": ss,
                    "ambience_facility": af,
                },
            }
        )

    # 3. steal_the_market_playbook
    raw_playbook = raw_obj.get("steal_the_market_playbook")
    playbook_out: List[Dict[str, str]] = []
    if isinstance(raw_playbook, list):
        for item in raw_playbook:
            if not isinstance(item, dict):
                degraded = True
                continue
            tw = item.get("target_weakness")
            act = item.get("actionable_strategy")
            hook = item.get("marketing_hook")

            if not isinstance(tw, str) or not tw.strip():
                tw = DEFAULT_STRING
                degraded = True
            else:
                tw = tw.strip()

            if not isinstance(act, str) or not act.strip():
                act = DEFAULT_STRING
                degraded = True
            else:
                act = act.strip()

            if not isinstance(hook, str) or not hook.strip():
                hook = DEFAULT_STRING
                degraded = True
            else:
                hook = hook.strip()

            playbook_out.append(
                {
                    "target_weakness": tw,
                    "actionable_strategy": act,
                    "marketing_hook": hook,
                }
            )
    else:
        degraded = True

    return {
        "market_overview": {
            "total_reviews_analyzed": total_reviews,
            "dominant_market_complaint": dom_complaint,
            "unmet_customer_need": unmet_need,
        },
        "competitors_breakdown": breakdown_out,
        "steal_the_market_playbook": playbook_out,
    }, degraded


def build_reduce_input_payload(validated_maps: List[CompetitorMapOutput]) -> str:
    """
    Requirement 19.3: Build combined Fase_Map summary for Fase_Reduce capped at <= 1,000 tokens
    (~3,600 characters).
    """
    summary_items = []
    for idx, m in enumerate(validated_maps):
        d = m.data or {}
        summary_items.append(
            {
                "index": idx + 1,
                "competitor_name": m.competitor_name or f"Kompetitor {idx + 1}",
                "avg_rating": m.avg_rating,
                "reviews_analyzed": m.reviews_count,
                "sentiment_distribution": d.get("sentiment_distribution"),
                "core_strengths": (d.get("core_strengths") or [])[:3],
                "exploitable_weaknesses": (d.get("exploitable_weaknesses") or [])[:3],
                "aspect_scores": d.get("aspect_scores"),
                "dominant_complaint": str(d.get("dominant_complaint") or "")[:160],
            }
        )
    serialized = json.dumps(summary_items, ensure_ascii=False)
    # 1 token is ~4 chars; cap at 3,500 chars so total prompt stays well under 1,000 tokens
    max_chars = 3500
    if len(serialized) > max_chars:
        for item in summary_items:
            item["core_strengths"] = [str(s)[:80] for s in item["core_strengths"][:2]]
            item["exploitable_weaknesses"] = [str(w)[:80] for w in item["exploitable_weaknesses"][:2]]
            item["dominant_complaint"] = str(item["dominant_complaint"])[:100]
        serialized = json.dumps(summary_items, ensure_ascii=False)[:max_chars]
    return serialized


async def _call_groq_json(
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    http_client: httpx.AsyncClient,
) -> Tuple[int, Optional[str]]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    resp = await http_client.post(
        GROQ_CHAT_COMPLETIONS_URL,
        headers=headers,
        json=payload,
        timeout=30.0,
    )
    if resp.status_code != 200:
        return resp.status_code, None
    body = resp.json()
    content = (
        body.get("choices", [{}])[0]
        .get("message", {})
        .get("content")
    )
    return 200, content if isinstance(content, str) else None


async def run_single_competitor_map(
    item: CompetitorMapInput,
    api_key: str,
    http_client: httpx.AsyncClient,
) -> CompetitorMapOutput:
    """
    Requirement 19.2, 19.5, 19.9, 19.10: Run Fase_Map for one competitor using Model_Fallback
    (`openai/gpt-oss-20b`), with 1 retry if JSON parsing fails.
    """
    fallback_model = get_fallback_model()
    system_prompt = (
        "Anda adalah analis intelijen kompetitor UMKM Indonesia. "
        "Tulis seluruh nilai teks dalam Bahasa Indonesia yang profesional dan dapat langsung ditindaklanjuti. "
        "Kembalikan HANYA objek JSON valid sesuai skema yang diminta."
    )
    user_prompt = (
        f"Nama Tempat: {item.competitor_name or 'Kompetitor'}\n"
        f"Rata-rata Rating: {item.avg_rating if item.avg_rating is not None else 'Tidak tersedia'}\n"
        f"Sampel Ulasan ({len(item.reviews)} ulasan):\n"
        f"{json.dumps(item.reviews, ensure_ascii=False)}\n\n"
        "Hasilkan JSON dengan struktur:\n"
        "{\n"
        '  "sentiment_distribution": {"positive": int, "neutral": int, "negative": int},\n'
        '  "core_strengths": [string],\n'
        '  "exploitable_weaknesses": [string],\n'
        '  "aspect_scores": {"product_quality": int, "pricing_value": int, "service_speed": int, "ambience_facility": int},\n'
        '  "dominant_complaint": string\n'
        "}"
    )

    for attempt in range(2):
        try:
            status, raw_content = await _call_groq_json(
                api_key=api_key,
                model=fallback_model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                http_client=http_client,
            )
        except Exception:
            return CompetitorMapOutput(
                ok=False,
                maps_url=item.maps_url,
                competitor_name=item.competitor_name,
                avg_rating=item.avg_rating,
                reviews_count=len(item.reviews),
                model_used=fallback_model,
                failure_reason="Analisis ulasan AI gagal untuk kompetitor ini",
            )

        if status != 200 or not raw_content:
            return CompetitorMapOutput(
                ok=False,
                maps_url=item.maps_url,
                competitor_name=item.competitor_name,
                avg_rating=item.avg_rating,
                reviews_count=len(item.reviews),
                model_used=fallback_model,
                failure_reason="Analisis ulasan AI gagal untuk kompetitor ini",
            )

        try:
            parsed = json.loads(raw_content)
            guarded, is_deg = guard_map_output(parsed)
            return CompetitorMapOutput(
                ok=True,
                maps_url=item.maps_url,
                competitor_name=item.competitor_name,
                avg_rating=item.avg_rating,
                reviews_count=len(item.reviews),
                model_used=fallback_model,
                data=guarded,
                is_degraded=is_deg,
            )
        except json.JSONDecodeError:
            if attempt == 0:
                continue
            return CompetitorMapOutput(
                ok=False,
                maps_url=item.maps_url,
                competitor_name=item.competitor_name,
                avg_rating=item.avg_rating,
                reviews_count=len(item.reviews),
                model_used=fallback_model,
                failure_reason="Analisis ulasan AI gagal untuk kompetitor ini",
            )

    return CompetitorMapOutput(
        ok=False,
        maps_url=item.maps_url,
        competitor_name=item.competitor_name,
        avg_rating=item.avg_rating,
        reviews_count=len(item.reviews),
        model_used=fallback_model,
        failure_reason="Analisis ulasan AI gagal untuk kompetitor ini",
    )


async def run_map_reduce_pipeline(
    competitors: List[CompetitorMapInput],
    initial_failed: List[Dict[str, str]],
    api_key: str,
    http_client: Optional[httpx.AsyncClient] = None,
) -> MapReduceFinalOutcome:
    """
    Requirements 19.2–19.12 & 20.1–20.7:
    1. Run Fase_Map in parallel across non-failed competitors using Model_Fallback.
    2. If all competitors fail Fase_Map, return FAILED with per-competitor reasons without calling Fase_Reduce.
    3. Run Fase_Reduce using Model_Primer (`openai/gpt-oss-120b`), falling back once to Model_Fallback
       (`openai/gpt-oss-20b`) on HTTP 429.
    4. Validate with `guard_reduce_output`.
    """
    owns_client = http_client is None
    client = http_client or httpx.AsyncClient()
    failed_competitors = list(initial_failed)

    try:
        map_tasks = [
            run_single_competitor_map(comp, api_key=api_key, http_client=client)
            for comp in competitors
        ]
        map_results = await asyncio.gather(*map_tasks)

        validated_maps: List[CompetitorMapOutput] = []
        map_models: List[str] = []
        for res in map_results:
            if res.ok and res.data is not None:
                validated_maps.append(res)
                map_models.append(res.model_used)
            else:
                failed_competitors.append(
                    {
                        "maps_url": res.maps_url,
                        "reason": res.failure_reason or "Analisis ulasan AI gagal untuk kompetitor ini",
                    }
                )

        # Requirement 19.11: If Fase_Map failed for all competitors, mark FAILED without running Fase_Reduce
        if not validated_maps:
            reasons_text = "; ".join(
                f"{fc['maps_url']}: {fc['reason']}" for fc in failed_competitors
            )
            return MapReduceFinalOutcome(
                ok=False,
                failed_competitors=failed_competitors,
                map_models=map_models,
                error_message=f"Seluruh analisis ulasan kompetitor gagal ({reasons_text}).",
            )

        # Fase_Reduce (Requirements 19.3, 19.4, 19.9, 19.12)
        reduce_input_json = build_reduce_input_payload(validated_maps)
        system_prompt = (
            "Anda adalah konsultan strategi pasar UMKM Indonesia. "
            "Tulis seluruh nilai teks dalam Bahasa Indonesia yang profesional dan dapat langsung ditindaklanjuti. "
            "Kembalikan HANYA objek JSON valid."
        )
        user_prompt = (
            "Ringkasan hasil analisis per kompetitor:\n"
            f"{reduce_input_json}\n\n"
            "Hasilkan JSON dengan struktur:\n"
            "{\n"
            '  "market_overview": {\n'
            '    "total_reviews_analyzed": int,\n'
            '    "dominant_market_complaint": string,\n'
            '    "unmet_customer_need": string\n'
            "  },\n"
            '  "competitors_breakdown": [\n'
            "    {\n"
            '      "competitor_name": string,\n'
            '      "avg_rating": float,\n'
            '      "sentiment_distribution": {"positive": int, "neutral": int, "negative": int},\n'
            '      "core_strengths": [string],\n'
            '      "exploitable_weaknesses": [string],\n'
            '      "aspect_scores": {"product_quality": int, "pricing_value": int, "service_speed": int, "ambience_facility": int}\n'
            "    }\n"
            "  ],\n"
            '  "steal_the_market_playbook": [\n'
            "    {\n"
            '      "target_weakness": string,\n'
            '      "actionable_strategy": string,\n'
            '      "marketing_hook": string\n'
            "    }\n"
            "  ]\n"
            "}"
        )

        primary_model = get_primary_model()
        fallback_model = get_fallback_model()
        used_reduce_model = primary_model

        status, raw_reduce = await _call_groq_json(
            api_key=api_key,
            model=primary_model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            http_client=client,
        )

        # Requirement 19.4: If Model_Primer returns HTTP 429 on Fase_Reduce, retry once with Model_Fallback
        if status == 429:
            used_reduce_model = fallback_model
            status, raw_reduce = await _call_groq_json(
                api_key=api_key,
                model=fallback_model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                http_client=client,
            )

        if status != 200 or not raw_reduce:
            return MapReduceFinalOutcome(
                ok=False,
                failed_competitors=failed_competitors,
                map_models=map_models,
                reduce_model=used_reduce_model,
                error_message="Analisis gabungan AI gagal diselesaikan. Silakan coba lagi beberapa saat lagi.",
            )

        parsed_reduce: Optional[Any] = None
        try:
            parsed_reduce = json.loads(raw_reduce)
        except json.JSONDecodeError:
            # 1x JSON parse retry on the same model (Requirement 12.2 / 19.5)
            status_retry, raw_retry = await _call_groq_json(
                api_key=api_key,
                model=used_reduce_model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                http_client=client,
            )
            if status_retry == 200 and raw_retry:
                try:
                    parsed_reduce = json.loads(raw_retry)
                except json.JSONDecodeError:
                    parsed_reduce = {}
            else:
                parsed_reduce = {}

        final_result, is_degraded = guard_reduce_output(parsed_reduce, validated_maps)
        return MapReduceFinalOutcome(
            ok=True,
            result=final_result,
            failed_competitors=failed_competitors,
            is_degraded=is_degraded,
            map_models=map_models,
            reduce_model=used_reduce_model,
        )
    except Exception:
        return MapReduceFinalOutcome(
            ok=False,
            failed_competitors=failed_competitors,
            error_message="Analisis AI gagal diselesaikan. Silakan coba lagi.",
        )
    finally:
        if owns_client:
            await client.aclose()
