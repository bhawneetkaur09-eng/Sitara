import bcrypt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth import tokens
from app.models import Membership, Restaurant, User


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def _user_response(user: User, restaurant: Restaurant, role: str) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": role,
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "location": restaurant.location,
        },
    }


def _issue_session(db: Session, user: User, restaurant: Restaurant, role: str) -> dict:
    """Create an access token + a fresh refresh token for a (user, restaurant) pair."""
    access_token = tokens.create_access_token(
        user_id=user.id, restaurant_id=restaurant.id, role=role, email=user.email
    )
    refresh_token = tokens.issue_refresh_token(db, user_id=user.id, restaurant_id=restaurant.id)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": _user_response(user, restaurant, role),
    }


def register(
    db: Session, email: str, password: str, name: str, restaurant_name: str, restaurant_location: str
) -> dict:
    email = email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists"
        )

    restaurant = Restaurant(name=restaurant_name, location=restaurant_location)
    db.add(restaurant)
    db.flush()

    user = User(email=email, password=_hash(password), name=name)
    db.add(user)
    db.flush()

    membership = Membership(user_id=user.id, restaurant_id=restaurant.id, role="owner")
    db.add(membership)
    db.flush()

    result = _issue_session(db, user, restaurant, membership.role)
    db.commit()
    return result


def login(db: Session, email: str, password: str) -> dict:
    email = email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not _verify(password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # Default to the user's first membership (earliest joined). Switching happens later.
    membership = (
        db.query(Membership)
        .filter(Membership.user_id == user.id)
        .order_by(Membership.created_at.asc())
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="This account has no restaurant access"
        )

    restaurant = db.query(Restaurant).filter(Restaurant.id == membership.restaurant_id).first()

    result = _issue_session(db, user, restaurant, membership.role)
    db.commit()
    return result


def refresh_session(db: Session, raw_refresh_token: str) -> dict:
    """Exchange a valid refresh token for a new access + refresh token (rotation)."""
    rotated = tokens.rotate_refresh_token(db, raw_refresh_token)
    if not rotated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        )

    old_record, new_refresh_token = rotated
    user = db.query(User).filter(User.id == old_record.user_id).first()

    membership = (
        db.query(Membership)
        .filter(Membership.user_id == old_record.user_id, Membership.restaurant_id == old_record.restaurant_id)
        .first()
    )
    if not user or not membership:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session no longer valid")

    restaurant = db.query(Restaurant).filter(Restaurant.id == membership.restaurant_id).first()

    access_token = tokens.create_access_token(
        user_id=user.id, restaurant_id=restaurant.id, role=membership.role, email=user.email
    )
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "user": _user_response(user, restaurant, membership.role),
    }


def switch_restaurant(db: Session, user_id: str, restaurant_id: str) -> dict:
    """Issue a new session scoped to a different restaurant the user belongs to."""
    membership = (
        db.query(Membership)
        .filter(Membership.user_id == user_id, Membership.restaurant_id == restaurant_id)
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this restaurant"
        )

    user = db.query(User).filter(User.id == user_id).first()
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()

    result = _issue_session(db, user, restaurant, membership.role)
    db.commit()
    return result
