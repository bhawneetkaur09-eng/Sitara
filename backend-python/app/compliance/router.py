from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.compliance import service
from app.database import get_db

router = APIRouter(prefix="/api/compliance")


@router.get("/consent-stats")
def consent_stats(user: CurrentUser, db: Session = Depends(get_db)):
    return service.get_consent_stats(db, user["restaurantId"])


@router.post("/purge-stale")
def purge_stale(user: CurrentUser, db: Session = Depends(get_db)):
    return service.purge_stale_data(db, user["restaurantId"])


@router.get("/export")
def export_data(user: CurrentUser, db: Session = Depends(get_db)):
    return service.export_customer_data(db, user["restaurantId"])
