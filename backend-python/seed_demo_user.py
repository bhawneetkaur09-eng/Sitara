#!/usr/bin/env python3
"""Seed the database with demo credentials for testing."""

import os
import sys

# Add the project root to the path so we can import app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import Base, User, Restaurant, Membership
from app.auth.service import _hash

# Create tables
Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    # Check if demo user already exists
    demo_email = "owner@spicegarden.in"
    existing = db.query(User).filter(User.email == demo_email).first()

    if existing:
        # Delete and recreate
        db.delete(existing)
        db.commit()
        print(f"✓ Cleared existing demo user")

    # Create demo user
    password = "demo123456"
    user = User(
        email=demo_email,
        password=_hash(password),
        name="Demo Owner"
    )
    db.add(user)
    db.flush()

    # Create demo restaurant
    restaurant = Restaurant(
        name="Spice Garden",
        location="Demo Location"
    )
    db.add(restaurant)
    db.flush()

    # Create membership
    membership = Membership(
        user_id=user.id,
        restaurant_id=restaurant.id,
        role="owner"
    )
    db.add(membership)
    db.commit()

    print(f"✓ Created demo user with these credentials:")
    print(f"  Email: {demo_email}")
    print(f"  Password: {password}")
    print(f"  Restaurant: Spice Garden")

finally:
    db.close()
