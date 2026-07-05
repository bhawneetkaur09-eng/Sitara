import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Customer, Survey

logger = logging.getLogger(__name__)


def get_consent_stats(db: Session, restaurant_id: str) -> dict:
    total = db.query(Customer).filter(Customer.restaurant_id == restaurant_id).count()
    consented = db.query(Customer).filter(Customer.restaurant_id == restaurant_id, Customer.consent_at.isnot(None)).count()
    return {
        "totalCustomers": total,
        "consentedCustomers": consented,
        "consentRate": round(consented / total * 100) if total else 0,
    }


def purge_stale_data(db: Session, restaurant_id: str) -> dict:
    cutoff = datetime.now(timezone.utc) - timedelta(days=365)

    stale = db.query(Customer).filter(Customer.restaurant_id == restaurant_id, Customer.created_at < cutoff).all()
    if not stale:
        return {"purged": 0, "message": "No stale customer data to purge."}

    ids = [c.id for c in stale]
    db.query(Survey).filter(Survey.customer_id.in_(ids)).delete(synchronize_session=False)
    db.query(Customer).filter(Customer.id.in_(ids)).delete(synchronize_session=False)
    db.commit()

    logger.info("DPDP purge: removed %d customers inactive for 12+ months", len(stale))
    return {
        "purged": len(stale),
        "message": f"Purged {len(stale)} customer records inactive for 12+ months (DPDP Act compliance).",
    }


def export_customer_data(db: Session, restaurant_id: str) -> list[dict]:
    customers = db.query(Customer).filter(Customer.restaurant_id == restaurant_id).all()
    result = []
    for c in customers:
        surveys = db.query(Survey).filter(Survey.customer_id == c.id).all()
        result.append({
            "phone": c.phone,
            "name": c.name,
            "consentAt": c.consent_at.isoformat() if c.consent_at else None,
            "createdAt": c.created_at.isoformat() if c.created_at else None,
            "surveyCount": len(surveys),
            "surveys": [
                {"id": s.id, "rating": s.rating, "feedback": s.feedback, "status": s.status, "createdAt": s.created_at.isoformat() if s.created_at else None}
                for s in surveys
            ],
        })
    return result
