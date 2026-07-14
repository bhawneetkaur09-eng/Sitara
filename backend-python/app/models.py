import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str] = mapped_column(String, nullable=False)
    google_place_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    gating_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    plan: Mapped[str] = mapped_column(String, default="starter")
    whatsapp_number: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    voice_setting: Mapped[str] = mapped_column(String, default="friendly")
    recovery_offer: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    memberships: Mapped[List["Membership"]] = relationship(
        "Membership", back_populates="restaurant", cascade="all, delete-orphan"
    )
    customers: Mapped[List["Customer"]] = relationship("Customer", back_populates="restaurant")
    reviews: Mapped[List["Review"]] = relationship("Review", back_populates="restaurant")
    surveys: Mapped[List["Survey"]] = relationship("Survey", back_populates="restaurant")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="restaurant")
    google_integration: Mapped[Optional["GoogleIntegration"]] = relationship(
        "GoogleIntegration", back_populates="restaurant", uselist=False, cascade="all, delete-orphan"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    # A single account (one email) can belong to many restaurants via Membership.
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    memberships: Mapped[List["Membership"]] = relationship(
        "Membership", back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )


class Membership(Base):
    """Join between a User and a Restaurant. Replaces the old cloned-user rows so
    that one account (email) can access multiple locations, each with a role."""

    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "restaurant_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    restaurant_id: Mapped[str] = mapped_column(String, ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String, default="owner")  # owner | manager | staff
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship("User", back_populates="memberships")
    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="memberships")


class RefreshToken(Base):
    """Rotating, revocable refresh tokens. Only the SHA-256 hash of the token is
    stored, so a DB leak does not expose usable tokens."""

    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    # The restaurant context this session is scoped to (which location is active).
    restaurant_id: Mapped[str] = mapped_column(String, ForeignKey("restaurants.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("restaurant_id", "phone"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    restaurant_id: Mapped[str] = mapped_column(String, ForeignKey("restaurants.id", ondelete="CASCADE"))
    phone: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="customers")
    surveys: Mapped[List["Survey"]] = relationship("Survey", back_populates="customer")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("source", "external_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    restaurant_id: Mapped[str] = mapped_column(String, ForeignKey("restaurants.id", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String, nullable=False)
    external_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    author: Mapped[str] = mapped_column(String, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String, default="en")
    sentiment: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    posted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    replied: Mapped[bool] = mapped_column(Boolean, default=False)
    reply_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    replied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="reviews")


class Survey(Base):
    __tablename__ = "surveys"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    restaurant_id: Mapped[str] = mapped_column(String, ForeignKey("restaurants.id", ondelete="CASCADE"))
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id", ondelete="CASCADE"))
    channel: Mapped[str] = mapped_column(String, nullable=False)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="sent")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="surveys")
    customer: Mapped["Customer"] = relationship("Customer", back_populates="surveys")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="survey")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    restaurant_id: Mapped[str] = mapped_column(String, ForeignKey("restaurants.id", ondelete="CASCADE"))
    survey_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("surveys.id", ondelete="SET NULL"), nullable=True
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    table_or_source: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    customer_phone: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="open")
    resolve_note: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="alerts")
    survey: Mapped[Optional["Survey"]] = relationship("Survey", back_populates="alerts")


class GoogleIntegration(Base):
    """A restaurant's connection to its Google Business Profile.

    One row per restaurant. Stores the OAuth refresh token encrypted at rest
    (Fernet ciphertext, never plaintext — same defensive posture as RefreshToken)
    and the Google resource IDs needed to list/reply to reviews. Access tokens
    are short-lived and fetched on demand from the refresh token, so they are
    never persisted here.
    """

    __tablename__ = "google_integrations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    restaurant_id: Mapped[str] = mapped_column(
        String, ForeignKey("restaurants.id", ondelete="CASCADE"), unique=True, index=True
    )
    google_email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    refresh_token_enc: Mapped[str] = mapped_column(Text, nullable=False)
    # Google resource names, e.g. "accounts/123" and "accounts/123/locations/456".
    account_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    location_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    location_title: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    restaurant: Mapped["Restaurant"] = relationship("Restaurant", back_populates="google_integration")
