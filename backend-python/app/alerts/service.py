import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Alert, Restaurant
from app.whatsapp import service as wa

logger = logging.getLogger(__name__)


def find_all(db: Session, restaurant_id: str, status_filter: Optional[str]) -> list:
    query = db.query(Alert).filter(Alert.restaurant_id == restaurant_id)
    if status_filter:
        query = query.filter(Alert.status == status_filter)
    alerts = query.order_by(Alert.created_at.desc()).all()
    return [_alert_dict(a) for a in alerts]


def get_open_count(db: Session, restaurant_id: str) -> int:
    return db.query(Alert).filter(Alert.restaurant_id == restaurant_id, Alert.status == "open").count()


async def resolve(db: Session, alert_id: str, restaurant_id: str, resolve_note: str, send_review_nudge: bool) -> dict:
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.restaurant_id == restaurant_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    alert.status = "resolved"
    alert.resolve_note = resolve_note
    alert.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)

    if send_review_nudge and alert.customer_phone:
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
        if restaurant:
            google_link = (
                f"https://search.google.com/local/writereview?placeid={restaurant.google_place_id}"
                if restaurant.google_place_id
                else "https://g.page/review"
            )
            await wa.send_text_message(
                alert.customer_phone,
                f"Hi from {restaurant.name}! We hope we were able to make things right. 🙏\n\nIf you're happy with how we resolved your concern, we'd really appreciate a review:\n{google_link}\n\nThank you for giving us another chance!",
            )
            logger.info("Recovery nudge sent to %s after resolving alert %s", alert.customer_phone, alert_id)

    return _alert_dict(alert)


def _alert_dict(a: Alert) -> dict:
    d = {
        "id": a.id,
        "restaurantId": a.restaurant_id,
        "surveyId": a.survey_id,
        "rating": a.rating,
        "reason": a.reason,
        "tableOrSource": a.table_or_source,
        "customerPhone": a.customer_phone,
        "status": a.status,
        "resolveNote": a.resolve_note,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
        "resolvedAt": a.resolved_at.isoformat() if a.resolved_at else None,
    }
    if a.survey:
        d["survey"] = {
            "id": a.survey.id,
            "rating": a.survey.rating,
            "feedback": a.survey.feedback,
            "status": a.survey.status,
        }
    return d
