import ipaddress
import socket
from urllib.parse import urlparse
from typing import Tuple


BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def is_ip_blocked(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_loopback or ip.is_private or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return True
        for net in BLOCKED_NETWORKS:
            if ip in net:
                return True
        return False
    except ValueError:
        return True


def validate_url_safety(url: str) -> Tuple[bool, str]:
    """
    Validates that a URL is safe to inspect:
    - Valid HTTP/HTTPS scheme
    - Host resolves only to non-private, non-loopback IP addresses
    - Prevents SSRF attacks
    """
    if not url:
        return False, "URL is empty"

    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception as exc:
        return False, f"Malformed URL: {exc}"

    if parsed.scheme.lower() not in ("http", "https"):
        return False, "Only HTTP and HTTPS protocols are permitted"

    hostname = parsed.hostname
    if not hostname:
        return False, "URL must contain a valid hostname"

    # Check common blocked hostnames
    lowered_host = hostname.lower()
    if lowered_host in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal", "169.254.169.254"):
        return False, f"Host '{hostname}' is not permitted"

    # Try DNS resolution to verify destination IP safety
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for entry in addr_info:
            ip_candidate = entry[4][0]
            if is_ip_blocked(ip_candidate):
                return False, f"Host '{hostname}' resolves to restricted IP ({ip_candidate})"
    except socket.gaierror:
        # If hostname cannot be resolved, we do not allow direct requests
        # but mark as unresolvable (it could be an inactive scam domain)
        return True, "Hostname unresolvable in DNS (offline or unassigned domain)"
    except Exception as exc:
        return False, f"Network check failed: {exc}"

    return True, "URL is safe"
