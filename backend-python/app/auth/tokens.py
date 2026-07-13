"""Token creation, verification, and refresh-token lifecycle.

Two token types:
  - Access token: short-lived signed JWT, sent in the Authorization header.
    Stateless — verified by signature alone, never hits the DB.
  - Refresh token: long-lived opaque random string, stored hashed in the DB.
    Rotated on every use and revocable, so sessions can be invalidated.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.models import RefreshToken

_ALGORITHM = "HS256"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --- Access token (stateless JWT) ---

def create_access_token(*, user_id: str, restaurant_id: str, role: str, email: str) -> str:
    expire = _now() + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "restaurantId": restaurant_id,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != "access":
        return None
    return payload


# --- Refresh token (opaque, DB-backed, rotating) ---

def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_refresh_token(db: Session, *, user_id: str, restaurant_id: str) -> str:
    """Create and persist a new refresh token. Returns the raw token (shown once)."""
    raw = secrets.token_urlsafe(48)
    record = RefreshToken(
        user_id=user_id,
        restaurant_id=restaurant_id,
        token_hash=_hash_token(raw),
        expires_at=_now() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(record)
    db.flush()
    return raw


def _get_valid_record(db: Session, raw: str) -> Optional[RefreshToken]:
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == _hash_token(raw)).first()
    if not record or record.revoked_at is not None:
        return None
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _now():
        return None
    return record


def rotate_refresh_token(db: Session, raw: str) -> Optional[tuple[RefreshToken, str]]:
    """Validate a refresh token, revoke it, and issue a replacement (rotation).

    Returns (old_record, new_raw_token) or None if the token is invalid/expired.
    """
    record = _get_valid_record(db, raw)
    if not record:
        return None

    record.revoked_at = _now()
    new_raw = issue_refresh_token(db, user_id=record.user_id, restaurant_id=record.restaurant_id)
    db.flush()
    return record, new_raw


def revoke_refresh_token(db: Session, raw: str) -> None:
    record = db.query(RefreshToken).filter(RefreshToken.token_hash == _hash_token(raw)).first()
    if record and record.revoked_at is None:
        record.revoked_at = _now()
        db.flush()


def revoke_all_for_user(db: Session, user_id: str) -> int:
    """Revoke every active session for a user (e.g. on password change / logout-all)."""
    count = (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .update({RefreshToken.revoked_at: _now()}, synchronize_session=False)
    )
    db.flush()
    return count
