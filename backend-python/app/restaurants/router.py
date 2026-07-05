from typing import Optional

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.config import settings
from app.database import get_db
from app.restaurants import service

router = APIRouter(prefix="/api/restaurant")

_COOKIE_MAX_AGE = settings.jwt_expiration_days * 24 * 60 * 60


class AddLocationBody(BaseModel):
    name: str
    location: str


class UpdateSettingsBody(BaseModel):
    gatingEnabled: Optional[bool] = None
    recoveryOffer: Optional[str] = None
    googlePlaceId: Optional[str] = None
    voiceSetting: Optional[str] = None


@router.get("/locations")
def list_locations(user: CurrentUser, db: Session = Depends(get_db)):
    return service.list_for_user(db, user["id"])


@router.post("/switch/{restaurant_id}")
def switch_location(restaurant_id: str, user: CurrentUser, response: Response, db: Session = Depends(get_db)):
    result = service.switch_location(db, user["id"], restaurant_id)
    response.set_cookie(key="access_token", value=result["access_token"], httponly=True, samesite="lax", max_age=_COOKIE_MAX_AGE)
    return result


@router.post("/add-location")
def add_location(body: AddLocationBody, user: CurrentUser, db: Session = Depends(get_db)):
    return service.add_location(db, user["id"], body.name, body.location)


@router.get("/settings")
def get_settings(user: CurrentUser, db: Session = Depends(get_db)):
    return service.get_settings(db, user["restaurantId"])


@router.patch("/settings")
def update_settings(body: UpdateSettingsBody, user: CurrentUser, db: Session = Depends(get_db)):
    return service.update_settings(db, user["restaurantId"], body.dict(exclude_unset=True))
