import pytest
from fastapi.testclient import TestClient
from app.main import app, seed_default_data

seed_default_data()
client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "healthy"


def test_apple_store_search_returns_catalog_observations_and_requires_auth(monkeypatch):
    import uuid
    from types import SimpleNamespace

    suffix = uuid.uuid4().hex[:8]
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"apple-search-{suffix}@example.com",
            "password": "StrongPassword123!",
            "organization_name": f"Apple Search {suffix}",
        },
    )
    assert registered.status_code == 201
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}

    class MockResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "results": [
                    {
                        "trackId": 123,
                        "trackName": "Northstar",
                        "sellerName": "Northstar Inc.",
                        "trackViewUrl": "https://apps.apple.com/us/app/northstar/id123",
                        "artworkUrl100": "https://example.com/art.png",
                        "description": "A mobile app.",
                    },
                    {
                        "trackName": "Untrusted redirect",
                        "trackViewUrl": "https://apps.apple.com.attacker.invalid/app/id999",
                    },
                ]
            }

    def mock_get(url, *, params, timeout, follow_redirects):
        assert url == "https://itunes.apple.com/search"
        assert params["term"] == "Northstar"
        assert params["country"] == "us"
        assert timeout == 8.0
        assert follow_redirects is False
        return MockResponse()

    monkeypatch.setattr("app.api.v1.scans.httpx.get", mock_get)
    response = client.get(
        "/api/v1/scans/app-store/search?term=Northstar",
        headers=headers,
    )
    assert response.status_code == 200
    result = response.json()
    assert result["source"] == "Apple App Store"
    assert result["total"] == 1
    assert result["items"][0]["publisher"] == "Northstar Inc."
    assert result["items"][0]["listing_id"] == "123"
    assert result["items"][0]["observed_at"]
    assert result["items"][0]["country"] == "us"
    assert client.get("/api/v1/scans/app-store/search?term=Northstar").status_code == 401


def test_apple_catalog_selection_persists_client_reported_provenance():
    import uuid

    suffix = uuid.uuid4().hex[:8]
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"apple-provenance-{suffix}@example.com",
            "password": "StrongPassword123!",
            "organization_name": f"Apple Provenance {suffix}",
        },
    )
    assert registered.status_code == 201
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    listing_url = f"https://apps.apple.com/us/app/northstar/id{suffix}"
    response = client.post(
        "/api/v1/scans",
        headers=headers,
        json={
            "brand_name": "Northstar",
            "platform": "apple_app_store",
            "target_url": listing_url,
            "account_handle": f"id{suffix}",
            "display_name": "Northstar",
            "source_observation": {
                "source": "apple_app_store_catalog",
                "source_url": listing_url,
                "record_id": suffix,
                "observed_at": "2026-10-13T00:00:00Z",
                "country": "us",
            },
        },
    )

    assert response.status_code == 201
    provenance = response.json()["source_provenance"]
    assert provenance["origin"] == "apple_app_store_catalog"
    assert provenance["source_name"] == "Apple App Store"
    assert provenance["source_record_id"] == suffix
    assert provenance["attribution_status"] == "client_reported_catalog_selection"
    assert provenance["received_at"]

    mismatched_source = client.post(
        "/api/v1/scans",
        headers=headers,
        json={
            "brand_name": "Northstar",
            "platform": "apple_app_store",
            "target_url": "https://attacker.invalid/app",
            "source_observation": {
                "source": "apple_app_store_catalog",
                "source_url": listing_url,
                "record_id": suffix,
                "observed_at": "2026-10-13T00:00:00Z",
                "country": "us",
            },
        },
    )
    assert mismatched_source.status_code == 422


