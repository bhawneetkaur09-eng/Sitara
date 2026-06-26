import io
import base64

import qrcode
import qrcode.image.svg

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Restaurant


def _wa_url(restaurant: Restaurant) -> str:
    number = restaurant.whatsapp_number or "919592319964"
    return f"https://wa.me/{number}?text=Hi"


def get_qr_data_url(db: Session, restaurant_id: str) -> dict:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    wa_url = _wa_url(restaurant)

    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(wa_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    data_url = f"data:image/png;base64,{b64}"

    return {"dataUrl": data_url, "whatsappUrl": wa_url, "restaurantName": restaurant.name}


def get_qr_svg(db: Session, restaurant_id: str) -> str:
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    wa_url = _wa_url(restaurant)

    factory = qrcode.image.svg.SvgPathImage
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2, image_factory=factory)
    qr.add_data(wa_url)
    qr.make(fit=True)

    img = qr.make_image()
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode()
