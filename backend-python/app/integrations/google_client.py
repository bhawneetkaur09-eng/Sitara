"""Thin async wrapper over Google OAuth + Business Profile APIs.

Google splits this across several hosts:
  * OAuth              -> accounts.google.com / oauth2.googleapis.com
  * Accounts           -> mybusinessaccountmanagement.googleapis.com (v1)
  * Locations          -> mybusinessbusinessinformation.googleapis.com (v1)
  * Reviews & replies  -> mybusiness.googleapis.com (v4, the only host that still serves reviews)

Every network call raises a clear ``HTTPException`` on a non-2xx response so callers
(and ultimately the dashboard) get an actionable message instead of a stack trace.
"""

import logging
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, status

from app.config import settings

logger = logging.getLogger(__name__)

_SCOPES = [
    "https://www.googleapis.com/auth/business.manage",
    "openid",
    "email",
]

_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
_ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
_LOCATIONS_HOST = "https://mybusinessbusinessinformation.googleapis.com/v1"
_REVIEWS_HOST = "https://mybusiness.googleapis.com/v4"

# Fields to request for a location (Business Information API requires an explicit mask).
_LOCATION_READ_MASK = "name,title,storefrontAddress"


def _require_oauth_config() -> None:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google integration is not configured on the server.",
        )


def _raise_for_google(resp: httpx.Response, action: str) -> None:
    if resp.is_success:
        return
    detail = f"Google API error while {action} (HTTP {resp.status_code})."
    try:
        err = resp.json().get("error", {})
        message = err.get("message") if isinstance(err, dict) else None
        if message:
            detail = f"Google: {message}"
    except Exception:  # noqa: BLE001 - best-effort message extraction
        pass
    logger.warning("Google API failure while %s: %s -> %s", action, resp.status_code, resp.text[:500])
    # 403 almost always means the Business Profile API is not yet approved for this project.
    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)


def build_consent_url(state: str) -> str:
    """Build the Google OAuth consent URL the owner is redirected to."""
    _require_oauth_config()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": " ".join(_SCOPES),
        "access_type": "offline",   # ask for a refresh token
        "prompt": "consent",        # force refresh token even on re-consent
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Exchange an authorization code for tokens. Returns refresh/access tokens + email."""
    _require_oauth_config()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    _raise_for_google(resp, "exchanging the authorization code")
    tokens = resp.json()
    refresh_token = tokens.get("refresh_token")
    access_token = tokens.get("access_token")
    if not refresh_token:
        # Happens when the account previously consented and Google withheld a new
        # refresh token. prompt=consent normally prevents this.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return a refresh token. Remove the app's access in your "
            "Google account and try connecting again.",
        )
    email = await _fetch_email(access_token)
    return {"refresh_token": refresh_token, "access_token": access_token, "email": email}


async def refresh_access_token(refresh_token: str) -> str:
    """Mint a short-lived access token from a stored refresh token."""
    _require_oauth_config()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
            },
        )
    _raise_for_google(resp, "refreshing the access token")
    access_token = resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Google returned no access token.")
    return access_token


async def _fetch_email(access_token: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(_USERINFO_URL, headers=_auth_header(access_token))
        if resp.is_success:
            return resp.json().get("email")
    except Exception as exc:  # noqa: BLE001 - email is non-critical metadata
        logger.warning("Could not fetch Google userinfo: %s", exc)
    return None


async def list_accounts(access_token: str) -> list[dict]:
    """List the Business Profile accounts this Google user can manage."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(_ACCOUNTS_URL, headers=_auth_header(access_token))
    _raise_for_google(resp, "listing Google Business accounts")
    return resp.json().get("accounts", [])


async def list_locations(access_token: str, account_name: str) -> list[dict]:
    """List locations (individual businesses) under a Business Profile account."""
    locations: list[dict] = []
    page_token = None
    async with httpx.AsyncClient(timeout=20) as client:
        while True:
            params = {"readMask": _LOCATION_READ_MASK, "pageSize": 100}
            if page_token:
                params["pageToken"] = page_token
            resp = await client.get(
                f"{_LOCATIONS_HOST}/{account_name}/locations",
                headers=_auth_header(access_token),
                params=params,
            )
            _raise_for_google(resp, "listing Google locations")
            body = resp.json()
            locations.extend(body.get("locations", []))
            page_token = body.get("nextPageToken")
            if not page_token:
                break
    return locations


async def list_reviews(access_token: str, account_name: str, location_name: str) -> list[dict]:
    """Fetch all reviews for a location and normalize them for our Review model.

    ``location_name`` is the full resource id ("accounts/1/locations/2"); the v4
    reviews endpoint is addressed by that same path.
    """
    reviews: list[dict] = []
    page_token = None
    async with httpx.AsyncClient(timeout=20) as client:
        while True:
            params = {"pageSize": 50}
            if page_token:
                params["pageToken"] = page_token
            resp = await client.get(
                f"{_REVIEWS_HOST}/{location_name}/reviews",
                headers=_auth_header(access_token),
                params=params,
            )
            _raise_for_google(resp, "listing Google reviews")
            body = resp.json()
            for raw in body.get("reviews", []):
                normalized = _normalize_review(raw)
                if normalized:
                    reviews.append(normalized)
            page_token = body.get("nextPageToken")
            if not page_token:
                break
    return reviews


async def reply_to_review(access_token: str, review_name: str, comment: str) -> None:
    """Post (or update) the business reply to a review. ``review_name`` is the full
    resource id: "accounts/1/locations/2/reviews/3"."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.put(
            f"{_REVIEWS_HOST}/{review_name}/reply",
            headers=_auth_header(access_token),
            json={"comment": comment},
        )
    _raise_for_google(resp, "posting a reply to Google")


# --- helpers ---------------------------------------------------------------

_STAR_TO_INT = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}


def _auth_header(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def _normalize_review(raw: dict) -> Optional[dict]:
    """Map a Google review payload to the fields our Review model needs."""
    name = raw.get("reviewId") or raw.get("name")
    if not name:
        return None
    rating = _STAR_TO_INT.get(raw.get("starRating", ""), 0)
    reviewer = raw.get("reviewer", {}) or {}
    reply = raw.get("reviewReply") or {}
    return {
        # Full resource path is what we need to reply; fall back to the short id.
        "external_id": raw.get("name") or name,
        "author": reviewer.get("displayName") or "Google user",
        "rating": rating,
        "text": raw.get("comment"),
        "posted_at": raw.get("createTime"),
        "reply_text": reply.get("comment"),
        "replied": bool(reply.get("comment")),
    }
