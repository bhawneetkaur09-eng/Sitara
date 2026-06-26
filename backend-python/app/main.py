import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.alerts.router import router as alerts_router
from app.auth.router import router as auth_router
from app.billing.router import router as billing_router
from app.compliance.router import router as compliance_router
from app.qr.router import router as qr_router
from app.restaurants.router import router as restaurants_router
from app.reviews.router import router as reviews_router
from app.surveys.router import router as surveys_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sitara API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(reviews_router)
app.include_router(surveys_router)
app.include_router(alerts_router)
app.include_router(billing_router)
app.include_router(compliance_router)
app.include_router(qr_router)
app.include_router(restaurants_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sitara-python"}
