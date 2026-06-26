from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUser
from app.billing import service
from app.database import get_db

router = APIRouter(prefix="/api/billing")


class ChangePlanBody(BaseModel):
    plan: str


@router.get("/plans")
def get_plans():
    return service.get_plans()


@router.get("/features")
def get_features(user: CurrentUser, db: Session = Depends(get_db)):
    return service.get_features(db, user["restaurantId"])


@router.get("")
def get_billing(user: CurrentUser, db: Session = Depends(get_db)):
    return service.get_billing_info(db, user["restaurantId"])


@router.post("/change-plan")
def change_plan(body: ChangePlanBody, user: CurrentUser, db: Session = Depends(get_db)):
    return service.change_plan(db, user["restaurantId"], body.plan)
