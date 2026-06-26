from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.alerts import service
from app.auth.dependencies import CurrentUser
from app.database import get_db

router = APIRouter(prefix="/api/alerts")


class ResolveBody(BaseModel):
    resolveNote: str
    sendReviewNudge: bool = False


@router.get("")
def list_alerts(user: CurrentUser, db: Session = Depends(get_db), status: Optional[str] = None):
    return service.find_all(db, user["restaurantId"], status)


@router.get("/count")
def open_count(user: CurrentUser, db: Session = Depends(get_db)):
    return {"count": service.get_open_count(db, user["restaurantId"])}


@router.post("/{alert_id}/resolve")
async def resolve(alert_id: str, body: ResolveBody, user: CurrentUser, db: Session = Depends(get_db)):
    return await service.resolve(db, alert_id, user["restaurantId"], body.resolveNote, body.sendReviewNudge)
