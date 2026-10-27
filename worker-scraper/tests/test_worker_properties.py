"""Unit and property tests for Rintisin AI Scraper_Worker (Requirements 15, 16, 17, 18, 19)."""

from __future__ import annotations

import unittest

from app.map_reduce import (
    CompetitorMapOutput,
    guard_reduce_output,
    normalize_sentiment_distribution,
)
from app.pre_filter import normalize_text, run_pre_filter
from app.scraper import should_block_fallback_request
from app.url_parser import (
    extract_feature_id_from_full_url,
    format_canonical_maps_url,
    is_allowed_redirect_url,
)


class TestMapsUrlParserAndFormatter(unittest.TestCase):
    def test_round_trip_property(self) -> None:
        samples = [
            "0x1:0x1",
            "0x2e69f3e945e34b9d:0x5371bf0fdad786a2",
            "0xABCDEF1234567890:0x0001A",
            "0xdeadbeef:0xCAFEBABE",
        ]
        for fid in samples:
            canonical = format_canonical_maps_url(fid)
            parsed = extract_feature_id_from_full_url(canonical)
            self.assertTrue(parsed.ok)
            self.assertEqual(parsed.feature_id, fid.lower())

    def test_first_occurrence_extracted(self) -> None:
        url = (
            "https://www.google.com/maps/place/Toko/"
            "!1s0x2e69f11111111111:0xaaaa222222222222!2s0x9999:0x8888"
        )
        parsed = extract_feature_id_from_full_url(url)
        self.assertTrue(parsed.ok)
        self.assertEqual(parsed.feature_id, "0x2e69f11111111111:0xaaaa222222222222")

    def test_rejects_invalid_feature_id(self) -> None:
        with self.assertRaises(ValueError):
            format_canonical_maps_url("not-a-feature-id")
        with self.assertRaises(ValueError):
            format_canonical_maps_url("0x1234567890abcdef1:0x1")  # 17 hex digits

    def test_ssrf_redirect_allowlist(self) -> None:
        self.assertTrue(is_allowed_redirect_url("https://maps.app.goo.gl/abc123"))
        self.assertTrue(is_allowed_redirect_url("https://www.google.com/maps/place/x"))
        self.assertFalse(is_allowed_redirect_url("http://www.google.com/maps/place/x"))
        self.assertFalse(is_allowed_redirect_url("https://evil.google.com.attacker.com/x"))
        self.assertFalse(is_allowed_redirect_url("https://169.254.169.254/latest/meta-data"))


class TestPreFilterAndTextNormalizer(unittest.TestCase):
    def test_text_normalizer_rules_and_idempotence(self) -> None:
        raw = "  Laaaamaaa   bangeeet   tunggu   pesanannya 😭🔥 100%!!  "
        once = normalize_text(raw)
        twice = normalize_text(once)
        self.assertEqual(once, "Lama banget tunggu pesanannya 100%!!")
        self.assertEqual(once, twice)

    def test_pre_filter_short_dedup_and_stratification(self) -> None:
        raw_reviews = [
            # Short review (<= 3 words) -> discarded
            {"rating": 5, "text": "Enak banget mantap", "review_date": 100},
            # Duplicate normalized text with older date -> discarded in favor of newer
            {
                "rating": 2,
                "text": "<b>Pelayanan</b> sangaaat laaama sekali sampai menunggu satu jam",
                "review_date": 100,
                "user_name": "Budi",
            },
            {
                "rating": 1,
                "text": "pelayanan sangat lama sekali sampai menunggu satu jam",
                "review_date": 250,
                "user_name": "Andi",
            },
            # Eligible positive (> 40 chars, >= 4 words, rating 4-5)
            {
                "rating": 5,
                "text": "Tempatnya sangat nyaman bersih dan kopinya enak sekali untuk kerja",
                "review_date": 300,
            },
        ]
        out = run_pre_filter(raw_reviews)
        self.assertEqual(len(out), 2)
        # Newer duplicate (rating 1) kept over older (rating 2)
        self.assertEqual(out[0]["rating"], 1)
        self.assertNotIn("<b>", out[0]["text"])
        self.assertEqual(set(out[0].keys()), {"rating", "text"})

    def test_stratified_sample_spillover_invariant(self) -> None:
        # 50 critical eligible reviews + 10 positive eligible reviews -> total 60 (<= 80)
        reviews = []
        for i in range(50):
            reviews.append(
                {
                    "rating": 1,
                    "text": f"Pelayanan sangat buruk sekali pada kunjungan nomor {i} di cabang utama",
                    "review_date": 1000 + i,
                }
            )
        for i in range(10):
            reviews.append(
                {
                    "rating": 5,
                    "text": f"Kualitas produk sangat memuaskan sekali pada pembelian nomor {i} kemarin",
                    "review_date": 2000 + i,
                }
            )
        sample = run_pre_filter(reviews)
        self.assertEqual(len(sample), 60)


