from typing import Optional

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth.cookies import set_refresh_cookie
from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.restaurants import service

router = APIRouter(prefix="/api/restaurant")


class AddLocationBody(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    location: str = Field(min_length=1, max_length=200)


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
    set_refresh_cookie(response, result.pop("refresh_token"))
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
