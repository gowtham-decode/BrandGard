from typing import Dict, Any, List, Tuple


class RuleResult:
    def __init__(
        self,
        rule_id: str,
        name: str,
        severity: str,
        score_impact: float,
        description: str,
        supporting_data: Dict[str, Any]
    ):
        self.rule_id = rule_id
        self.name = name
        self.severity = severity  # info, low, medium, high, critical
        self.score_impact = score_impact
        self.description = description
        self.supporting_data = supporting_data

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "name": self.name,
            "severity": self.severity,
            "score_impact": self.score_impact,
            "description": self.description,
            "supporting_data": self.supporting_data,
        }


def evaluate_rules(
    handle_analysis: Dict[str, Any],
    domain_analysis: Dict[str, Any],
    profile_text: str = "",
    platform: str = "instagram"
) -> Tuple[List[RuleResult], float]:
    """
    Evaluates explainable deterministic rules against extracted features.
    Returns (triggered_rules, rule_based_score).
    """
    triggered: List[RuleResult] = []
    base_score = 5.0  # Baseline ambient risk for an unknown unverified submission

    # If it is an exact verified official match, immediately score as Legitimate / 0 Risk
    if handle_analysis.get("is_exact_official_match") or domain_analysis.get("is_exact_official_match"):
        return [
            RuleResult(
                rule_id="RULE-OFFICIAL-MATCH",
                name="Exact Official Asset Match",
                severity="info",
                score_impact=-100.0,
                description="Target matches an officially verified and registered brand asset.",
                supporting_data={
                    "handle_match": handle_analysis.get("is_exact_official_match"),
                    "domain_match": domain_analysis.get("is_exact_official_match")
                }
            )
        ], 0.0

    # Rule 1: High Handle Similarity with Deceptive Keyword
    # e.g. "brand_support", "brand_official", "brand_care"
    added_kw = handle_analysis.get("added_deceptive_keywords", [])
    brand_in_handle = handle_analysis.get("brand_in_handle", False)
    if brand_in_handle and len(added_kw) > 0:
        triggered.append(
            RuleResult(
                rule_id="RULE-HANDLE-DECEPTIVE-KEYWORD",
                name="Impersonation Keyword in Username",
                severity="high",
                score_impact=35.0,
                description=f"Username contains the brand name combined with suspicious deceptive keyword(s): {', '.join(added_kw)}.",
                supporting_data={"keywords": added_kw, "handle": handle_analysis.get("norm_suspicious_handle")}
            )
        )

    # Rule 2: Leetspeak / Homoglyph Username Spoofing
    # e.g. "micr0soft", "app1e"
    if handle_analysis.get("has_homoglyph_substitution"):
        triggered.append(
            RuleResult(
                rule_id="RULE-HANDLE-HOMOGLYPH",
                name="Homoglyph / Character Substitution Spoof",
                severity="critical",
                score_impact=40.0,
                description="Username uses character substitution (e.g. 0 for o, 1 for l) to visually mimic the official brand name.",
                supporting_data={
                    "raw_similarity": handle_analysis.get("raw_similarity"),
                    "canonical_similarity": handle_analysis.get("canonical_similarity")
                }
            )
        )

    # Rule 3: High Edit-Distance Near Duplicate (Typosquatting in handle)
    # 0.82 <= similarity < 1.0 without exact match
    handle_sim = handle_analysis.get("brand_name_similarity", 0.0)
    if 0.82 <= handle_sim < 1.0 and not handle_analysis.get("has_homoglyph_substitution") and not added_kw:
        triggered.append(
            RuleResult(
                rule_id="RULE-HANDLE-TYPOSQUAT",
                name="Close Brand Typosquatting in Username",
                severity="medium",
                score_impact=25.0,
                description=f"Username is closely mimicking brand name with high similarity ({int(handle_sim * 100)}%).",
                supporting_data={"similarity": handle_sim}
            )
        )

    # Rule 4: Subdomain Brand Spoofing (e.g. apple.verify-service.com)
    if domain_analysis.get("suspicious_subdomain_spoof"):
        triggered.append(
            RuleResult(
                rule_id="RULE-DOMAIN-SUBDOMAIN-SPOOF",
                name="Brand in Subdomain of Unrelated Domain",
                severity="critical",
                score_impact=45.0,
                description=f"Brand name appears in the subdomain while the apex registered domain is '{domain_analysis.get('registered_domain')}'. This is a classic credential harvesting pattern.",
                supporting_data={
                    "subdomain": domain_analysis.get("subdomain"),
                    "registered_domain": domain_analysis.get("registered_domain")
                }
            )
        )

    # Rule 5: Punycode / Internationalized Domain Name Spoofing
    if domain_analysis.get("is_punycode"):
        triggered.append(
            RuleResult(
                rule_id="RULE-DOMAIN-PUNYCODE",
                name="Punycode / IDN Homograph Domain Detected",
                severity="critical",
                score_impact=45.0,
                description="Domain utilizes punycode (xn--) which frequently hides look-alike Cyrillic or Greek characters to impersonate legitimate brand domains.",
                supporting_data={"hostname": domain_analysis.get("hostname")}
            )
        )

    # Rule 6: Typo-squatted Domain Close to Official Domain
    dom_sim = domain_analysis.get("max_official_domain_similarity", 0.0)
    if 0.80 <= dom_sim < 1.0:
        triggered.append(
            RuleResult(
                rule_id="RULE-DOMAIN-TYPOSQUAT",
                name="Domain Closely Resembles Official Brand Domain",
                severity="high",
                score_impact=35.0,
                description=f"Registered domain '{domain_analysis.get('registered_domain')}' exhibits high similarity ({int(dom_sim * 100)}%) to registered official domain '{domain_analysis.get('closest_official_domain')}'.",
                supporting_data={
                    "similarity": dom_sim,
                    "target_domain": domain_analysis.get("registered_domain"),
                    "official_domain": domain_analysis.get("closest_official_domain")
                }
            )
        )

    # Rule 7: Bio / Description claiming official status while unverified
    lowered_bio = (profile_text or "").lower()
    bio_official_claims = [w for w in ["official account", "official support", "customer care team", "verify your account", "helpdesk 24/7", "send dm for support"] if w in lowered_bio]
    if bio_official_claims:
        triggered.append(
            RuleResult(
                rule_id="RULE-BIO-OFFICIAL-CLAIM",
                name="Unverified Profile Bio Claims Official Affiliation",
                severity="medium",
                score_impact=20.0,
                description=f"Profile bio explicitly asserts official status ({', '.join(bio_official_claims)}) without verification credentials.",
                supporting_data={"claims_detected": bio_official_claims}
            )
        )

    # Calculate aggregate rule score (capped between 0 and 100)
    total_score = base_score + sum(r.score_impact for r in triggered)
    clamped_score = max(0.0, min(100.0, total_score))

    return triggered, round(clamped_score, 1)
