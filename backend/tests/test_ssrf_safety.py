import pytest
from app.core.ssrf_protection import validate_url_safety, is_ip_blocked


def test_blocked_private_ips():
    assert is_ip_blocked("127.0.0.1") is True
    assert is_ip_blocked("10.0.0.1") is True
    assert is_ip_blocked("192.168.1.1") is True
    assert is_ip_blocked("169.254.169.254") is True
    assert is_ip_blocked("8.8.8.8") is False


def test_url_safety_validation():
    safe, _ = validate_url_safety("http://localhost:8000/admin")
    assert safe is False

    safe, _ = validate_url_safety("http://127.0.0.1/status")
    assert safe is False

    safe, _ = validate_url_safety("ftp://example.com/file")
    assert safe is False

    safe, _ = validate_url_safety("https://brandguard.io")
    assert safe is True
