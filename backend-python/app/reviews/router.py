from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.reviews import service

router = APIRouter(prefix="/api/reviews")


class ReplyBody(BaseModel):
    replyText: str


@router.get("")
def list_reviews(
    user: CurrentUser,
    db: Session = Depends(get_db),
    source: Optional[str] = None,
    sort: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
):
    return service.find_all(db, user["restaurantId"], source, sort, limit, offset)


@router.get("/stats")
def get_stats(user: CurrentUser, db: Session = Depends(get_db)):
    return service.get_stats(db, user["restaurantId"])


@router.post("/sync")
def sync_reviews(user: CurrentUser, db: Session = Depends(get_db)):
    return service.simulate_sync(db, user["restaurantId"])


@router.post("/{review_id}/reply")
def reply(review_id: str, body: ReplyBody, user: CurrentUser, db: Session = Depends(get_db)):
    return service.reply(db, review_id, user["restaurantId"], body.replyText)


@router.post("/{review_id}/draft-reply")
async def draft_reply(review_id: str, user: CurrentUser, db: Session = Depends(get_db)):
    return await service.draft_ai_reply(db, review_id, user["restaurantId"])


@router.post("/{review_id}/analyze-sentiment")
async def analyze_sentiment(review_id: str, user: CurrentUser, db: Session = Depends(get_db)):
    return await service.analyze_sentiment(db, review_id, user["restaurantId"])
