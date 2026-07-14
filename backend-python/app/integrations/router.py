"""HTTP routes for third-party integrations (currently Google Business Profile).

Flow:
  1. Dashboard calls GET /google/connect (authed) -> gets a consent URL.
  2. Browser is sent to Google, owner consents, Google redirects to
     GET /google/callback?code=...&state=... (NOT authed — the signed state
     carries the restaurant id and protects against CSRF).
  3. Callback stores the connection and 302s back into the dashboard.
"""

import logging
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.config import settings
from app.database import get_db
from app.integrations import service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations")


class SelectLocationBody(BaseModel):
    locationName: str


@router.get("/google/connect")
def google_connect(
    user: CurrentUser,
    return_to: str = Query(default="settings"),
):
    """Return the Google OAuth consent URL for the current restaurant.

    ``return_to`` ("settings" | "onboarding") controls where the callback lands.
    """
    return {"authUrl": service.start_connect(user["restaurantId"], return_to)}


@router.get("/google/callback")
async def google_callback(
    db: Session = Depends(get_db),
    code: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
):
    """OAuth redirect target. Not authenticated — trust comes from the signed state."""
    # Default landing if we cannot decode the state (e.g. user denied consent).
    fallback = f"{settings.frontend_url}{service.return_path('settings')}"
    if error or not code or not state:
        reason = error or "missing_code"
        return RedirectResponse(url=f"{fallback}?google=error&reason={reason}")
    try:
        decoded = await service.handle_callback(db, code, state)
    except Exception as exc:  # noqa: BLE001 - always land the user back in the UI
        logger.warning("Google OAuth callback failed: %s", exc)
        detail = getattr(exc, "detail", None) or str(exc) or "unknown_error"
        return RedirectResponse(url=f"{fallback}?google=error&reason={quote(str(detail))}")
    dest = f"{settings.frontend_url}{service.return_path(decoded['returnTo'])}"
    return RedirectResponse(url=f"{dest}?google=connected")


@router.get("/google/status")
def google_status(user: CurrentUser, db: Session = Depends(get_db)):
    return service.get_status(db, user["restaurantId"])


@router.get("/google/locations")
async def google_locations(user: CurrentUser, db: Session = Depends(get_db)):
    return {"locations": await service.list_available_locations(db, user["restaurantId"])}


@router.post("/google/select-location")
async def google_select_location(
    body: SelectLocationBody, user: CurrentUser, db: Session = Depends(get_db)
):
    return await service.select_location(db, user["restaurantId"], body.locationName)


@router.post("/google/disconnect")
def google_disconnect(user: CurrentUser, db: Session = Depends(get_db)):
    return service.disconnect(db, user["restaurantId"])