def test_auth_workflow():
    # Register new user
    import uuid
    random_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": random_email,
            "password": "StrongPassword123!",
            "full_name": "Test Security Officer",
            "organization_name": "CyberSec Org"
        }
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    token = reg_data["access_token"]
    assert token is not None

    # Login with same user
    login_resp = client.post(
        "/api/v1/auth/login",
        json={
            "email": random_email,
            "password": "StrongPassword123!"
        }
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["access_token"] is not None

    # Profile query
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == random_email


def test_scan_submission_and_retrieval():
    # Submit suspicious scan
    scan_resp = client.post(
        "/api/v1/scans",
        json={
            "brand_name": "BrandGuard",
            "platform": "instagram",
            "account_handle": "brandguard_helpdesk",
            "display_name": "BrandGuard Official Support",
            "profile_description": "24/7 technical assistance for BrandGuard users."
        }
    )
    assert scan_resp.status_code == 201
    data = scan_resp.json()
    scan_id = data["id"]
    assert data["risk_assessment"] is not None
    assert data["risk_assessment"]["risk_score"] > 30.0

    # Retrieve scan by id
    get_resp = client.get(f"/api/v1/scans/{scan_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == scan_id


def test_dashboard_summary():
    dash_resp = client.get("/api/v1/dashboard/summary")
    assert dash_resp.status_code == 200
    data = dash_resp.json()
    assert "total_submissions" in data
    assert "high_risk_cases" in data
    assert "risk_distribution" in data
    assert "platform_distribution" in data


def test_only_manually_verified_assets_are_trusted_for_scan_matching():
    import uuid

    suffix = uuid.uuid4().hex[:10]
    email = f"asset-review-{suffix}@example.com"
    headers = {}
    register = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "organization_name": f"Asset Review {suffix}",
        },
    )
    assert register.status_code == 201
    headers["Authorization"] = f"Bearer {register.json()['access_token']}"

    brand_response = client.post(
        "/api/v1/brands",
        headers=headers,
        json={
            "name": f"TestBrand{suffix}",
            "initial_assets": [
                {"platform": "instagram", "raw_identifier": f"@testbrand{suffix}"}
            ],
        },
    )
    assert brand_response.status_code == 201
    brand = brand_response.json()
    asset = brand["official_assets"][0]
    assert asset["is_verified"] is False

    candidate = {
        "brand_id": brand["id"],
        "platform": "instagram",
        "account_handle": f"testbrand{suffix}",
        "display_name": f"TestBrand{suffix}",
        "profile_description": "Submitted account for verification testing.",
    }
    unverified_scan = client.post("/api/v1/scans", headers=headers, json=candidate)
    assert unverified_scan.status_code == 201
    assert unverified_scan.json()["risk_assessment"]["risk_score"] > 0

    verified = client.post(
        f"/api/v1/brands/{brand['id']}/assets/{asset['id']}/verify/manual",
        headers=headers,
        json={"notes": "Reviewed official profile ownership proof."},
    )
    assert verified.status_code == 200
    assert verified.json()["is_verified"] is True

    trusted_scan = client.post("/api/v1/scans", headers=headers, json=candidate)
    assert trusted_scan.status_code == 201
    assert trusted_scan.json()["risk_assessment"]["risk_score"] == 0


def test_dns_challenge_is_checked_before_trusting_website_asset(monkeypatch):
    import uuid
    from types import SimpleNamespace

    suffix = uuid.uuid4().hex[:8]
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"dns-verify-{suffix}@example.com",
            "password": "StrongPassword123!",
            "organization_name": f"DNS Verification {suffix}",
        },
    )
    assert registered.status_code == 201
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    brand_response = client.post(
        "/api/v1/brands",
        headers=headers,
        json={
            "name": f"DNS Brand {suffix}",
            "initial_assets": [
                {"platform": "website", "raw_identifier": f"https://dns-{suffix}.example"}
            ],
        },
    )
    assert brand_response.status_code == 201
    brand = brand_response.json()
    asset = brand["official_assets"][0]

    challenge = client.post(
        f"/api/v1/brands/{brand['id']}/assets/{asset['id']}/verify",
        headers=headers,
    )
    assert challenge.status_code == 200
    assert challenge.json()["verification_method"] == "dns_txt"
    assert challenge.json()["expected_location"] == f"_brandguard-challenge.dns-{suffix}.example"
    assert asset["is_verified"] is False

    monkeypatch.setattr(
        "app.api.v1.brands.dns.resolver.resolve",
        lambda *_args, **_kwargs: [SimpleNamespace(strings=(b"wrong-token",))],
    )
    incomplete = client.post(
        f"/api/v1/brands/{brand['id']}/assets/{asset['id']}/verify/dns",
        headers=headers,
    )
    assert incomplete.status_code == 409
    assert client.get(f"/api/v1/brands/{brand['id']}", headers=headers).json()["official_assets"][0]["is_verified"] is False

    token = challenge.json()["verification_token"]
    monkeypatch.setattr(
        "app.api.v1.brands.dns.resolver.resolve",
        lambda *_args, **_kwargs: [SimpleNamespace(strings=(token.encode("ascii"),))],
    )
    verified = client.post(
        f"/api/v1/brands/{brand['id']}/assets/{asset['id']}/verify/dns",
        headers=headers,
    )
    assert verified.status_code == 200
    assert verified.json()["verification_status"] == "verified"
    assert verified.json()["is_verified"] is True


