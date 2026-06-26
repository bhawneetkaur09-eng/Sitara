import bcrypt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import create_access_token
from app.models import Restaurant, User


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _user_response(user: User, restaurant: Restaurant) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "location": restaurant.location,
        },
    }


def register(db: Session, email: str, password: str, name: str, restaurant_name: str, restaurant_location: str) -> dict:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists")

    restaurant = Restaurant(name=restaurant_name, location=restaurant_location)
    db.add(restaurant)
    db.flush()

    user = User(email=email, password=_hash(password), name=name, role="owner", restaurant_id=restaurant.id)
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(restaurant)

    payload = {"sub": user.id, "email": user.email, "role": user.role, "restaurantId": user.restaurant_id}
    return {"access_token": create_access_token(payload), "user": _user_response(user, restaurant)}


def login(db: Session, email: str, password: str) -> dict:
    user = db.query(User).filter(User.email == email).first()
    if not user or not _verify(password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    restaurant = db.query(Restaurant).filter(Restaurant.id == user.restaurant_id).first()

    payload = {"sub": user.id, "email": user.email, "role": user.role, "restaurantId": user.restaurant_id}
    return {"access_token": create_access_token(payload), "user": _user_response(user, restaurant)}


def login_as_user(db: Session, user_id: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    restaurant = db.query(Restaurant).filter(Restaurant.id == user.restaurant_id).first()

    payload = {"sub": user.id, "email": user.email, "role": user.role, "restaurantId": user.restaurant_id}
    return {"access_token": create_access_token(payload), "user": _user_response(user, restaurant)}
