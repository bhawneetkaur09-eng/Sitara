import re
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.surveys import service
from app.whatsapp import service as wa

router = APIRouter(prefix="/api")


class SendSurveyBody(BaseModel):
    phone: str
    customerName: Optional[str] = None
    channel: Optional[str] = "manual"


class SimulateRatingBody(BaseModel):
    rating: int
    feedback: Optional[str] = None


class SimulateScanBody(BaseModel):
    phone: str


@router.post("/surveys/send")
async def send_survey(body: SendSurveyBody, user: CurrentUser, db: Session = Depends(get_db)):
    return await service.send_survey(db, user["restaurantId"], body.phone, body.customerName, body.channel or "manual")


@router.get("/surveys/stats")
def survey_stats(user: CurrentUser, db: Session = Depends(get_db)):
    return service.get_stats(db, user["restaurantId"])


@router.get("/surveys")
def list_surveys(
    user: CurrentUser,
    db: Session = Depends(get_db),
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
):
    return service.find_all(db, user["restaurantId"], status, limit, offset)


@router.post("/surveys/{survey_id}/simulate-rating")
async def simulate_rating(survey_id: str, body: SimulateRatingBody, db: Session = Depends(get_db)):
    return await service.handle_rating(db, survey_id, body.rating, body.feedback)


@router.post("/surveys/simulate-scan")
async def simulate_scan(body: SimulateScanBody, user: CurrentUser, db: Session = Depends(get_db)):
    return await service.handle_qr_scan(db, body.phone, user["restaurantId"])


# --- WhatsApp webhook (public, no auth) ---

@router.get("/webhooks/whatsapp")
def verify_webhook(request: Request):
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")

    if mode == "subscribe" and wa.verify_webhook_token(token):
        return Response(content=challenge, status_code=200)
    return Response(content="Forbidden", status_code=403)


@router.post("/webhooks/whatsapp")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.json()

    message = wa.parse_webhook_payload(body)
    if not message:
        return Response(content="EVENT_RECEIVED", status_code=200)

    if message.get("button"):
        m = re.match(r"^rating_(\d)_(.+)$", message["button"]["payload"])
        if m:
            try:
                await service.handle_rating(db, m.group(2), int(m.group(1)))
            except Exception:
                pass

    elif message.get("type") == "text" and (message.get("text") or "").lower().strip() == "hi":
        try:
            await service.handle_qr_scan(db, message["from"])
        except Exception:
            pass

    return Response(content="EVENT_RECEIVED", status_code=200)
