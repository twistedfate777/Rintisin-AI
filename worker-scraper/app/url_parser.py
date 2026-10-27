"""Maps_URL_Parser and Maps_URL_Formatter (Requirements 15.4, 15.6, 16.1–16.7)."""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin, urlparse

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

ALLOWED_REDIRECT_HOSTS = frozenset(
    {
        "google.com",
        "www.google.com",
        "maps.google.com",
        "maps.app.goo.gl",
        "goo.gl",
    }
)

FULL_MAPS_URL_PREFIXES = (
    "https://www.google.com/maps/",
    "https://maps.google.com/",
)

SHORTLINK_PREFIXES = (
    "https://maps.app.goo.gl/",
    "https://goo.gl/maps/",
)

MAX_REDIRECT_HOPS = 5
TOTAL_REDIRECT_TIMEOUT_SECONDS = 10.0
UNRECOGNIZED_MAPS_URL_REASON = "URL Google Maps tidak dapat dikenali"

# Feature_ID format: 0x<1..16 hex>:0x<1..16 hex> (bounded by non-hex characters so >16 hex digits are not partially matched)
FEATURE_ID_SUBSTRING_RE = re.compile(
    r"(?<![0-9a-fA-F])(0x[0-9a-fA-F]{1,16}:0x[0-9a-fA-F]{1,16})(?![0-9a-fA-F])"
)
FEATURE_ID_EXACT_RE = re.compile(r"^0x[0-9a-fA-F]{1,16}:0x[0-9a-fA-F]{1,16}$")


@dataclass(frozen=True)
class MapsUrlParseResult:
    ok: bool
    feature_id: Optional[str] = None
    canonical_url: Optional[str] = None
    reason: Optional[str] = None


def is_valid_feature_id(value: str) -> bool:
    if not isinstance(value, str):
        return False
    return bool(FEATURE_ID_EXACT_RE.match(value))


def format_canonical_maps_url(feature_id: str) -> str:
    """Maps_URL_Formatter (Requirements 16.5, 16.6)."""
    if not is_valid_feature_id(feature_id):
        raise ValueError("Feature_ID tidak valid")
    normalized = feature_id.lower()
    return f"https://www.google.com/maps/place/{normalized}"


def is_allowed_redirect_url(url: str) -> bool:
    """Requirement 15.4 & 15.6: strictly https and exact allowed hostname."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme.lower() != "https":
        return False
    hostname = (parsed.hostname or "").lower()
    return hostname in ALLOWED_REDIRECT_HOSTS


def is_full_google_maps_url(url: str) -> bool:
    return any(url.startswith(prefix) for prefix in FULL_MAPS_URL_PREFIXES)


def is_shortlink_maps_url(url: str) -> bool:
    return any(url.startswith(prefix) for prefix in SHORTLINK_PREFIXES)


def extract_feature_id_from_full_url(url: str) -> MapsUrlParseResult:
    """
    Pure, zero-network extraction from a full Google Maps URL (Requirements 16.2, 16.4, 16.7).
    """
    if not isinstance(url, str) or not is_full_google_maps_url(url):
        return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)

    # Also support URL-encoded colons (%3A / %3a) commonly found in Google Maps pb= parameters
    decoded_candidates = [url, url.replace("%3A", ":").replace("%3a", ":")]
    for candidate in decoded_candidates:
        match = FEATURE_ID_SUBSTRING_RE.search(candidate)
        if match:
            fid = match.group(1).lower()
            return MapsUrlParseResult(
                ok=True,
                feature_id=fid,
                canonical_url=format_canonical_maps_url(fid),
            )

    return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)


async def resolve_and_parse_maps_url(
    raw_url: str,
    http_client: Optional[httpx.AsyncClient] = None,
) -> MapsUrlParseResult:
    """
    Maps_URL_Parser (Requirements 15.4, 15.6, 16.1–16.4):
    - If raw_url is already a full Google Maps URL, extracts Feature_ID without any network call.
    - If raw_url is a shortlink, follows up to 5 redirect hops within 10s total, verifying every
      hop target against scheme=='https' and ALLOWED_REDIRECT_HOSTS BEFORE sending a request.
    """
    if not isinstance(raw_url, str):
        return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)

    current_url = raw_url.strip()
    if is_full_google_maps_url(current_url):
        return extract_feature_id_from_full_url(current_url)

    if not is_shortlink_maps_url(current_url) or not is_allowed_redirect_url(current_url):
        return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)

    deadline = time.monotonic() + TOTAL_REDIRECT_TIMEOUT_SECONDS
    owns_client = http_client is None
    client = http_client or httpx.AsyncClient(follow_redirects=False)

    try:
        hops = 0
        while not is_full_google_maps_url(current_url):
            if hops >= MAX_REDIRECT_HOPS:
                return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)

            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)

            if not is_allowed_redirect_url(current_url):
                return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)

            response = await client.get(
                current_url,
                follow_redirects=False,
                timeout=remaining,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/131.0.0.0 Safari/537.36"
                    )
                },
            )

            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("location")
                if not location:
                    return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)
                next_url = urljoin(current_url, location)
                # Requirement 15.6: verify scheme & hostname BEFORE making any request to next_url
                if not is_allowed_redirect_url(next_url):
                    return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)
                current_url = next_url
                hops += 1
            else:
                break

        if not is_full_google_maps_url(current_url):
            return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)

        return extract_feature_id_from_full_url(current_url)
    except Exception:
        return MapsUrlParseResult(ok=False, reason=UNRECOGNIZED_MAPS_URL_REASON)
    finally:
        if owns_client:
            await client.aclose()
