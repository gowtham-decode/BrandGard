import pytest
from app.detection.similarity import (
    compute_string_similarity,
    compute_token_similarity,
    analyze_handle_impersonation,
)


def test_string_similarity():
    assert compute_string_similarity("apple", "apple") == 1.0
    sim = compute_string_similarity("apple", "app1e")
    assert 0.70 < sim < 1.0
    assert compute_string_similarity("brand", "totally_different") < 0.30


def test_analyze_handle_impersonation():
    res = analyze_handle_impersonation(
        suspicious_handle="brand_official_support",
        brand_name="brand",
        official_handles=["brand"]
    )
    assert res["brand_in_handle"] is True
    assert "official" in res["added_deceptive_keywords"]
    assert "support" in res["added_deceptive_keywords"]
    assert res["is_exact_official_match"] is False


def test_exact_official_match():
    res = analyze_handle_impersonation(
        suspicious_handle="brand",
        brand_name="brand",
        official_handles=["brand"]
    )
    assert res["is_exact_official_match"] is True
