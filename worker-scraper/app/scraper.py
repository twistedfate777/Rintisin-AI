"""Zero-cost Google Maps review acquisition: Akuisisi_Primer & Akuisisi_Fallback (Requirements 17.1–17.9)."""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from urllib.parse import quote

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

from app.url_parser import format_canonical_maps_url

PRIMARY_RPC_URL = "https://www.google.com/maps/rpc/listugcposts"
PRIMARY_TIMEOUT_SECONDS = 30.0
FALLBACK_TIMEOUT_SECONDS = 120.0
MAX_REVIEWS_PER_COMPETITOR = 150
MIN_PRIMARY_REVIEWS_THRESHOLD = 10
MIN_FALLBACK_SCROLLS = 10
MAX_FALLBACK_SCROLLS = 15

BLOCKED_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")
BLOCKED_TILE_PATTERNS = (
    "/maps/vt",
    "khms0.google.com",
    "khms1.google.com",
    "khms2.google.com",
    "khms3.google.com",
    "streetviewpixels",
)


@dataclass
class ScrapeCompetitorResult:
    ok: bool
    competitor_name: str = ""
    avg_rating: Optional[float] = None
    reviews: List[Dict[str, Any]] = field(default_factory=list)
    failure_reason: Optional[str] = None


def should_block_fallback_request(resource_type: str, url: str) -> bool:
    """
    Requirement 17.3: Block all image (png, jpg, jpeg, webp), font, and map tile requests
    during Akuisisi_Fallback.
    """
    rt = (resource_type or "").lower()
    lower_url = (url or "").lower().split("?", 1)[0]

    if rt in ("image", "font"):
        return True
    if any(lower_url.endswith(ext) for ext in BLOCKED_IMAGE_EXTENSIONS):
        return True
    if any(lower_url.endswith(ext) for ext in (".woff", ".woff2", ".ttf", ".otf")):
        return True
    full_lower = (url or "").lower()
    if any(pat in full_lower for pat in BLOCKED_TILE_PATTERNS):
        return True
    return False


def _build_rpc_pb_param(feature_id: str, sort_code: int, page_token: str = "") -> str:
    """
    Build the `pb` query string for `https://www.google.com/maps/rpc/listugcposts`.
    sort_code: 2 = Newest (Terbaru), 4 = Lowest Rating (Rating Terendah).
    """
    fid_encoded = quote(feature_id, safe="")
    token_encoded = quote(page_token, safe="")
    return (
        f"!1m6!1s{fid_encoded}!6m4!4m1!1e1!4m1!1e3"
        f"!2m2!1i20!2s{token_encoded}"
        f"!5m2!1s!7e81!8m9!2b1!3b1!5b1!7b1!12m4!1b1!2b1!4m1!1e1!11m0!13m1!1e{sort_code}"
    )


def _strip_xssi_prefix(raw_body: str) -> str:
    body = raw_body.strip()
    if body.startswith(")]}'"):
        body = body[4:].lstrip()
    return body


def _parse_rpc_payload(raw_body: str) -> tuple[List[Dict[str, Any]], str]:
    """
    Parse Google Maps `listugcposts` JSON array response into review dicts
    (`rating`, `text`, `review_date`, `review_id`) and optional next page token.
    """
    cleaned = _strip_xssi_prefix(raw_body)
    data = json.loads(cleaned)
    if not isinstance(data, list):
        raise ValueError("Invalid RPC payload")

    next_token = ""
    if len(data) > 1 and isinstance(data[1], str):
        next_token = data[1]

    raw_entries = data[2] if len(data) > 2 and isinstance(data[2], list) else []
    parsed_reviews: List[Dict[str, Any]] = []

    for entry in raw_entries:
        if not isinstance(entry, list) or not entry:
            continue
        inner = entry[0] if isinstance(entry[0], list) else entry
        rating, text, review_date, review_id = _extract_review_from_nested_array(inner)
        if rating is not None and text:
            parsed_reviews.append(
                {
                    "id": review_id,
                    "rating": rating,
                    "text": text,
                    "review_date": review_date,
                }
            )

    return parsed_reviews, next_token


