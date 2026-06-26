import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import Alert, Customer, Restaurant, Review, Survey
from app.whatsapp import service as wa

logger = logging.getLogger(__name__)


async def send_survey(db: Session, restaurant_id: str, phone: str, customer_name: Optional[str], channel: str) -> dict:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Restaurant not found")

    one_day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = (
        db.query(Survey)
        .join(Customer, Survey.customer_id == Customer.id)
        .filter(Survey.restaurant_id == restaurant_id, Customer.phone == phone, Survey.created_at >= one_day_ago)
        .first()
    )
    if recent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A survey was already sent to this number in the last 24 hours")

    customer = db.query(Customer).filter(Customer.restaurant_id == restaurant_id, Customer.phone == phone).first()
    if customer:
        if customer_name:
            customer.name = customer_name
        db.flush()
    else:
        customer = Customer(
            restaurant_id=restaurant_id,
            phone=phone,
            name=customer_name,
            consent_at=datetime.now(timezone.utc),
        )
        db.add(customer)
        db.flush()

    result = await wa.send_survey_template(to=phone, template_name="sitara_survey_v1", restaurant_name=restaurant.name)

    survey = Survey(restaurant_id=restaurant_id, customer_id=customer.id, channel=channel, status="sent")
    db.add(survey)
    db.commit()
    db.refresh(survey)

    logger.info("Survey %s sent to %s for %s (%s)", survey.id, phone, restaurant.name, "simulated" if result["simulated"] else "live")

    return {"surveyId": survey.id, "messageId": result["messageId"], "simulated": result["simulated"], "phone": phone, "status": "sent"}


async def handle_qr_scan(db: Session, phone: str, restaurant_id: Optional[str] = None) -> dict:
    if restaurant_id:
        restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    else:
        restaurant = db.query(Restaurant).first()

    if not restaurant:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No restaurant found")

    normalized = re.sub(r"\D", "", phone)
    logger.info("QR scan detected from %s for %s", normalized, restaurant.name)
    return await send_survey(db, restaurant.id, normalized, None, "qr")


async def handle_rating(db: Session, survey_id: str, rating: int, feedback: Optional[str] = None) -> dict:
    if not (1 <= rating <= 5):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rating must be between 1 and 5")

    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey not found")
    if survey.rating is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Survey already rated")

    restaurant = db.query(Restaurant).filter(Restaurant.id == survey.restaurant_id).first()
    customer = db.query(Customer).filter(Customer.id == survey.customer_id).first()

    is_happy = rating >= 4
    gating = restaurant.gating_enabled if restaurant else False

    new_status = "rated"
    if gating:
        new_status = "routed_public" if is_happy else "routed_private"

    survey.rating = rating
    survey.feedback = feedback
    survey.status = new_status

    db.add(Review(
        restaurant_id=survey.restaurant_id,
        source="whatsapp",
        external_id=f"wa_survey_{survey_id}",
        author=customer.name if customer and customer.name else (customer.phone if customer else "unknown"),
        rating=rating,
        text=feedback,
        language="en",
        sentiment="positive" if is_happy else ("neutral" if rating == 3 else "negative"),
        posted_at=datetime.now(timezone.utc),
        replied=False,
    ))

    db.commit()
    db.refresh(survey)

    if is_happy and gating and restaurant and customer:
        google_link = (
            f"https://search.google.com/local/writereview?placeid={restaurant.google_place_id}"
            if restaurant.google_place_id
            else "https://g.page/review"
        )
        await wa.send_text_message(
            customer.phone,
            f"So glad you enjoyed your visit to {restaurant.name}! 🌟\n\nWould you mind sharing your experience on Google? It really helps us:\n{google_link}",
        )
        logger.info("Survey %s: happy path — Google review link sent to %s", survey_id, customer.phone)
    elif not is_happy and customer:
        db.add(Alert(
            restaurant_id=survey.restaurant_id,
            survey_id=survey.id,
            rating=rating,
            reason=feedback,
            customer_phone=customer.phone,
            status="open",
        ))
        db.commit()

        if not feedback:
            await wa.send_text_message(
                customer.phone,
                f"We're sorry to hear that your experience at {restaurant.name} wasn't great. What went wrong?\n\n• Food quality\n• Slow service\n• Cleanliness\n• Pricing\n• Other\n\nPlease reply and we'll make it right.",
            )

        if restaurant and restaurant.recovery_offer:
            await wa.send_text_message(
                customer.phone,
                f"Thank you for your feedback. We're truly sorry about your experience. Here's a gesture from us: {restaurant.recovery_offer}\n\nWe hope to serve you better next time! 🙏",
            )

        logger.info("Survey %s: unhappy path — alert created, reason prompt sent to %s", survey_id, customer.phone)

    logger.info("Survey %s rated %d/5 → %s", survey_id, rating, new_status)
    return _survey_dict(survey)


def find_all(db: Session, restaurant_id: str, status_filter: Optional[str], limit: int, offset: int) -> dict:
    query = db.query(Survey).filter(Survey.restaurant_id == restaurant_id)
    if status_filter:
        query = query.filter(Survey.status == status_filter)
    query = query.order_by(Survey.created_at.desc())

    total = query.count()
    surveys = query.offset(offset).limit(limit).all()

    results = []
    for s in surveys:
        d = _survey_dict(s)
        if s.customer:
            d["customer"] = {"id": s.customer.id, "phone": s.customer.phone, "name": s.customer.name}
        results.append(d)

    return {"surveys": results, "total": total}


def get_stats(db: Session, restaurant_id: str) -> dict:
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today - timedelta(days=7)
    month_start = today - timedelta(days=30)

    all_surveys = db.query(Survey).filter(Survey.restaurant_id == restaurant_id).all()

    def _ts(dt: Optional[datetime]) -> Optional[datetime]:
        return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt

    sent_today = sum(1 for s in all_surveys if _ts(s.created_at) and _ts(s.created_at) >= today)
    sent_week = sum(1 for s in all_surveys if _ts(s.created_at) and _ts(s.created_at) >= week_start)
    sent_month = sum(1 for s in all_surveys if _ts(s.created_at) and _ts(s.created_at) >= month_start)

    rated = [s for s in all_surveys if s.rating is not None]
    response_rate = round(len(rated) / len(all_surveys) * 100) if all_surveys else 0
    avg_rating = round(sum(s.rating for s in rated) / len(rated) * 10) / 10 if rated else 0.0

    return {
        "total": len(all_surveys),
        "sentToday": sent_today,
        "sentThisWeek": sent_week,
        "sentThisMonth": sent_month,
        "responded": len(rated),
        "responseRate": response_rate,
        "avgRating": avg_rating,
    }


def _survey_dict(s: Survey) -> dict:
    return {
        "id": s.id,
        "restaurantId": s.restaurant_id,
        "customerId": s.customer_id,
        "channel": s.channel,
        "rating": s.rating,
        "feedback": s.feedback,
        "status": s.status,
        "createdAt": s.created_at.isoformat() if s.created_at else None,
        "updatedAt": s.updated_at.isoformat() if s.updated_at else None,
    }
