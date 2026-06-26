from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Restaurant, User


def create_access_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expiration_days)
    return jwt.encode(data, settings.jwt_secret, algorithm="HS256")


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> dict:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = _decode_token(access_token)
    user_id: str = payload.get("sub", "")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    restaurant = db.query(Restaurant).filter(Restaurant.id == user.restaurant_id).first()

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "restaurantId": user.restaurant_id,
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "location": restaurant.location,
        } if restaurant else None,
    }


CurrentUser = Annotated[dict, Depends(get_current_user)]