def _extract_review_from_nested_array(node: Any) -> tuple[Optional[int], str, float, str]:
    """Heuristically extract rating (1..5), review text, timestamp, and review id from a listugcposts entry."""
    rating: Optional[int] = None
    text = ""
    review_date = 0.0
    review_id = ""

    try:
        if isinstance(node, list):
            if len(node) > 0 and isinstance(node[0], str):
                review_id = node[0]
            if len(node) > 1 and isinstance(node[1], list) and len(node[1]) > 6:
                ts = node[1][6]
                if isinstance(ts, (int, float)):
                    review_date = float(ts)
            # Rating and comment in standard listugcposts layout (`node[2]`)
            if len(node) > 2 and isinstance(node[2], list):
                sub = node[2]
                if len(sub) > 0 and isinstance(sub[0], list) and len(sub[0]) > 0:
                    r_cand = sub[0][0]
                    if isinstance(r_cand, int) and 1 <= r_cand <= 5:
                        rating = r_cand
                # Search for the longest string inside `sub[-1]` or `sub` as review body
                candidate_texts: List[str] = []
                _collect_long_strings(sub, candidate_texts)
                if candidate_texts:
                    text = max(candidate_texts, key=len)
    except Exception:
        pass

    return rating, text, review_date, review_id


def _collect_long_strings(obj: Any, acc: List[str]) -> None:
    if isinstance(obj, str):
        if len(obj) >= 3 and not obj.startswith("http") and not obj.startswith("0x"):
            acc.append(obj)
    elif isinstance(obj, list):
        for item in obj:
            _collect_long_strings(item, acc)


