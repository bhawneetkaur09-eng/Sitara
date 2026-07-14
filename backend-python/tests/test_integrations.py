"""Tests for the Google Business Profile integration wiring.

Runnable two ways:
  * pytest tests/test_integrations.py
  * python3 tests/test_integrations.py   (no pytest required)

Google's network layer is fully mocked, so these never hit the real API.
"""

import os
import sys

# Allow "import app.*" when run directly from the repo root or tests/.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# A valid Fernet key so crypto import works during collection.
os.environ.setdefault("INTEGRATION_ENC_KEY", "hlLqk6m6m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0m0M=")

from fastapi.testclient import TestClient  # noqa: E402

from app.auth.dependencies import get_current_user  # noqa: E402
from app.main import app  # noqa: E402
from app.integrations import crypto, service  # noqa: E402


_FAKE_USER = {"id": "u1", "restaurantId": "r1", "role": "owner", "email": "o@x.com", "name": "O"}


def _client() -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: _FAKE_USER
    return TestClient(app)


def test_sync_requires_google_connection():
    """Real-only sync: with no GoogleIntegration row, /sync returns a clear 400."""
    client = _client()
    resp = client.post("/api/reviews/sync")
    assert resp.status_code == 400, resp.text
    assert "not connected" in resp.json()["detail"].lower()
    app.dependency_overrides.clear()


def test_status_reports_not_connected():
    client = _client()
    resp = client.get("/api/integrations/google/status")
    assert resp.status_code == 200
    assert resp.json()["connected"] is False
    app.dependency_overrides.clear()


def test_crypto_round_trip():
    ct = crypto.encrypt("secret-token")
    assert ct != "secret-token"
    assert crypto.decrypt(ct) == "secret-token"


def test_oauth_state_round_trip_and_rejects_garbage():
    st = service._encode_state("rest-xyz", "onboarding")
    decoded = service._decode_state(st)
    assert decoded["restaurantId"] == "rest-xyz"
    assert decoded["returnTo"] == "onboarding"
    assert service.return_path("onboarding") == "/onboarding"
    assert service.return_path("settings") == "/dashboard/settings"
    # Unknown return_to falls back to settings (open-redirect defense).
    assert service.return_path("https://evil.com") == "/dashboard/settings"
    try:
        service._decode_state("not-a-jwt")
    except Exception as exc:  # HTTPException
        assert exc.status_code == 400  # type: ignore[attr-defined]
    else:  # pragma: no cover
        raise AssertionError("garbage state was accepted")


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"PASS {name}")
    print("ALL TESTS PASSED")
