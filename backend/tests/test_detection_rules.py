import pytest
from app.detection.risk_engine import assess_target_risk


def test_rule_deceptive_keyword_detected():
    res = assess_target_risk(
        platform="instagram",
        target_url="https://instagram.com/brandguard_support_team",
        account_handle="brandguard_support_team",
        display_name="BrandGuard Official Support",
        profile_description="Official 24/7 customer care team.",
        brand_name="BrandGuard",
        official_handles=["brandguard"],
        official_domains=["brandguard.io"]
    )
    assert res["risk_category"] in ("High", "Critical")
    assert res["risk_score"] >= 55.0
    rule_ids = [r["rule_id"] for r in res["triggered_rules"]]
    assert "RULE-HANDLE-DECEPTIVE-KEYWORD" in rule_ids


def test_multiword_brand_handle_with_deceptive_keyword_is_scored_consistently():
    result = assess_target_risk(
        platform="instagram",
        target_url=None,
        account_handle="northstar_support",
        display_name="Northstar Support",
        profile_description="Official support team.",
        brand_name="Northstar Demo",
        official_handles=["northstar_official"],
    )

    assert result["risk_score"] >= 55.0
    assert result["risk_category"] == "High"
    assert "RULE-HANDLE-DECEPTIVE-KEYWORD" in {
        rule["rule_id"] for rule in result["triggered_rules"]
    }


def test_rule_exact_official_match_is_safe():
    res = assess_target_risk(
        platform="website",
        target_url="https://brandguard.io",
        account_handle=None,
        display_name="BrandGuard Official",
        profile_description="Official website",
        brand_name="BrandGuard",
        official_handles=[],
        official_domains=["brandguard.io"]
    )
    assert res["risk_score"] == 0.0
    assert res["risk_category"] == "Low"


def test_insufficient_evidence_handling():
    res = assess_target_risk(
        platform="x",
        target_url=None,
        account_handle=None,
        display_name=None,
        profile_description=None,
        brand_name="BrandGuard"
    )
    assert res["is_insufficient_evidence"] is True
    assert res["risk_score"] == 0.0
    assert len(res["missing_evidence"]) >= 3


def test_exact_verified_app_listing_is_trusted():
    listing = "https://play.google.com/store/apps/details?id=io.brandguard.app"
    result = assess_target_risk(
        platform="google_play",
        target_url=None,
        account_handle="io.brandguard.app",
        display_name="BrandGuard",
        profile_description="Official BrandGuard mobile app.",
        brand_name="BrandGuard",
        official_app_identifiers=[listing],
        official_app_publishers=["BrandGuard Inc."],
        additional_evidence={
            "app_identifier": listing,
            "publisher": "BrandGuard Inc.",
        },
    )
    assert result["risk_score"] == 0.0
    assert result["extracted_features"]["is_exact_official_app_match"] is True


def test_apple_store_attribution_parameter_does_not_break_official_asset_match():
    result = assess_target_risk(
        platform="apple_app_store",
        target_url="https://apps.apple.com/us/app/northstar/id123?uo=4",
        account_handle="id123",
        display_name="Northstar",
        profile_description="Northstar app listing.",
        brand_name="Northstar",
        official_app_identifiers=["https://apps.apple.com/us/app/northstar/id123"],
        additional_evidence={
            "app_identifier": "https://apps.apple.com/us/app/northstar/id123?uo=4",
        },
    )

    assert result["risk_score"] == 0.0
    assert result["extracted_features"]["is_exact_official_app_match"] is True


def test_similar_app_from_unrecognized_publisher_is_a_review_signal():
    result = assess_target_risk(
        platform="google_play",
        target_url=None,
        account_handle="BrandGuard Wallet",
        display_name="BrandGuard Wallet",
        profile_description="A wallet app.",
        brand_name="BrandGuard",
        official_app_identifiers=["io.brandguard.app"],
        official_app_publishers=["BrandGuard Inc."],
        additional_evidence={
            "app_identifier": "other.wallet",
            "publisher": "Unknown Mobile LLC",
        },
    )
    assert "RULE-APP-PUBLISHER-MISMATCH" in {
        rule["rule_id"] for rule in result["triggered_rules"]
    }
    assert any(
        evidence["signal_name"] == "app_publisher_mismatch"
        for evidence in result["evidence_items"]
    )
    assert result["risk_category"] == "Medium"
    assert result["risk_score"] >= 30.0
    assert any("manual profile inspection" in action for action in result["recommended_actions"])


def test_different_store_app_id_is_not_trusted_as_an_exact_official_match():
    result = assess_target_risk(
        platform="google_play",
        target_url=None,
        account_handle="io.other.brandguard",
        display_name="BrandGuard",
        profile_description="BrandGuard app listing.",
        brand_name="BrandGuard",
        official_app_identifiers=[
            "https://play.google.com/store/apps/details?id=io.official.brandguard"
        ],
        additional_evidence={
            "app_identifier": "https://play.google.com/store/apps/details?id=io.other.brandguard",
        },
    )
    assert result["risk_score"] > 0
    assert result["extracted_features"]["is_exact_official_app_match"] is False