async def run_primary_acquisition(
    feature_id: str,
    http_client: Optional[httpx.AsyncClient] = None,
) -> ScrapeCompetitorResult:
    """
    Requirement 17.1: Akuisisi_Primer via `https://www.google.com/maps/rpc/listugcposts`
    with sort orders Newest (2) and Lowest Rating (4), stopping at 150 reviews, 30s timeout.
    """
    owns_client = http_client is None
    client = http_client or httpx.AsyncClient(timeout=PRIMARY_TIMEOUT_SECONDS)

    collected: List[Dict[str, Any]] = []
    seen_keys: set[str] = set()
    place_name = ""
    avg_rating: Optional[float] = None

    async def _task() -> ScrapeCompetitorResult:
        nonlocal place_name, avg_rating
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8",
        }

        # Sort order 2 = Newest, 4 = Lowest Rating
        for sort_code in (2, 4):
            page_token = ""
            for _ in range(5):
                if len(collected) >= MAX_REVIEWS_PER_COMPETITOR:
                    break
                pb = _build_rpc_pb_param(feature_id, sort_code, page_token)
                resp = await client.get(f"{PRIMARY_RPC_URL}?authuser=0&hl=id&gl=id&pb={pb}", headers=headers)
                if resp.status_code != 200:
                    raise RuntimeError(f"Primary RPC status {resp.status_code}")

                batch, next_token = _parse_rpc_payload(resp.text)
                added = 0
                for rev in batch:
                    dedup_id = str(rev.get("id") or f"{rev.get('rating')}:{rev.get('text')}")
                    if dedup_id not in seen_keys:
                        seen_keys.add(dedup_id)
                        collected.append(rev)
                        added += 1
                        if len(collected) >= MAX_REVIEWS_PER_COMPETITOR:
                            break
                if added == 0 or not next_token:
                    break
                page_token = next_token

        return ScrapeCompetitorResult(
            ok=len(collected) >= MIN_PRIMARY_REVIEWS_THRESHOLD,
            competitor_name=place_name,
            avg_rating=avg_rating,
            reviews=collected[:MAX_REVIEWS_PER_COMPETITOR],
        )

    try:
        return await asyncio.wait_for(_task(), timeout=PRIMARY_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return ScrapeCompetitorResult(
            ok=False,
            competitor_name=place_name,
            avg_rating=avg_rating,
            reviews=collected[:MAX_REVIEWS_PER_COMPETITOR],
            failure_reason="Batas waktu pengambilan ulasan terlampaui",
        )
    except Exception:
        return ScrapeCompetitorResult(
            ok=False,
            competitor_name=place_name,
            avg_rating=avg_rating,
            reviews=collected[:MAX_REVIEWS_PER_COMPETITOR],
            failure_reason="Gagal mengambil ulasan pada Akuisisi_Primer",
        )
    finally:
        if owns_client:
            await client.aclose()


async def run_fallback_acquisition(feature_id: str) -> ScrapeCompetitorResult:
    """
    Requirements 17.2–17.7: Akuisisi_Fallback via Playwright headless Chromium (120s timeout):
    - Blocks all png/jpg/jpeg/webp images, fonts, and map tiles (Req 17.3).
    - Auto-scrolls the review panel 10 to 15 times (may stop before 10 only if 150 reviews are
      collected; after scroll 10, stops if a scroll adds no new reviews) (Req 17.4).
    - Extracts place name and avg_rating (1.0–5.0) from the same place page (Req 17.5, 17.9).
    """
    url = format_canonical_maps_url(feature_id)

    async def _playwright_task() -> ScrapeCompetitorResult:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            try:
                context = await browser.new_context(
                    locale="id-ID",
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/131.0.0.0 Safari/537.36"
                    ),
                )
                page = await context.new_page()

                async def _handle_route(route: Any) -> None:
                    req = route.request
                    if should_block_fallback_request(req.resource_type, req.url):
                        await route.abort()
                    else:
                        await route.continue_()

                await page.route("**/*", _handle_route)
                response = await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                if response and response.status == 404:
                    return ScrapeCompetitorResult(
                        ok=False,
                        failure_reason="Tempat tidak ditemukan",
                    )
                if response and response.status in (403, 429):
                    return ScrapeCompetitorResult(
                        ok=False,
                        failure_reason="Akses ke halaman ulasan diblokir",
                    )

                # Extract place name and avg_rating (Requirement 17.5, 17.9)
                competitor_name = ""
                avg_rating: Optional[float] = None
                try:
                    h1 = page.locator("h1").first
                    if await h1.count() > 0:
                        competitor_name = (await h1.inner_text(timeout=3000)).strip()
                except Exception:
                    competitor_name = ""

                try:
                    rating_el = page.locator('[role="img"][aria-label*="bintang"], [role="img"][aria-label*="stars"]').first
                    if await rating_el.count() > 0:
                        label = await rating_el.get_attribute("aria-label") or ""
                        m = re.search(r"([1-5][.,]\d|[1-5])", label)
                        if m:
                            val = float(m.group(1).replace(",", "."))
                            if 1.0 <= val <= 5.0:
                                avg_rating = round(val, 1)
                except Exception:
                    avg_rating = None

                # Open reviews tab if present
                try:
                    reviews_tab = page.locator('button[role="tab"]:has-text("Ulasan"), button[role="tab"]:has-text("Reviews")').first
                    if await reviews_tab.count() > 0:
                        await reviews_tab.click(timeout=5000)
                        await page.wait_for_timeout(1000)
                except Exception:
                    pass

                # Requirement 17.4: Scroll 10..15 times (stop before 10 only if 150 reviews reached;
                # after scroll 10, stop if a scroll yields 0 new reviews)
                prev_count = 0
                for scroll_idx in range(1, MAX_FALLBACK_SCROLLS + 1):
                    await page.evaluate(
                        """() => {
                            const feed = document.querySelector('[role="feed"]') || document.querySelector('.m6QErb.DxyBCb');
                            if (feed) {
                                feed.scrollTop = feed.scrollHeight;
                            } else {
                                window.scrollBy(0, 1200);
                            }
                        }"""
                    )
                    await page.wait_for_timeout(700)
                    cards = await page.locator("[data-review-id]").count()
                    if cards >= MAX_REVIEWS_PER_COMPETITOR:
                        break
                    if scroll_idx >= MIN_FALLBACK_SCROLLS and cards <= prev_count:
                        break
                    prev_count = cards

                raw_reviews = await page.evaluate(
                    """(maxCount) => {
                        const nodes = Array.from(document.querySelectorAll('[data-review-id]')).slice(0, maxCount);
                        const out = [];
                        const seen = new Set();
                        nodes.forEach((node, idx) => {
                            const id = node.getAttribute('data-review-id') || String(idx);
                            if (seen.has(id)) return;
                            seen.add(id);
                            const starEl = node.querySelector('[aria-label*="bintang"], [aria-label*="star"]');
                            const starLabel = starEl ? (starEl.getAttribute('aria-label') || '') : '';
                            const m = starLabel.match(/([1-5])/);
                            const rating = m ? parseInt(m[1], 10) : null;
                            const textEl = node.querySelector('.wiI7pd');
                            const text = textEl ? (textEl.textContent || '').trim() : '';
                            if (rating && text) {
                                out.push({ rating, text, review_date: Date.now() - idx * 1000 });
                            }
                        });
                        return out;
                    }""",
                    MAX_REVIEWS_PER_COMPETITOR,
                )

                if not raw_reviews:
                    return ScrapeCompetitorResult(
                        ok=False,
                        competitor_name=competitor_name,
                        avg_rating=avg_rating,
                        reviews=[],
                        failure_reason="Tempat ini belum memiliki ulasan",
                    )

                return ScrapeCompetitorResult(
                    ok=True,
                    competitor_name=competitor_name,
                    avg_rating=avg_rating,
                    reviews=raw_reviews[:MAX_REVIEWS_PER_COMPETITOR],
                )
            finally:
                await browser.close()

    try:
        return await asyncio.wait_for(_playwright_task(), timeout=FALLBACK_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return ScrapeCompetitorResult(
            ok=False,
            failure_reason="Batas waktu pengambilan ulasan terlampaui",
        )
    except Exception:
        return ScrapeCompetitorResult(
            ok=False,
            failure_reason="Akses ke halaman ulasan diblokir atau tempat tidak ditemukan",
        )


async def acquire_competitor_reviews(
    feature_id: str,
    http_client: Optional[httpx.AsyncClient] = None,
) -> ScrapeCompetitorResult:
    """
    Requirements 17.1, 17.2, 17.7, 17.8, 17.9:
    1. Run Akuisisi_Primer first. If >= 10 reviews are returned, accept immediately without fallback.
    2. Otherwise run Akuisisi_Fallback at most once.
    3. If fallback returns 1..9 reviews (or primary had 1..9), pick the larger review set and succeed (Req 17.8).
    4. If both have 0 reviews, return ok=False with the categorized Indonesian failure reason (Req 17.7).
    """
    primary = await run_primary_acquisition(feature_id, http_client=http_client)
    if len(primary.reviews) >= MIN_PRIMARY_REVIEWS_THRESHOLD:
        return ScrapeCompetitorResult(
            ok=True,
            competitor_name=primary.competitor_name,
            avg_rating=primary.avg_rating,
            reviews=primary.reviews[:MAX_REVIEWS_PER_COMPETITOR],
        )

    fallback = await run_fallback_acquisition(feature_id)
    chosen_reviews = (
        fallback.reviews if len(fallback.reviews) >= len(primary.reviews) else primary.reviews
    )
    competitor_name = fallback.competitor_name or primary.competitor_name or ""
    avg_rating = fallback.avg_rating if fallback.avg_rating is not None else primary.avg_rating

    if len(chosen_reviews) > 0:
        return ScrapeCompetitorResult(
            ok=True,
            competitor_name=competitor_name,
            avg_rating=avg_rating,
            reviews=chosen_reviews[:MAX_REVIEWS_PER_COMPETITOR],
        )

    return ScrapeCompetitorResult(
        ok=False,
        competitor_name=competitor_name,
        avg_rating=avg_rating,
        reviews=[],
        failure_reason=fallback.failure_reason
        or primary.failure_reason
        or "Tidak ada ulasan yang dapat diambil dari tempat ini",
    )
