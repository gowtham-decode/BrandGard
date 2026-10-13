from __future__ import annotations

import json
import os
from typing import Dict, Any, List
import numpy as np

FEATURE_NAMES = [
    "brand_name_similarity",
    "canonical_similarity",
    "token_similarity",
    "has_homoglyphs",
    "brand_in_handle",
    "deceptive_keyword_count",
    "max_official_handle_similarity",
    "is_exact_official_match",
    "domain_similarity",
    "is_punycode_domain",
    "subdomain_spoof_flag",
    "uses_https",
    "evidence_completeness"
]


def extract_features_from_dict(raw: Dict[str, Any]) -> Dict[str, float]:
    """Extracts and normalizes features from an extracted features dictionary."""
    return {
        "brand_name_similarity": float(raw.get("brand_name_similarity", 0.0)),
        "canonical_similarity": float(raw.get("canonical_similarity", 0.0)),
        "token_similarity": float(raw.get("token_similarity", 0.0)),
        "has_homoglyphs": 1.0 if raw.get("has_homoglyph_substitution") or raw.get("has_homoglyphs") else 0.0,
        "brand_in_handle": 1.0 if raw.get("brand_in_handle") else 0.0,
        "deceptive_keyword_count": float(len(raw.get("added_deceptive_keywords", []))),
        "max_official_handle_similarity": float(raw.get("max_official_handle_similarity", 0.0)),
        "is_exact_official_match": 1.0 if raw.get("is_exact_official_match") else 0.0,
        "domain_similarity": float(raw.get("domain_max_official_domain_similarity", raw.get("max_official_domain_similarity", 0.0))),
        "is_punycode_domain": 1.0 if raw.get("domain_is_punycode", raw.get("is_punycode", False)) else 0.0,
        "subdomain_spoof_flag": 1.0 if raw.get("domain_suspicious_subdomain_spoof", raw.get("suspicious_subdomain_spoof", False)) else 0.0,
        "uses_https": 1.0 if raw.get("domain_uses_https", raw.get("uses_https", True)) else 0.0,
        "evidence_completeness": float(raw.get("evidence_completeness", 1.0)),
    }


def to_feature_vector(feature_dict: Dict[str, float]) -> np.ndarray:
    """Converts a feature dictionary to an ordered 1D numpy vector."""
    vec = [feature_dict.get(fname, 0.0) for fname in FEATURE_NAMES]
    return np.array(vec, dtype=np.float32)


def to_feature_matrix(samples: List[Dict[str, Any]]) -> np.ndarray:
    """Converts raw samples into a feature matrix in model input order."""
    rows = [to_feature_vector(extract_features_from_dict(sample)) for sample in samples]
    if not rows:
        return np.empty((0, len(FEATURE_NAMES)), dtype=np.float32)
    return np.stack(rows)
