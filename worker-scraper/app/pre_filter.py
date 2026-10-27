"""Deterministic 5-stage Pre_Filter and Text_Normalizer (Requirements 18.1–18.12)."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence, TypedDict

INSUFFICIENT_REVIEWS_REASON = "Ulasan informatif tidak cukup"

HTML_TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")


class UlasanBersih(TypedDict):
    """LLM-ready cleaned review (Requirement 18.2): only integer rating 1–5 and normalized text."""

    rating: int
    text: str


@dataclass(frozen=True)
class _InternalCleanReview:
    rating: int
    text: str
    timestamp_score: float
    original_index: int


def _is_emoji_char(ch: str) -> bool:
    cp = ord(ch)
    # Variation selectors and zero-width joiner used in emoji sequences
    if cp in (0x200D, 0xFE0E, 0xFE0F, 0x20E3):
        return True
    # Standard Unicode emoji blocks
    if (
        0x1F000 <= cp <= 0x1FAFF
        or 0x2600 <= cp <= 0x27BF
        or 0x2300 <= cp <= 0x23FF
        or 0x2B50 <= cp <= 0x2B55
        or 0xFE00 <= cp <= 0xFE0F
        or 0x1F3FB <= cp <= 0x1F3FF
    ):
        return True
    cat = unicodedata.category(ch)
    if cat == "So":
        return True
    return False


def _collapse_repeated_letters(text: str) -> str:
    """
    Requirement 18.4: Collapse runs of 3 or more identical consecutive letter characters
    into 1 letter, while keeping 2 identical consecutive letters ('tunggu') and leaving
    digits and punctuation untouched.
    """
    if not text:
        return ""
    result: List[str] = []
    n = len(text)
    i = 0
    while i < n:
        ch = text[i]
        j = i + 1
        if ch.isalpha():
            while j < n and text[j] == ch:
                j += 1
            run_len = j - i
            if run_len >= 3:
                result.append(ch)
            else:
                result.append(ch * run_len)
        else:
            result.append(ch)
        i = j
    return "".join(result)


def strip_html_tags(raw_text: str) -> str:
    """Requirement 18.2: Remove HTML tags while keeping text between tags."""
    if not raw_text:
        return ""
    return HTML_TAG_RE.sub("", raw_text)


def normalize_text(text: str) -> str:
    """
    Text_Normalizer (Requirements 18.4, 18.5):
    1. Strip all emoji characters.
    2. Collapse 3+ consecutive identical letters to 1 letter (preserving 2-letter doubles).
    3. Collapse consecutive whitespace to a single space ' ' and trim ends.
    Idempotent: normalize_text(normalize_text(s)) == normalize_text(s).
    """
    if not isinstance(text, str) or not text:
        return ""
    without_emojis = "".join(ch for ch in text if not _is_emoji_char(ch))
    collapsed_letters = _collapse_repeated_letters(without_emojis)
    collapsed_spaces = WHITESPACE_RE.sub(" ", collapsed_letters).strip()
    return collapsed_spaces


def count_words(normalized_text: str) -> int:
    """Requirement 18.6: Words are non-space character sequences separated by spaces."""
    if not normalized_text:
        return 0
    return len([w for w in normalized_text.split(" ") if w])


def _parse_timestamp_score(raw_date: Any) -> float:
    """Convert a review date (epoch float/int or ISO string) into a comparable numeric timestamp."""
    if isinstance(raw_date, (int, float)) and not isinstance(raw_date, bool):
        return float(raw_date)
    if isinstance(raw_date, str) and raw_date.strip():
        s = raw_date.strip()
        try:
            return float(s)
        except ValueError:
            pass
        try:
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            return datetime.fromisoformat(s).timestamp()
        except ValueError:
            return 0.0
    return 0.0


def _extract_valid_rating(raw_rating: Any) -> Optional[int]:
    """Requirement 18.3: Rating must be an integer in range 1..5."""
    if isinstance(raw_rating, bool) or raw_rating is None:
        return None
    if isinstance(raw_rating, int):
        return raw_rating if 1 <= raw_rating <= 5 else None
    if isinstance(raw_rating, float) and raw_rating.is_integer():
        val = int(raw_rating)
        return val if 1 <= val <= 5 else None
    return None


def run_pre_filter(raw_reviews: Sequence[Dict[str, Any]]) -> List[UlasanBersih]:
    """
    Requirement 18.1–18.11: Execute fixed 5-stage Pre_Filter pipeline:
    (a) Clean to Ulasan_Bersih (integer rating 1–5, strip HTML tags & user metadata)
    (b) Text_Normalizer
    (c) Filter out short reviews (<= 3 words)
    (d) Case-insensitive deduplication keeping newest review date
    (e) Stratified sample (max 80: 40 critical [rating 1–3, len > 30] + 40 positive [rating 4–5, len > 40])
    """
    # Stages (a), (b), (c)
    cleaned_and_filtered: List[_InternalCleanReview] = []
    for idx, item in enumerate(raw_reviews):
        if not isinstance(item, dict):
            continue
        rating = _extract_valid_rating(item.get("rating"))
        if rating is None:
            continue
        raw_text = item.get("text")
        if not isinstance(raw_text, str):
            continue

        # Stage (a): strip HTML tags keeping inner text
        no_html = strip_html_tags(raw_text)
        # Stage (b): normalize text
        norm_text = normalize_text(no_html)
        # Stage (c): filter out <= 3 words
        if count_words(norm_text) <= 3:
            continue

        ts_score = _parse_timestamp_score(
            item.get("review_date", item.get("published_at", item.get("timestamp")))
        )
        cleaned_and_filtered.append(
            _InternalCleanReview(
                rating=rating,
                text=norm_text,
                timestamp_score=ts_score,
                original_index=idx,
            )
        )

    # Stage (d): Deduplication (case-insensitive on normalized text, keep newest date)
    dedup_map: Dict[str, _InternalCleanReview] = {}
    for rev in cleaned_and_filtered:
        key = rev.text.casefold()
        existing = dedup_map.get(key)
        if existing is None:
            dedup_map[key] = rev
        else:
            # Keep the one with the newer review date
            if rev.timestamp_score > existing.timestamp_score:
                dedup_map[key] = rev

    unique_reviews = list(dedup_map.values())

    # Stage (e): Sampel_Terstratifikasi (Requirements 18.8–18.11)
    critical_eligible = [
        r for r in unique_reviews if 1 <= r.rating <= 3 and len(r.text) > 30
    ]
    positive_eligible = [
        r for r in unique_reviews if 4 <= r.rating <= 5 and len(r.text) > 40
    ]

    # Critical sorted by: longest normalized text descending, then newest date descending, then input order
    critical_sorted = sorted(
        critical_eligible,
        key=lambda r: (-len(r.text), -r.timestamp_score, r.original_index),
    )
    # Positive sorted by: newest date descending, then input order
    positive_sorted = sorted(
        positive_eligible,
        key=lambda r: (-r.timestamp_score, r.original_index),
    )

    crit_quota = 40
    pos_quota = 40

    selected_crit = critical_sorted[:crit_quota]
    selected_pos = positive_sorted[:pos_quota]

    # Spillover if either stratum has < 40 reviews (Requirement 18.10)
    if len(selected_crit) < crit_quota and len(positive_sorted) > pos_quota:
        shortfall = crit_quota - len(selected_crit)
        selected_pos = positive_sorted[: pos_quota + shortfall]
    elif len(selected_pos) < pos_quota and len(critical_sorted) > crit_quota:
        shortfall = pos_quota - len(selected_pos)
        selected_crit = critical_sorted[: crit_quota + shortfall]

    combined = (selected_crit + selected_pos)[:80]

    # Strip internal timestamp_score and original_index before returning Ulasan_Bersih (Requirement 18.2)
    return [{"rating": r.rating, "text": r.text} for r in combined]
