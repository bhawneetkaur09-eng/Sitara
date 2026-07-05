PLAN_FEATURES: dict[str, set[str]] = {
    "starter": {
        "whatsapp_surveys",
        "basic_dashboard",
        "google_reviews",
        "manual_reply",
        "qr_code",
        "alerts",
    },
    "growth": {
        "whatsapp_surveys",
        "basic_dashboard",
        "google_reviews",
        "manual_reply",
        "qr_code",
        "alerts",
        "ai_reply",
        "sentiment_analysis",
        "facebook_reviews",
        "review_gating",
        "advanced_analytics",
        "review_sync",
    },
    "pro": {
        "whatsapp_surveys",
        "basic_dashboard",
        "google_reviews",
        "manual_reply",
        "qr_code",
        "alerts",
        "ai_reply",
        "sentiment_analysis",
        "facebook_reviews",
        "review_gating",
        "advanced_analytics",
        "review_sync",
        "multi_location",
        "custom_branding",
        "priority_support",
        "data_export",
    },
}

PLAN_LIMITS: dict[str, dict] = {
    "starter": {"surveysPerMonth": 100, "locations": 1},
    "growth": {"surveysPerMonth": 500, "locations": 3},
    "pro": {"surveysPerMonth": None, "locations": None},  # None = unlimited
}

PLANS = {
    "starter": {
        "id": "starter",
        "name": "Starter",
        "priceMonthly": 499,
        "priceAnnual": 4990,
        "features": ["WhatsApp surveys", "Basic dashboard", "Google reviews", "Up to 100 surveys/month", "1 location"],
    },
    "growth": {
        "id": "growth",
        "name": "Growth",
        "priceMonthly": 999,
        "priceAnnual": 9990,
        "popular": True,
        "features": [
            "Everything in Starter",
            "AI reply drafting",
            "Sentiment analysis",
            "Facebook reviews",
            "Up to 500 surveys/month",
            "Review gating",
            "3 locations",
        ],
    },
    "pro": {
        "id": "pro",
        "name": "Pro",
        "priceMonthly": 1999,
        "priceAnnual": 19990,
        "features": [
            "Everything in Growth",
            "Unlimited surveys",
            "Unlimited locations",
            "Priority support",
            "Custom branding",
            "Advanced analytics",
        ],
    },
}
