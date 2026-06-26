import logging
import random
import string
import time
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_META_URL = "https://graph.facebook.com/v21.0"


def _sim_id() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"sim_{int(time.time() * 1000)}_{suffix}"


async def send_survey_template(to: str, template_name: str, restaurant_name: str) -> dict:
    if not settings.whatsapp_token:
        msg_id = _sim_id()
        logger.info("[SIMULATED] Survey sent to %s for '%s' — messageId: %s", to, restaurant_name, msg_id)
        return {"messageId": msg_id, "simulated": True}

    return await _send_template_via_meta(to, template_name, restaurant_name)


async def send_text_message(to: str, text: str) -> dict:
    if not settings.whatsapp_token:
        msg_id = _sim_id()
        logger.info("[SIMULATED] Text message to %s: '%s' — messageId: %s", to, text[:60], msg_id)
        return {"messageId": msg_id, "simulated": True}

    return await _send_text_via_meta(to, text)


def parse_webhook_payload(body: dict) -> Optional[dict]:
    try:
        entry = (body.get("entry") or [{}])[0]
        change = (entry.get("changes") or [{}])[0]
        message = (change.get("value", {}).get("messages") or [None])[0]
        if not message:
            return None

        parsed: dict = {
            "from": message["from"],
            "type": message["type"],
            "timestamp": int(message["timestamp"]),
        }

        if message["type"] == "text":
            parsed["text"] = message.get("text", {}).get("body")
        elif message["type"] in ("interactive", "button"):
            reply = message.get("interactive", {}).get("button_reply") or message.get("button", {}).get("reply")
            if reply:
                parsed["button"] = {"text": reply["title"], "payload": reply["id"]}

        return parsed
    except Exception:
        logger.warning("Failed to parse webhook payload")
        return None


def verify_webhook_token(token: str) -> bool:
    return token == (settings.whatsapp_verify_token or "sitara-dev-verify")


async def _send_template_via_meta(to: str, template_name: str, restaurant_name: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_META_URL}/{settings.whatsapp_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {settings.whatsapp_token}", "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to": to,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": "en"},
                    "components": [{"type": "body", "parameters": [{"type": "text", "text": restaurant_name}]}],
                },
            },
        )
    data = resp.json()
    return {"messageId": (data.get("messages") or [{}])[0].get("id", "unknown"), "simulated": False}


async def _send_text_via_meta(to: str, text: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_META_URL}/{settings.whatsapp_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {settings.whatsapp_token}", "Content-Type": "application/json"},
            json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text}},
        )
    data = resp.json()
    return {"messageId": (data.get("messages") or [{}])[0].get("id", "unknown"), "simulated": False}