class TestScraperAndMapReduceGuards(unittest.TestCase):
    def test_fallback_asset_blocking(self) -> None:
        self.assertTrue(should_block_fallback_request("image", "https://example.com/a.html"))
        self.assertTrue(should_block_fallback_request("font", "https://fonts.gstatic.com/s/a.woff2"))
        self.assertTrue(should_block_fallback_request("xhr", "https://www.google.com/maps/vt?pb=123"))
        self.assertTrue(should_block_fallback_request("other", "https://lh3.googleusercontent.com/p/photo.webp"))
        self.assertFalse(should_block_fallback_request("document", "https://www.google.com/maps/place/0x1:0x2"))

    def test_sentiment_distribution_normalization(self) -> None:
        norm, deg = normalize_sentiment_distribution({"positive": 60, "neutral": 20, "negative": 10})
        self.assertFalse(deg)
        self.assertEqual(sum(norm.values()), 100)
        self.assertGreater(norm["positive"], norm["neutral"])
        self.assertGreater(norm["neutral"], norm["negative"])

        zero_norm, zero_deg = normalize_sentiment_distribution({"positive": 0, "neutral": 0, "negative": 0})
        self.assertTrue(zero_deg)
        self.assertEqual(sum(zero_norm.values()), 100)

    def test_reduce_guard_overwrites_scraper_metadata(self) -> None:
        validated_maps = [
            CompetitorMapOutput(
                ok=True,
                maps_url="https://www.google.com/maps/place/0x1:0x2",
                competitor_name="Kopi Asli Scraper",
                avg_rating=4.6,
                reviews_count=42,
                data={
                    "sentiment_distribution": {"positive": 70, "neutral": 20, "negative": 10},
                    "core_strengths": ["Rasa konsisten"],
                    "exploitable_weaknesses": ["Antrean kasir lambat"],
                    "aspect_scores": {
                        "product_quality": 85,
                        "pricing_value": 75,
                        "service_speed": 50,
                        "ambience_facility": 70,
                    },
                    "dominant_complaint": "Antrean lambat",
                },
            )
        ]
        llm_reduce = {
            "market_overview": {
                "total_reviews_analyzed": 999,  # Must be ignored and overwritten with 42
                "dominant_market_complaint": "Waktu tunggu lama saat jam sibuk",
                "unmet_customer_need": "Pemesanan pre-order via WhatsApp",
            },
            "competitors_breakdown": [
                {
                    "competitor_name": "Nama Halusinasi LLM",  # Must be overwritten
                    "avg_rating": 1.2,  # Must be overwritten
                    "sentiment_distribution": {"positive": 70, "neutral": 20, "negative": 10},
                    "core_strengths": ["Rasa konsisten"],
                    "exploitable_weaknesses": ["Antrean kasir lambat"],
                    "aspect_scores": {
                        "product_quality": 85,
                        "pricing_value": 75,
                        "service_speed": 50,
                        "ambience_facility": 70,
                    },
                }
            ],
            "steal_the_market_playbook": [
                {
                    "target_weakness": "Antrean kasir lambat",
                    "actionable_strategy": "Sediakan jalur ambil cepat",
                    "marketing_hook": "Kopi siap dalam 3 menit tanpa antre!",
                }
            ],
        }
        guarded, deg = guard_reduce_output(llm_reduce, validated_maps)
        self.assertFalse(deg)
        self.assertEqual(guarded["market_overview"]["total_reviews_analyzed"], 42)
        self.assertEqual(guarded["competitors_breakdown"][0]["competitor_name"], "Kopi Asli Scraper")
        self.assertEqual(guarded["competitors_breakdown"][0]["avg_rating"], 4.6)


if __name__ == "__main__":
    unittest.main()
