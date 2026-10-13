from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from urllib.parse import parse_qsl, urlencode, urlsplit
from app.detection.normalizer import normalize_handle, normalize_domain
from app.detection.similarity import analyze_handle_impersonation
from app.detection.domain_analyzer import analyze_domain
from app.detection.rule_engine import RuleResult, evaluate_rules


def determine_risk_category(risk_score: float) -> str:
    """Classifies risk score into standard risk tier."""
    if risk_score >= 80.0:
        return "Critical"
    elif risk_score >= 55.0:
        return "High"
    elif risk_score >= 30.0:
        return "Medium"
    else:
        return "Low"


def assess_target_risk(
    platform: str,
    target_url: Optional[str],
    account_handle: Optional[str],
    display_name: Optional[str],
    profile_description: Optional[str],
    brand_name: str,
    official_handles: Optional[List[str]] = None,
    official_domains: Optional[List[str]] = None,
    official_app_identifiers: Optional[List[str]] = None,
    official_app_publishers: Optional[List[str]] = None,
    additional_evidence: Optional[Dict[str, Any]] = None,
    ml_probability: Optional[float] = None
) -> Dict[str, Any]:
    """
    Comprehensive risk evaluation combining string similarities, domain heuristics,
    deterministic rules, ML predictions, and evidence completeness checks.
    """
    official_handles = official_handles or []
    official_domains = official_domains or []
    official_app_identifiers = official_app_identifiers or []
    official_app_publishers = official_app_publishers or []
    additional_evidence = additional_evidence or {}
    app_platforms = {"app_store", "apple_app_store", "google_play"}

    def normalize_app_identifier(value: str) -> str:
        value = value.strip().lower()
        parsed = urlsplit(value if "://" in value else f"//{value}")
        if parsed.netloc:
            query = urlencode(sorted(
                (key, item) for key, item in parse_qsl(parsed.query)
                if key not in {"utm_source", "utm_medium", "utm_campaign", "ref", "uo"}
            ))
            normalized_url = f"{parsed.netloc}{parsed.path}".rstrip("/")
            return f"{normalized_url}?{query}" if query else normalized_url
        return value.rstrip("/")

    missing_evidence = []
    if not account_handle and not target_url:
        missing_evidence.append("Neither handle nor URL was provided.")
    if not profile_description:
        missing_evidence.append("Profile bio/description was not provided.")
    if not display_name:
        missing_evidence.append("Display name was not provided.")

    # Insufficient evidence check: if neither handle nor target url has any data
    is_insufficient = len(missing_evidence) >= 3 and not target_url and not account_handle

    # Handle Analysis
    handle_to_check = account_handle or ""
    if not handle_to_check and target_url:
        handle_to_check = normalize_handle(target_url)

    handle_features = analyze_handle_impersonation(
        suspicious_handle=handle_to_check,
        brand_name=brand_name,
        official_handles=official_handles
    )

    # Domain Analysis (if website or target_url provided)
    domain_to_check = target_url or ""
    domain_features = analyze_domain(
        url_or_domain=domain_to_check,
        brand_name=brand_name,
        official_domains=official_domains
    )

    candidate_app_identifier = (
        additional_evidence.get("app_identifier")
        or target_url
        or account_handle
        or ""
    )
    is_exact_official_app_match = (
        platform.lower() in app_platforms
        and bool(candidate_app_identifier)
        and any(
            normalize_app_identifier(candidate_app_identifier) == normalize_app_identifier(official)
            for official in official_app_identifiers
        )
    )
    handle_features["is_exact_official_app_match"] = is_exact_official_app_match
    if is_exact_official_app_match:
        handle_features["is_exact_official_match"] = True

    # Evaluate Rule Engine
    triggered_rules, rule_score = evaluate_rules(
        handle_analysis=handle_features,
        domain_analysis=domain_features,
        profile_text=profile_description or "",
        platform=platform
    )

    candidate_publisher = additional_evidence.get("publisher")
    if (
        platform.lower() in app_platforms
        and isinstance(candidate_publisher, str)
        and candidate_publisher.strip()
        and official_app_publishers
        and handle_features.get("brand_name_similarity", 0.0) >= 0.65
        and candidate_publisher.strip().casefold()
        not in {publisher.strip().casefold() for publisher in official_app_publishers}
        and not is_exact_official_app_match
    ):
        publisher_rule = RuleResult(
            rule_id="RULE-APP-PUBLISHER-MISMATCH",
            name="Similar App Uses an Unrecognized Publisher",
            severity="medium",
            score_impact=25.0,
            description="The submitted app name resembles the brand, but its reported publisher differs from the registered official app publisher. Publisher mismatch alone does not establish impersonation.",
            supporting_data={
                "reported_publisher": candidate_publisher.strip(),
                "official_publishers": official_app_publishers,
            },
        )
        triggered_rules.append(publisher_rule)
        rule_score = min(100.0, round(rule_score + 25.0, 1))

    # Combine with ML model score
    if ml_probability is None and not is_insufficient:
        try:
            from ml.src.predict import predict_impersonation_risk
            raw_feats = {
                **handle_features,
                **{f"domain_{k}": v for k, v in domain_features.items()},
                "evidence_completeness": round(1.0 - (len(missing_evidence) / 4.0), 2)
            }
            ml_res = predict_impersonation_risk(raw_feats)
            if ml_res.get("ml_available") and ml_res.get("calibrated_probability") is not None:
                ml_probability = ml_res["calibrated_probability"]
        except Exception:
            ml_probability = None

    # Calibrated weight: 65% rule-engine, 35% ML model (or 100% rule if ML unavailable)
    if ml_probability is not None and not is_insufficient:
        ml_score = round(ml_probability * 100.0, 1)
        # If rules caught an exact official match, override
        if handle_features.get("is_exact_official_match") or domain_features.get("is_exact_official_match"):
            final_score = 0.0
        else:
            final_score = round(0.65 * rule_score + 0.35 * ml_score, 1)
    else:
        ml_score = None
        final_score = rule_score

    if is_insufficient:
        final_score = 0.0
        category = "Low"
        uncertainty = "high"
        summary = "Insufficient verifiable evidence provided to establish risk level."
    else:
        category = determine_risk_category(final_score)
        uncertainty = "medium" if len(missing_evidence) > 0 else "low"
        
        if final_score >= 80.0:
            summary = "Critical threat: Target exhibits high-fidelity homoglyphs, deceptive official keywords, or spoofed apex domain."
        elif final_score >= 55.0:
            summary = "High risk: Suspicious resemblance to official brand assets with multiple impersonation indicators detected."
        elif final_score >= 30.0:
            summary = "Medium risk: Moderate similarity detected; could be an affiliated or unverified fan/parody account."
        else:
            summary = "Low risk: No significant deceptive signals or exact official brand asset match found."

    # Build Evidence Items
    evidence_items = []
    
    # 1. Handle similarity evidence
    if handle_features.get("brand_name_similarity", 0) > 0.4:
        evidence_items.append({
            "signal_name": "handle_brand_similarity",
            "signal_type": "similarity",
            "severity": "high" if handle_features.get("brand_name_similarity") > 0.8 else "medium",
            "score_contribution": round(handle_features.get("brand_name_similarity") * 30, 1),
            "title": "Username to Brand Similarity",
            "description": f"Target username '{handle_features.get('norm_suspicious_handle')}' has a {int(handle_features.get('brand_name_similarity')*100)}% similarity to brand '{brand_name}'.",
            "supporting_data": handle_features
        })

    # 2. Deceptive keywords
    if handle_features.get("added_deceptive_keywords"):
        evidence_items.append({
            "signal_name": "deceptive_keywords",
            "signal_type": "content",
            "severity": "high",
            "score_contribution": 35.0,
            "title": "Impersonation Keywords in Username",
            "description": f"Contains deceptive words: {', '.join(handle_features.get('added_deceptive_keywords'))}",
            "supporting_data": {"keywords": handle_features.get("added_deceptive_keywords")}
        })

    # 3. Domain analysis evidence
    if domain_features.get("registered_domain"):
        evidence_items.append({
            "signal_name": "domain_structure",
            "signal_type": "domain",
            "severity": "critical" if domain_features.get("suspicious_subdomain_spoof") or domain_features.get("is_punycode") else "info",
            "score_contribution": 40.0 if domain_features.get("suspicious_subdomain_spoof") else 0.0,
            "title": "Domain & Hostname Inspection",
            "description": f"Registered domain is '{domain_features.get('registered_domain')}'. HTTPS: {domain_features.get('uses_https')}. Safe target: {domain_features.get('is_safe_target')}.",
            "supporting_data": domain_features
        })

    if any(rule.rule_id == "RULE-APP-PUBLISHER-MISMATCH" for rule in triggered_rules):
        evidence_items.append({
            "signal_name": "app_publisher_mismatch",
            "signal_type": "publisher",
            "severity": "medium",
            "score_contribution": 25.0,
            "title": "Similar App Has a Different Publisher",
            "description": "The reported publisher does not match the registered official app publisher. This is a review signal, not proof of impersonation.",
            "supporting_data": {
                "reported_publisher": candidate_publisher.strip(),
                "official_publishers": official_app_publishers,
            },
        })

    # Recommended next actions
    recommended_actions = []
    if category in ("High", "Critical"):
        recommended_actions.append("Initiate platform takedown request via official abuse channel.")
        recommended_actions.append("Send warning broadcast to brand followers regarding active impersonator.")
        recommended_actions.append("Export threat intelligence packet for legal & compliance review.")
    elif category == "Medium":
        recommended_actions.append("Assign security analyst to perform manual profile inspection.")
        recommended_actions.append("Monitor account for suspicious direct messages or external link updates.")
    else:
        recommended_actions.append("No immediate takedown required. Archive scan result.")

    # Flatten extracted features
    all_extracted_features = {
        **handle_features,
        **{f"domain_{k}": v for k, v in domain_features.items()},
        "platform": platform,
        "evidence_completeness": round(1.0 - (len(missing_evidence) / 4.0), 2)
    }

    return {
        "risk_score": final_score,
        "risk_category": category,
        "rule_score": rule_score,
        "ml_score": ml_score,
        "is_insufficient_evidence": is_insufficient,
        "uncertainty_level": uncertainty,
        "summary_reason": summary,
        "triggered_rules": [r.to_dict() for r in triggered_rules],
        "evidence_items": evidence_items,
        "recommended_actions": recommended_actions,
        "missing_evidence": missing_evidence,
        "extracted_features": all_extracted_features,
        "assessed_at": datetime.now(timezone.utc).isoformat(),
        "model_version": "hybrid_v1.0.0"
    }
