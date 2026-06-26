import logging
from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.billing.plan_features import PLAN_FEATURES, PLAN_LIMITS, PLANS
from app.models import Restaurant, Survey

logger = logging.getLogger(__name__)


def get_plans() -> list[dict]:
    return list(PLANS.values())


def get_billing_info(db: Session, restaurant_id: str) -> dict:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Restaurant not found")

    plan = PLANS.get(restaurant.plan, PLANS["starter"])

    survey_count = db.query(Survey).filter(Survey.restaurant_id == restaurant_id).count()
    location_count = max(
        db.query(Restaurant).join(Restaurant.users).filter(Restaurant.users.any(restaurant_id=restaurant_id)).count(),
        1,
    )

    return {
        "currentPlan": plan,
        "usage": {"surveysThisMonth": survey_count, "locations": location_count},
        "billingCycle": "monthly",
        "nextBillingDate": _next_billing_date(),
        "paymentMethod": None,
    }


def change_plan(db: Session, restaurant_id: str, new_plan: str) -> dict:
    if new_plan not in PLANS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid plan: {new_plan}. Must be starter, growth, or pro.")

    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Restaurant not found")

    old_plan = restaurant.plan
    restaurant.plan = new_plan
    db.commit()

    logger.info("Restaurant %s changed plan: %s → %s", restaurant.name, old_plan, new_plan)

    return {
        "previousPlan": old_plan,
        "newPlan": new_plan,
        "plan": PLANS[new_plan],
        "message": f"Plan changed to {PLANS[new_plan]['name']}. In production, Razorpay subscription would be updated.",
    }


def get_features(db: Session, restaurant_id: str) -> dict:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    plan = restaurant.plan or "starter"
    features = PLAN_FEATURES.get(plan, PLAN_FEATURES["starter"])
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["starter"])

    return {"plan": plan, "features": list(features), "limits": limits}


def _next_billing_date() -> str:
    today = date.today()
    if today.month == 12:
        return date(today.year + 1, 1, 1).isoformat()
    return date(today.year, today.month + 1, 1).isoformat()
