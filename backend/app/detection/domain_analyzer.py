import re
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse
from app.detection.normalizer import normalize_domain, canonicalize_homoglyphs
from app.detection.similarity import compute_string_similarity
from app.core.ssrf_protection import validate_url_safety


def analyze_domain(
    url_or_domain: str,
    brand_name: str,
    official_domains: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Analyzes website URLs and domain names for impersonation, punycode,
    homoglyphs, and deceptive structure.
    """
    official_domains = official_domains or []
    is_safe, safety_message = validate_url_safety(url_or_domain)

    raw = url_or_domain.strip().lower()
    uses_https = raw.startswith("https://")
    
    hostname, subdomain, registered_domain = normalize_domain(url_or_domain)
    
    # Punycode detection (IDN Homograph attack, e.g. xn--pple-43d.com)
    is_punycode = "xn--" in hostname
    
    # Check if brand name is in subdomain vs registered domain
    # e.g. legitimate: brand.com
    # phishing: brand.verify-login.com (brand is in subdomain, not registered domain!)
    norm_brand = brand_name.lower().replace(" ", "")
    brand_in_subdomain = norm_brand in subdomain.replace("-", "").replace(".", "")
    brand_in_reg_domain = norm_brand in registered_domain.replace("-", "").replace(".", "")

    # Domain similarity to official domains
    max_official_sim = 0.0
    closest_official_domain = ""
    is_exact_domain_match = False

    for off_domain in official_domains:
        off_host, _, off_reg = normalize_domain(off_domain)
        if registered_domain == off_reg or hostname == off_host:
            is_exact_domain_match = True
        
        sim = compute_string_similarity(registered_domain, off_reg)
        if sim > max_official_sim:
            max_official_sim = sim
            closest_official_domain = off_reg

    # Check homoglyphs in domain
    canonical_reg = canonicalize_homoglyphs(registered_domain)
    has_homoglyph_domain = canonical_reg != registered_domain and compute_string_similarity(canonical_reg, norm_brand) > 0.85

    # Phishing indicators: brand in subdomain of a different domain
    suspicious_subdomain_spoof = brand_in_subdomain and not brand_in_reg_domain

    return {
        "raw_input": url_or_domain,
        "hostname": hostname,
        "subdomain": subdomain,
        "registered_domain": registered_domain,
        "uses_https": uses_https,
        "is_safe_target": is_safe,
        "safety_notes": safety_message,
        "is_punycode": is_punycode,
        "has_homoglyphs": has_homoglyph_domain,
        "brand_in_subdomain": brand_in_subdomain,
        "brand_in_registered_domain": brand_in_reg_domain,
        "suspicious_subdomain_spoof": suspicious_subdomain_spoof,
        "max_official_domain_similarity": round(max_official_sim, 4),
        "closest_official_domain": closest_official_domain,
        "is_exact_official_match": is_exact_domain_match,
    }
