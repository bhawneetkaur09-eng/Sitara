import logging
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai import service as ai_service
from app.ai.service import AiDraftRequest
from app.integrations import service as integrations_service
from app.models import Restaurant, Review

logger = logging.getLogger(__name__)


def find_all(db: Session, restaurant_id: str, source: Optional[str], sort: Optional[str], limit: int, offset: int) -> dict:
    query = db.query(Review).filter(Review.restaurant_id == restaurant_id)

    if source and source != "all":
        query = query.filter(Review.source == source)

    if sort == "lowest":
        query = query.order_by(Review.rating.asc())
    else:
        query = query.order_by(Review.posted_at.desc())

    total = query.count()
    reviews = query.offset(offset).limit(limit).all()

    return {"reviews": [_review_dict(r) for r in reviews], "total": total}


def get_stats(db: Session, restaurant_id: str) -> dict:
    reviews = db.query(Review).filter(Review.restaurant_id == restaurant_id).all()
    total = len(reviews)
    avg = round(sum(r.rating for r in reviews) / total * 10) / 10 if total else 0.0

    distribution = [{"rating": s, "count": sum(1 for r in reviews if r.rating == s)} for s in range(1, 6)]

    by_source = []
    for src in ("google", "facebook", "whatsapp"):
        src_reviews = [r for r in reviews if r.source == src]
        src_avg = round(sum(r.rating for r in src_reviews) / len(src_reviews) * 10) / 10 if src_reviews else 0.0
        by_source.append({"source": src, "count": len(src_reviews), "avgRating": src_avg})

    negatives = sum(1 for r in reviews if r.sentiment == "negative")

    return {
        "total": total,
        "avgRating": avg,
        "distribution": distribution,
        "bySource": by_source,
        "negativesIntercepted": negatives,
    }


async def reply(db: Session, review_id: str, restaurant_id: str, reply_text: str) -> dict:
    from datetime import datetime, timezone

    review = db.query(Review).filter(Review.id == review_id, Review.restaurant_id == restaurant_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    # For Google reviews, post to Google FIRST so a failure surfaces to the owner
    # before we mark it replied locally (keeps the dashboard honest).
    google_warning: Optional[str] = None
    if review.source == "google" and review.external_id:
        try:
            await integrations_service.post_reply(db, restaurant_id, review.external_id, reply_text)
        except HTTPException as exc:
            # Save locally anyway, but tell the owner the reply did not reach Google.
            google_warning = str(exc.detail)
            logger.warning("Reply saved locally but not posted to Google: %s", exc.detail)

    review.replied = True
    review.reply_text = reply_text
    review.replied_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)

    result = _review_dict(review)
    if google_warning:
        result["googleWarning"] = google_warning
    return result


async def draft_ai_reply(db: Session, review_id: str, restaurant_id: str) -> dict:
    review = db.query(Review).filter(Review.id == review_id, Review.restaurant_id == restaurant_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurant not found")

    result = await ai_service.draft_reply(AiDraftRequest(
        review_text=review.text or "(No text)",
        review_rating=review.rating,
        review_language=review.language,
        restaurant_name=restaurant.name,
        voice_setting=restaurant.voice_setting,
        author_name=review.author,
    ))

    return {"reviewId": review.id, "draftReply": result["reply"], "provider": result["provider"]}


async def analyze_sentiment(db: Session, review_id: str, restaurant_id: str) -> dict:
    review = db.query(Review).filter(Review.id == review_id, Review.restaurant_id == restaurant_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    result = await ai_service.analyze_sentiment(review.text or "", review.rating)

    review.sentiment = result.sentiment
    db.commit()

    return {"reviewId": review.id, "sentiment": result.sentiment, "confidence": result.confidence}


async def sync_reviews(db: Session, restaurant_id: str) -> dict:
    """Pull real reviews from the connected Google Business Profile.

    Real-only: if Google is not connected (or no location is selected), the
    integrations service raises a clear 400 telling the owner to connect first.
    """
    return await integrations_service.sync_reviews(db, restaurant_id)


def _review_dict(r: Review) -> dict:
    return {
        "id": r.id,
        "restaurantId": r.restaurant_id,
        "source": r.source,
        "externalId": r.external_id,
        "author": r.author,
        "rating": r.rating,
        "text": r.text,
        "language": r.language,
        "sentiment": r.sentiment,
        "postedAt": r.posted_at.isoformat() if r.posted_at else None,
        "replied": r.replied,
        "replyText": r.reply_text,
        "repliedAt": r.replied_at.isoformat() if r.replied_at else None,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
    }
