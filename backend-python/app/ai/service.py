import logging
from dataclasses import dataclass

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


@dataclass
class AiDraftRequest:
    review_text: str
    review_rating: int
    review_language: str
    restaurant_name: str
    voice_setting: str
    author_name: str


@dataclass
class SentimentResult:
    sentiment: str  # positive | neutral | negative
    confidence: float


def _simulated_reply(req: AiDraftRequest) -> dict:
    is_hindi = req.review_language == "hi"
    name = req.author_name.split(" ")[0]

    if req.review_rating >= 4:
        reply = (
            f"{name} ji, {req.restaurant_name} mein aapka swagat hai! Aapki tarif sunkar bahut khushi hui. Hum aapko dobara seva karne ke liye tatpar hain. 🙏"
            if is_hindi
            else f"Thank you so much, {name}! We're thrilled to hear you enjoyed your experience at {req.restaurant_name}. Your kind words mean the world to our team. We look forward to welcoming you back soon!"
        )
    elif req.review_rating == 3:
        reply = (
            f"{name} ji, {req.restaurant_name} mein aane ke liye dhanyavaad. Aapki raay humein behtar banane mein madad karegi. Hum aapke anubhav ko sudharne ka poora prayas karenge."
            if is_hindi
            else f"Thank you for your feedback, {name}. We appreciate you taking the time to share your experience at {req.restaurant_name}. We're always working to improve and would love the chance to exceed your expectations next time."
        )
    else:
        reply = (
            f"{name} ji, {req.restaurant_name} mein aapko aisi taklif hui, iske liye hum kshama chahte hain. Aapki shikayat humne note kar li hai aur hum isme sudhar karenge. Kripya humse seedhe sampark karein."
            if is_hindi
            else f"We sincerely apologize for your experience, {name}. This is not the standard we hold ourselves to at {req.restaurant_name}. We've noted your concerns and are taking immediate steps to address them. Please reach out to us directly so we can make this right."
        )
    return {"reply": reply, "provider": "simulated"}


def _simulated_sentiment(_text: str, rating: int) -> SentimentResult:
    if rating >= 4:
        return SentimentResult(sentiment="positive", confidence=0.9)
    if rating == 3:
        return SentimentResult(sentiment="neutral", confidence=0.7)
    return SentimentResult(sentiment="negative", confidence=0.9)


async def draft_reply(req: AiDraftRequest) -> dict:
    if not settings.gemini_api_key:
        return _simulated_reply(req)

    prompt = (
        f'You are a restaurant reply assistant for "{req.restaurant_name}".\n\n'
        f"Write a reply to this customer review. Match the tone: {req.voice_setting}.\n"
        "Match the language of the review (if Hindi, reply in Hindi; if English, reply in English; if Hinglish, reply in Hinglish).\n"
        "Keep it concise (2-3 sentences), genuine, and professional. Never be defensive.\n"
        "Address the customer by first name if possible.\n\n"
        f"Customer: {req.author_name}\n"
        f"Rating: {req.review_rating}/5\n"
        f'Review: "{req.review_text}"\n\nReply:'
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_GEMINI_URL}?key={settings.gemini_api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"maxOutputTokens": 256, "temperature": 0.7},
                },
            )
        data = resp.json()
        reply = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
        return {"reply": reply or _simulated_reply(req)["reply"], "provider": "gemini"}
    except Exception as exc:
        logger.error("Gemini API failed, falling back to simulated: %s", exc)
        return _simulated_reply(req)


async def analyze_sentiment(text: str, rating: int) -> SentimentResult:
    if not settings.gemini_api_key:
        return _simulated_sentiment(text, rating)

    prompt = (
        "Analyze the sentiment of this restaurant review. Reply with ONLY one word: positive, neutral, or negative.\n\n"
        f"Rating: {rating}/5\n"
        f'Review: "{text}"\n\nSentiment:'
    )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{_GEMINI_URL}?key={settings.gemini_api_key}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"maxOutputTokens": 10, "temperature": 0},
                },
            )
        data = resp.json()
        result = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip().lower()
        if result in ("positive", "neutral", "negative"):
            return SentimentResult(sentiment=result, confidence=0.85)
    except Exception as exc:
        logger.error("Gemini sentiment failed, falling back to simulated: %s", exc)

    return _simulated_sentiment(text, rating)
