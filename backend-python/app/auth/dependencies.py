from typing import Annotated, Optional

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.tokens import decode_access_token
from app.database import get_db
from app.models import Membership, Restaurant, User


def _extract_bearer(authorization: Optional[str], cookie_token: Optional[str]) -> Optional[str]:
    """Access token from the Authorization header (primary) or cookie (fallback)."""
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1].strip()
    return cookie_token


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    access_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
) -> dict:
    token = _extract_bearer(authorization, access_token)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user_id: str = payload.get("sub", "")
    restaurant_id: str = payload.get("restaurantId", "")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Authorization: the token's restaurant must be one this user actually belongs to.
    membership = (
        db.query(Membership)
        .filter(Membership.user_id == user_id, Membership.restaurant_id == restaurant_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this restaurant")

    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()

    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": membership.role,
        "restaurantId": restaurant_id,
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "location": restaurant.location,
        } if restaurant else None,
    }


CurrentUser = Annotated[dict, Depends(get_current_user)]


def require_role(*allowed_roles: str):
    """Dependency factory to restrict an endpoint to specific roles."""

    def _checker(user: CurrentUser) -> dict:
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return _checker