def test_non_website_asset_cannot_start_dns_verification():
    import uuid

    suffix = uuid.uuid4().hex[:8]
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"dns-social-{suffix}@example.com",
            "password": "StrongPassword123!",
            "organization_name": f"DNS Social {suffix}",
        },
    )
    assert registered.status_code == 201
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    brand_response = client.post(
        "/api/v1/brands",
        headers=headers,
        json={
            "name": f"DNS Social Brand {suffix}",
            "initial_assets": [
                {"platform": "instagram", "raw_identifier": f"@dns-social-{suffix}"}
            ],
        },
    )
    assert brand_response.status_code == 201
    brand = brand_response.json()
    asset = brand["official_assets"][0]
    response = client.post(
        f"/api/v1/brands/{brand['id']}/assets/{asset['id']}/verify",
        headers=headers,
    )
    assert response.status_code == 400


def test_scan_history_and_reviews_are_workspace_scoped():
    import uuid

    suffix = uuid.uuid4().hex[:10]

    def register(email, org):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "StrongPassword123!",
                "organization_name": org,
            },
        )
        assert response.status_code == 201
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    first_headers = register(f"first-{suffix}@example.com", f"First Org {suffix}")
    second_headers = register(f"second-{suffix}@example.com", f"Second Org {suffix}")
    brand_response = client.post(
        "/api/v1/brands",
        headers=first_headers,
        json={"name": f"PrivateBrand{suffix}"},
    )
    assert brand_response.status_code == 201
    scan_response = client.post(
        "/api/v1/scans",
        headers=first_headers,
        json={
            "brand_id": brand_response.json()["id"],
            "platform": "instagram",
            "account_handle": f"privatebrand{suffix}_support",
            "display_name": "Support",
        },
    )
    assert scan_response.status_code == 201
    scan_id = scan_response.json()["id"]

    second_history = client.get("/api/v1/scans", headers=second_headers)
    assert second_history.status_code == 200
    assert scan_id not in {scan["id"] for scan in second_history.json()["items"]}
    assert client.get(f"/api/v1/scans/{scan_id}", headers=second_headers).status_code == 404
    review = client.post(
        f"/api/v1/scans/{scan_id}/review",
        headers=second_headers,
        json={"verdict": "false_positive"},
    )
    assert review.status_code == 404
    summary = client.get("/api/v1/dashboard/summary", headers=second_headers)
    assert summary.status_code == 200
    assert summary.json()["total_submissions"] == 0


def test_self_serve_registration_never_joins_an_existing_organization():
    import uuid

    org_name = f"Private Workspace {uuid.uuid4().hex[:10]}"
    tokens = []
    for index in range(2):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"member-{index}-{uuid.uuid4().hex[:8]}@example.com",
                "password": "StrongPassword123!",
                "organization_name": org_name,
            },
        )
        assert response.status_code == 201
        tokens.append(response.json()["organization_id"])

    assert tokens[0] != tokens[1]


def test_verified_handle_on_another_platform_is_not_an_exact_match():
    import uuid

    suffix = uuid.uuid4().hex[:10]
    email = f"platform-scope-{suffix}@example.com"
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "StrongPassword123!",
            "organization_name": f"Platform Scope {suffix}",
        },
    )
    assert registered.status_code == 201
    headers = {"Authorization": f"Bearer {registered.json()['access_token']}"}
    brand_response = client.post(
        "/api/v1/brands",
        headers=headers,
        json={
            "name": f"PlatformBrand{suffix}",
            "initial_assets": [
                {"platform": "x", "raw_identifier": f"platformbrand{suffix}"}
            ],
        },
    )
    assert brand_response.status_code == 201
    brand = brand_response.json()
    asset = brand["official_assets"][0]
    verified = client.post(
        f"/api/v1/brands/{brand['id']}/assets/{asset['id']}/verify/manual",
        headers=headers,
        json={"notes": "Checked the official X account and ownership evidence."},
    )
    assert verified.status_code == 200
    scan = client.post(
        "/api/v1/scans",
        headers=headers,
        json={
            "brand_id": brand["id"],
            "platform": "instagram",
            "account_handle": f"platformbrand{suffix}",
            "display_name": f"PlatformBrand{suffix}",
        },
    )
    assert scan.status_code == 201
    assert scan.json()["risk_assessment"]["risk_score"] > 0
