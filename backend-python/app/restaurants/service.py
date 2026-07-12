from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.models import Membership, Restaurant, User


def list_for_user(db: Session, user_id: str) -> list[dict]:
    memberships = db.query(Membership).filter(Membership.user_id == user_id).all()
    result = []
    for m in memberships:
        r = db.query(Restaurant).filter(Restaurant.id == m.restaurant_id).first()
        if r:
            result.append({"id": r.id, "name": r.name, "location": r.location, "plan": r.plan, "role": m.role})
    return result


def switch_location(db: Session, user_id: str, restaurant_id: str) -> dict:
    # Membership check + new session is handled in the auth service.
    return auth_service.switch_restaurant(db, user_id, restaurant_id)


def add_location(db: Session, user_id: str, name: str, location: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    restaurant = Restaurant(name=name, location=location)
    db.add(restaurant)
    db.flush()

    # Grant the creating user owner access to the new location — no cloned user row.
    membership = Membership(user_id=user.id, restaurant_id=restaurant.id, role="owner")
    db.add(membership)
    db.commit()
    db.refresh(restaurant)

    return {"id": restaurant.id, "name": restaurant.name, "location": restaurant.location, "role": "owner"}


def get_settings(db: Session, restaurant_id: str) -> dict:
    r = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")
    return {
        "gatingEnabled": r.gating_enabled,
        "recoveryOffer": r.recovery_offer,
        "googlePlaceId": r.google_place_id,
        "whatsappNumber": r.whatsapp_number,
        "voiceSetting": r.voice_setting,
    }


def update_settings(db: Session, restaurant_id: str, data: dict) -> dict:
    r = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    if "gatingEnabled" in data:
        r.gating_enabled = data["gatingEnabled"]
    if "recoveryOffer" in data:
        r.recovery_offer = data["recoveryOffer"]
    if "googlePlaceId" in data:
        r.google_place_id = data["googlePlaceId"]
    if "voiceSetting" in data:
        r.voice_setting = data["voiceSetting"]

    db.commit()
    db.refresh(r)
    return get_settings(db, restaurant_id)
