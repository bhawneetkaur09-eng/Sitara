import logging
import random
import time
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.ai import service as ai_service
from app.ai.service import AiDraftRequest
from app.models import Restaurant, Review

logger = logging.getLogger(__name__)

_FAKE_REVIEWS = [
    {"source": "google", "author": "New Google User", "rating": 5, "text": "Just discovered this gem! Amazing food and great value.", "language": "en"},
    {"source": "google", "author": "Weekend Visitor", "rating": 4, "text": "Nice atmosphere, food was tasty. Slightly long wait.", "language": "en"},
    {"source": "facebook", "author": "FB Foodie", "rating": 5, "text": "Recommended by a friend and did not disappoint! The biryani is outstanding.", "language": "en"},
    {"source": "facebook", "author": "Local Reviewer", "rating": 3, "text": "Decent food but nothing special. Service could be faster.", "language": "en"},
    {"source": "google", "author": "Naya Customer", "rating": 4, "text": "Bahut accha khana! Paneer butter masala was the best.", "language": "hi"},
]


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


def reply(db: Session, review_id: str, restaurant_id: str, reply_text: str) -> dict:
    from datetime import datetime, timezone

    review = db.query(Review).filter(Review.id == review_id, Review.restaurant_id == restaurant_id).first()
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Review not found")

    review.replied = True
    review.reply_text = reply_text
    review.replied_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(review)
    return _review_dict(review)


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


def simulate_sync(db: Session, restaurant_id: str) -> dict:
    from datetime import datetime, timezone

    picked = random.choice(_FAKE_REVIEWS)
    external_id = f"sync_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"
    sentiment = "positive" if picked["rating"] >= 4 else ("neutral" if picked["rating"] == 3 else "negative")

    review = Review(
        restaurant_id=restaurant_id,
        source=picked["source"],
        external_id=external_id,
        author=picked["author"],
        rating=picked["rating"],
        text=picked["text"],
        language=picked["language"],
        sentiment=sentiment,
        posted_at=datetime.now(timezone.utc),
        replied=False,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    logger.info("Simulated sync: new %s review from '%s' (%d★)", picked["source"], picked["author"], picked["rating"])

    return {"synced": 1, "source": picked["source"], "review": _review_dict(review)}


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
