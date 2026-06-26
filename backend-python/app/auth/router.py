from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.dependencies import CurrentUser
from app.config import settings
from app.database import get_db

router = APIRouter(prefix="/api/auth")

_COOKIE_MAX_AGE = settings.jwt_expiration_days * 24 * 60 * 60


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
    )


class RegisterBody(BaseModel):
    email: str
    password: str
    name: str
    restaurantName: str
    restaurantLocation: str


class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/register")
def register(body: RegisterBody, response: Response, db: Session = Depends(get_db)):
    result = service.register(
        db,
        email=body.email,
        password=body.password,
        name=body.name,
        restaurant_name=body.restaurantName,
        restaurant_location=body.restaurantLocation,
    )
    _set_cookie(response, result["access_token"])
    return result


@router.post("/login")
def login(body: LoginBody, response: Response, db: Session = Depends(get_db)):
    result = service.login(db, email=body.email, password=body.password)
    _set_cookie(response, result["access_token"])
    return result


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}


@router.get("/me")
def me(user: CurrentUser):
    return user
