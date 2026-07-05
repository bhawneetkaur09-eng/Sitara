from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.qr import service

router = APIRouter(prefix="/api/qr")


@router.get("")
def get_qr(user: CurrentUser, db: Session = Depends(get_db)):
    return service.get_qr_data_url(db, user["restaurantId"])


@router.get("/download")
def download_qr(user: CurrentUser, db: Session = Depends(get_db)):
    svg = service.get_qr_svg(db, user["restaurantId"])
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Content-Disposition": 'attachment; filename="sitara-feedback-qr.svg"'},
    )
