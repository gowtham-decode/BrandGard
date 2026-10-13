import re
import unicodedata
from urllib.parse import urlparse
from typing import Dict, Optional, Tuple

# Common deceptive/support keywords often prepended or appended in impersonation attacks
DECEPTIVE_KEYWORDS = {
    "official", "support", "help", "helpdesk", "claims", "service", "customerservice",
    "care", "customercare", "desk", "verify", "verified", "security", "team", "supportteam",
    "bot", "agent", "advisor", "refund", "billing", "update", "alert", "giveaway",
    "rewards", "airdrop", "promo", "crypto", "free", "login", "auth", "portal", "techsupport"
}

# Leetspeak / homoglyph mapping to standard ascii
LEET_HOMOGLYPH_MAP: Dict[str, str] = {
    "0": "o",
    "1": "l",
    "|": "l",
    "!": "i",
    "@": "a",
    "$": "s",
    "5": "s",
    "3": "e",
    "4": "a",
    "7": "t",
    "8": "b",
    "+": "t",
    "vv": "w",
}


def normalize_text(text: Optional[str]) -> str:
    """Removes accents, lowercase, strips whitespace and special characters."""
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("utf-8")
    text = text.lower().strip()
    return text


def normalize_handle(handle: Optional[str]) -> str:
    """Normalizes social media username/handle: removes leading @, punctuation, lowercases."""
    if not handle:
        return ""
    h = handle.strip().lower()
    if h.startswith("@"):
        h = h[1:]
    # Strip URL prefix if a full profile link was pasted
    if "instagram.com/" in h:
        h = h.split("instagram.com/")[-1].split("?")[0].split("/")[0]
    elif "twitter.com/" in h:
        h = h.split("twitter.com/")[-1].split("?")[0].split("/")[0]
    elif "x.com/" in h:
        h = h.split("x.com/")[-1].split("?")[0].split("/")[0]
    elif "t.me/" in h:
        h = h.split("t.me/")[-1].split("?")[0].split("/")[0]
    elif "facebook.com/" in h:
        h = h.split("facebook.com/")[-1].split("?")[0].split("/")[0]

    # Clean trailing slashes or parameters
    h = h.strip("/").strip()
    return h


def normalize_domain(url_or_domain: Optional[str]) -> Tuple[str, str, str]:
    """
    Returns (domain, subdomain, registered_domain).
    Handles http/https prefixes and punycode.
    """
    if not url_or_domain:
        return "", "", ""
    
    raw = url_or_domain.strip().lower()
    if not raw.startswith("http://") and not raw.startswith("https://"):
        raw = "https://" + raw

    try:
        parsed = urlparse(raw)
        hostname = parsed.hostname or ""
    except Exception:
        hostname = raw

    # Strip port if present
    if ":" in hostname:
        hostname = hostname.split(":")[0]

    parts = hostname.split(".")
    if len(parts) <= 2:
        registered_domain = hostname
        subdomain = ""
    else:
        # Simple heuristic: last two parts are registered domain (e.g. brand.com)
        # unless ccTLD (e.g. brand.co.uk)
        if len(parts) >= 3 and parts[-2] in ("co", "com", "org", "gov", "edu", "net") and len(parts[-1]) == 2:
            registered_domain = ".".join(parts[-3:])
            subdomain = ".".join(parts[:-3])
        else:
            registered_domain = ".".join(parts[-2:])
            subdomain = ".".join(parts[:-2])

    return hostname, subdomain, registered_domain


def canonicalize_homoglyphs(text: str) -> str:
    """Translates common leetspeak substitutions to standard characters for similarity checks."""
    result = text.lower()
    for leet, normal in LEET_HOMOGLYPH_MAP.items():
        result = result.replace(leet, normal)
    # Deduplicate consecutive characters (e.g. 'appple' -> 'apple')
    result = re.sub(r"(.)\1{2,}", r"\1\1", result)
    return result


def extract_added_words(suspicious_handle: str, brand_name: str) -> list[str]:
    """Detects if suspicious handle is composed of brand name + suspicious keywords."""
    norm_brand = normalize_text(brand_name)
    norm_handle = normalize_handle(suspicious_handle)
    
    if not norm_brand or not norm_handle:
        return []

    brand_parts = set(re.findall(r"[a-z0-9]+", norm_brand))
    handle_parts = re.split(r"[._\-0-9]+", norm_handle)
    matched_brand_parts = brand_parts.intersection(handle_parts)
    if not matched_brand_parts:
        compact_brand = "".join(re.findall(r"[a-z0-9]+", norm_brand))
        compact_handle = re.sub(r"[._\-0-9]+", "", norm_handle)
        if not compact_brand or compact_brand not in compact_handle:
            return []
        compact_handle = compact_handle.replace(compact_brand, "", 1)
        handle_parts = re.split(r"[._\-0-9]+", compact_handle)
    else:
        handle_parts = [part for part in handle_parts if part not in matched_brand_parts]
    
    found_keywords = [
        part for part in handle_parts
        if part in DECEPTIVE_KEYWORDS
    ]
    return found_keywords
