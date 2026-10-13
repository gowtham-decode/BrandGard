import math
import re
from typing import Dict, Any, List
from app.detection.normalizer import (
    normalize_text,
    normalize_handle,
    canonicalize_homoglyphs,
    extract_added_words,
)

try:
    from rapidfuzz import fuzz, distance
    HAS_RAPIDFUZZ = True
except ImportError:
    HAS_RAPIDFUZZ = False


def levenshtein_distance(s1: str, s2: str) -> int:
    """Pure-python fallback Levenshtein distance."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def compute_string_similarity(s1: str, s2: str) -> float:
    """Returns ratio between 0.0 and 1.0."""
    if not s1 or not s2:
        return 0.0
    if s1 == s2:
        return 1.0

    if HAS_RAPIDFUZZ:
        return fuzz.ratio(s1, s2) / 100.0

    dist = levenshtein_distance(s1, s2)
    max_len = max(len(s1), len(s2))
    return max(0.0, 1.0 - (dist / max_len))


def compute_token_similarity(s1: str, s2: str) -> float:
    """Returns token set ratio between 0.0 and 1.0."""
    if not s1 or not s2:
        return 0.0
    if HAS_RAPIDFUZZ:
        return fuzz.token_set_ratio(s1, s2) / 100.0

    tokens1 = set(s1.split())
    tokens2 = set(s2.split())
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    return len(intersection) / len(union)


def analyze_handle_impersonation(
    suspicious_handle: str,
    brand_name: str,
    official_handles: List[str] = None
) -> Dict[str, Any]:
    """
    Computes comprehensive username and handle similarity metrics.
    """
    official_handles = official_handles or []
    norm_brand = normalize_text(brand_name)
    norm_suspicious = normalize_handle(suspicious_handle)
    canonical_suspicious = canonicalize_homoglyphs(norm_suspicious)

    # Similarity to Brand Name directly
    brand_sim_raw = compute_string_similarity(norm_suspicious, norm_brand)
    brand_sim_canonical = compute_string_similarity(canonical_suspicious, norm_brand)
    brand_token_sim = compute_token_similarity(norm_suspicious, norm_brand)

    # Check similarity against official handles
    max_official_handle_sim = 0.0
    closest_official_handle = ""
    is_exact_official_match = False

    for off_handle in official_handles:
        norm_off = normalize_handle(off_handle)
        if norm_suspicious == norm_off:
            is_exact_official_match = True
        sim = compute_string_similarity(norm_suspicious, norm_off)
        if sim > max_official_handle_sim:
            max_official_handle_sim = sim
            closest_official_handle = norm_off

    # Check deceptive / support keywords
    added_keywords = extract_added_words(norm_suspicious, norm_brand)

    # Match whole brand words too, since handles commonly use separators or omit
    # secondary words from a multi-word brand name.
    brand_tokens = set(re.findall(r"[a-z0-9]+", norm_brand))
    handle_tokens = set(re.findall(r"[a-z0-9]+", canonical_suspicious))
    brand_in_handle = (
        norm_brand in norm_suspicious
        or norm_brand in canonical_suspicious
        or bool(brand_tokens.intersection(handle_tokens))
    )

    # Detect homoglyph manipulation
    has_homoglyphs = brand_sim_canonical > brand_sim_raw and brand_sim_canonical >= 0.80

    return {
        "norm_suspicious_handle": norm_suspicious,
        "canonical_handle": canonical_suspicious,
        "brand_name_similarity": round(max(brand_sim_raw, brand_sim_canonical), 4),
        "raw_similarity": round(brand_sim_raw, 4),
        "canonical_similarity": round(brand_sim_canonical, 4),
        "token_similarity": round(brand_token_sim, 4),
        "brand_in_handle": brand_in_handle,
        "has_homoglyph_substitution": has_homoglyphs,
        "added_deceptive_keywords": added_keywords,
        "max_official_handle_similarity": round(max_official_handle_sim, 4),
        "closest_official_handle": closest_official_handle,
        "is_exact_official_match": is_exact_official_match,
    }
