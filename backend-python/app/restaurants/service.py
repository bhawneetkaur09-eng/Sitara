from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.models import Restaurant, User


def list_for_user(db: Session, user_id: str) -> list[dict]:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    users = db.query(User).filter(User.email == user.email).all()
    result = []
    for u in users:
        r = db.query(Restaurant).filter(Restaurant.id == u.restaurant_id).first()
        if r:
            result.append({"id": r.id, "name": r.name, "location": r.location, "plan": r.plan})
    return result


def switch_location(db: Session, user_id: str, restaurant_id: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target = db.query(User).filter(User.email == user.email, User.restaurant_id == restaurant_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You do not have access to this restaurant")

    return auth_service.login_as_user(db, target.id)


def add_location(db: Session, user_id: str, name: str, location: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    restaurant = Restaurant(name=name, location=location)
    db.add(restaurant)
    db.flush()

    new_user = User(
        email=user.email,
        password=user.password,
        name=user.name,
        role=user.role,
        restaurant_id=restaurant.id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(restaurant)

    return {"id": restaurant.id, "name": restaurant.name, "location": restaurant.location}


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
