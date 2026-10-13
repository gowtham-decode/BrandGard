import pytest
from app.detection.normalizer import (
    normalize_text,
    normalize_handle,
    normalize_domain,
    canonicalize_homoglyphs,
    extract_added_words,
)


def test_normalize_handle():
    assert normalize_handle("@BrandSupport") == "brandsupport"
    assert normalize_handle("https://instagram.com/brand.official?igsh=123") == "brand.official"
    assert normalize_handle("https://x.com/brand_claims/") == "brand_claims"
    assert normalize_handle("https://t.me/brand_agent") == "brand_agent"


def test_normalize_domain():
    host, sub, reg = normalize_domain("https://secure.brand.com/login")
    assert host == "secure.brand.com"
    assert sub == "secure"
    assert reg == "brand.com"

    host2, sub2, reg2 = normalize_domain("apple.com")
    assert host2 == "apple.com"
    assert reg2 == "apple.com"


def test_canonicalize_homoglyphs():
    # 0 for o, 1 for i, @ for a
    assert canonicalize_homoglyphs("micr0s0ft") == "microsoft"
    assert canonicalize_homoglyphs("@pp1e") == "apple"


def test_extract_added_words():
    words = extract_added_words("brand_support_team", "Brand")
    assert "support" in words
    assert "team" in words
