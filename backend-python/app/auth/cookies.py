"""Refresh-token cookie helpers shared across auth-issuing routers."""
from fastapi import Response

from app.config import settings

REFRESH_COOKIE = "refresh_token"
REFRESH_MAX_AGE = settings.refresh_token_expire_days * 24 * 60 * 60
# Scope the refresh cookie to the endpoints that use it so it isn't sent on every request.
REFRESH_PATH = "/api/auth"


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=REFRESH_MAX_AGE,
        path=REFRESH_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path=REFRESH_PATH)
