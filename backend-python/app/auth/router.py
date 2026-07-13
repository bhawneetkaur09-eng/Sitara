from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth import service, tokens
from app.auth.cookies import clear_refresh_cookie, set_refresh_cookie
from app.auth.dependencies import CurrentUser
from app.database import get_db

router = APIRouter(prefix="/api/auth")


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    restaurantName: str = Field(min_length=1, max_length=200)
    restaurantLocation: str = Field(min_length=1, max_length=200)


class LoginBody(BaseModel):
    email: EmailStr
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
    set_refresh_cookie(response, result.pop("refresh_token"))
    return result


@router.post("/login")
def login(body: LoginBody, response: Response, db: Session = Depends(get_db)):
    result = service.login(db, email=body.email, password=body.password)
    set_refresh_cookie(response, result.pop("refresh_token"))
    return result


@router.post("/refresh")
def refresh(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    result = service.refresh_session(db, refresh_token)
    set_refresh_cookie(response, result.pop("refresh_token"))
    return result


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None),
    db: Session = Depends(get_db),
):
    if refresh_token:
        tokens.revoke_refresh_token(db, refresh_token)
        db.commit()
    clear_refresh_cookie(response)
    return {"message": "Logged out successfully"}


@router.get("/me")
def me(user: CurrentUser):
    return user
