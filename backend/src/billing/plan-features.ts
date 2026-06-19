export const PLAN_FEATURES: Record<string, Set<string>> = {
  starter: new Set([
    'whatsapp_surveys',
    'basic_dashboard',
    'google_reviews',
    'manual_reply',
    'qr_code',
    'alerts',
  ]),
  growth: new Set([
    'whatsapp_surveys',
    'basic_dashboard',
    'google_reviews',
    'manual_reply',
    'qr_code',
    'alerts',
    'ai_reply',
    'sentiment_analysis',
    'facebook_reviews',
    'review_gating',
    'advanced_analytics',
    'review_sync',
  ]),
  pro: new Set([
    'whatsapp_surveys',
    'basic_dashboard',
    'google_reviews',
    'manual_reply',
    'qr_code',
    'alerts',
    'ai_reply',
    'sentiment_analysis',
    'facebook_reviews',
    'review_gating',
    'advanced_analytics',
    'review_sync',
    'multi_location',
    'custom_branding',
    'priority_support',
    'data_export',
  ]),
};

export const PLAN_LIMITS: Record<
  string,
  { surveysPerMonth: number; locations: number }
> = {
  starter: { surveysPerMonth: 100, locations: 1 },
  growth: { surveysPerMonth: 500, locations: 3 },
  pro: { surveysPerMonth: Infinity, locations: Infinity },
};

export function hasFeature(plan: string, feature: string): boolean {
  return PLAN_FEATURES[plan]?.has(feature) ?? false;
}

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
}
