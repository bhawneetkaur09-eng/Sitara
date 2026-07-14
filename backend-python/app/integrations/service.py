"""Orchestration for the Google Business Profile integration.

Ties together the OAuth flow, encrypted token storage, and the review
sync/reply operations that the reviews module calls into.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.integrations import crypto, google_client
from app.models import GoogleIntegration, Restaurant, Review

logger = logging.getLogger(__name__)

_STATE_ALGORITHM = "HS256"
_STATE_TTL_MINUTES = 10


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- OAuth state (CSRF protection + restaurant binding) --------------------

# Where to send the browser after the callback completes. Keyed to avoid an
# open-redirect: the state only carries a key, never a raw URL.
_RETURN_PATHS = {
    "settings": "/dashboard/settings",
    "onboarding": "/onboarding",
}
_DEFAULT_RETURN = "settings"


def _encode_state(restaurant_id: str, return_to: str = _DEFAULT_RETURN) -> str:
    payload = {
        "restaurantId": restaurant_id,
        "returnTo": return_to if return_to in _RETURN_PATHS else _DEFAULT_RETURN,
        "type": "google_oauth",
        "exp": _now() + timedelta(minutes=_STATE_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_STATE_ALGORITHM)


def _decode_state(state: str) -> dict:
    try:
        payload = jwt.decode(state, settings.jwt_secret, algorithms=[_STATE_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OAuth state")
    if payload.get("type") != "google_oauth" or not payload.get("restaurantId"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth state")
    return {
        "restaurantId": payload["restaurantId"],
        "returnTo": payload.get("returnTo", _DEFAULT_RETURN),
    }


def return_path(return_to: str) -> str:
    """Map a return_to key to its safe frontend path (defends against open redirect)."""
    return _RETURN_PATHS.get(return_to, _RETURN_PATHS[_DEFAULT_RETURN])


# --- Connect / callback / status / disconnect ------------------------------

def start_connect(restaurant_id: str, return_to: str = _DEFAULT_RETURN) -> str:
    """Return the Google consent URL for this restaurant to connect."""
    return google_client.build_consent_url(_encode_state(restaurant_id, return_to))


async def handle_callback(db: Session, code: str, state: str) -> dict:
    """Exchange the code, store the encrypted refresh token, auto-select a location
    if there is exactly one. Returns {restaurantId, returnTo}."""
    decoded = _decode_state(state)
    restaurant_id = decoded["restaurantId"]

    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    tokens = await google_client.exchange_code(code)
    access_token = tokens["access_token"]

    integration = (
        db.query(GoogleIntegration).filter(GoogleIntegration.restaurant_id == restaurant_id).first()
    )
    if not integration:
        integration = GoogleIntegration(restaurant_id=restaurant_id)
        db.add(integration)

    integration.refresh_token_enc = crypto.encrypt(tokens["refresh_token"])
    integration.google_email = tokens.get("email")
    integration.connected_at = _now()
    # Reset any previous location selection; it is re-derived below.
    integration.account_name = None
    integration.location_name = None
    integration.location_title = None

    # Persist the connection FIRST so a location-listing failure (e.g. the
    # Business Profile API is not yet approved -> 403) does not discard the
    # successful OAuth. The owner can still pick a location later from Settings.
    db.commit()

    # Auto-select when the account has exactly one location; otherwise the owner
    # picks from the dashboard via select_location. Best-effort — never fatal.
    try:
        locations = await _list_all_locations(access_token)
        if len(locations) == 1:
            loc = locations[0]
            integration.account_name = loc["accountName"]
            integration.location_name = loc["name"]
            integration.location_title = loc.get("title")
            db.commit()
    except Exception as exc:  # noqa: BLE001 - connection already saved
        logger.warning("Connected Google but could not list locations yet: %s", exc)

    return decoded


def get_status(db: Session, restaurant_id: str) -> dict:
    integration = (
        db.query(GoogleIntegration).filter(GoogleIntegration.restaurant_id == restaurant_id).first()
    )
    if not integration:
        return {"connected": False, "email": None, "locationName": None, "locationTitle": None, "lastSyncedAt": None}
    return {
        "connected": True,
        "email": integration.google_email,
        "locationName": integration.location_name,
        "locationTitle": integration.location_title,
        "lastSyncedAt": integration.last_synced_at.isoformat() if integration.last_synced_at else None,
    }


async def list_available_locations(db: Session, restaurant_id: str) -> list[dict]:
    """List the Google locations this connection can manage, for the location picker."""
    integration = _require_integration(db, restaurant_id)
    access_token = await _access_token(integration)
    return await _list_all_locations(access_token)


async def select_location(db: Session, restaurant_id: str, location_name: str) -> dict:
    integration = _require_integration(db, restaurant_id)
    access_token = await _access_token(integration)

    match = next((l for l in await _list_all_locations(access_token) if l["name"] == location_name), None)
    if not match:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found on this account")

    integration.account_name = match["accountName"]
    integration.location_name = match["name"]
    integration.location_title = match.get("title")
    db.commit()
    return get_status(db, restaurant_id)


def disconnect(db: Session, restaurant_id: str) -> dict:
    integration = (
        db.query(GoogleIntegration).filter(GoogleIntegration.restaurant_id == restaurant_id).first()
    )
    if integration:
        db.delete(integration)
        db.commit()
    return {"connected": False}


# --- Reviews sync / reply (called by the reviews module) -------------------

async def sync_reviews(db: Session, restaurant_id: str) -> dict:
    """Pull all Google reviews for the connected location and upsert them."""
    integration = _require_connected_location(db, restaurant_id)
    access_token = await _access_token(integration)

    google_reviews = await google_client.list_reviews(
        access_token, integration.account_name, integration.location_name
    )

    created = 0
    updated = 0
    for gr in google_reviews:
        existing = (
            db.query(Review)
            .filter(Review.source == "google", Review.external_id == gr["external_id"])
            .first()
        )
        posted_at = _parse_time(gr.get("posted_at"))
        if existing:
            # Keep author/rating/text fresh; reflect a reply made outside our app.
            existing.author = gr["author"]
            existing.rating = gr["rating"]
            existing.text = gr["text"]
            if gr["replied"] and not existing.replied:
                existing.replied = True
                existing.reply_text = gr["reply_text"]
            updated += 1
        else:
            db.add(
                Review(
                    restaurant_id=restaurant_id,
                    source="google",
                    external_id=gr["external_id"],
                    author=gr["author"],
                    rating=gr["rating"],
                    text=gr["text"],
                    language="en",
                    posted_at=posted_at or _now(),
                    replied=gr["replied"],
                    reply_text=gr["reply_text"],
                )
            )
            created += 1

    integration.last_synced_at = _now()
    db.commit()

    logger.info("Google sync for %s: %d new, %d updated", restaurant_id, created, updated)
    return {"synced": created + updated, "created": created, "updated": updated, "source": "google"}


async def post_reply(db: Session, restaurant_id: str, external_id: str, comment: str) -> None:
    """Post a reply to a Google review. ``external_id`` is the Google resource name."""
    integration = _require_connected_location(db, restaurant_id)
    access_token = await _access_token(integration)
    await google_client.reply_to_review(access_token, external_id, comment)


# --- internal helpers ------------------------------------------------------

def _require_integration(db: Session, restaurant_id: str) -> GoogleIntegration:
    integration = (
        db.query(GoogleIntegration).filter(GoogleIntegration.restaurant_id == restaurant_id).first()
    )
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Business Profile is not connected. Connect it from Settings.",
        )
    return integration


def _require_connected_location(db: Session, restaurant_id: str) -> GoogleIntegration:
    integration = _require_integration(db, restaurant_id)
    if not integration.location_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Google location selected. Choose a location in Settings.",
        )
    return integration


async def _access_token(integration: GoogleIntegration) -> str:
    refresh_token = crypto.decrypt(integration.refresh_token_enc)
    return await google_client.refresh_access_token(refresh_token)


async def _list_all_locations(access_token: str) -> list[dict]:
    """Flatten locations across every account, tagging each with its accountName."""
    result: list[dict] = []
    for account in await google_client.list_accounts(access_token):
        account_name = account.get("name")
        if not account_name:
            continue
        for loc in await google_client.list_locations(access_token, account_name):
            result.append(
                {
                    "accountName": account_name,
                    "name": loc.get("name"),
                    "title": loc.get("title"),
                }
            )
    return result


def _parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        # Google returns RFC 3339, e.g. "2024-01-02T03:04:05.678Z".
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
