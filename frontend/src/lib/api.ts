const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ access_token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (data: {
      email: string;
      password: string;
      name: string;
      restaurantName: string;
      restaurantLocation: string;
    }) =>
      request<{ access_token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: () =>
      request('/api/auth/logout', { method: 'POST' }),
    me: () => request<User>('/api/auth/me'),
  },
  reviews: {
    list: (params?: { source?: string; sort?: string; limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.source) searchParams.set('source', params.source);
      if (params?.sort) searchParams.set('sort', params.sort);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      const qs = searchParams.toString();
      return request<{ reviews: Review[]; total: number }>(`/api/reviews${qs ? `?${qs}` : ''}`);
    },
    stats: () => request<ReviewStats>('/api/reviews/stats'),
    reply: (id: string, replyText: string) =>
      request<Review>(`/api/reviews/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ replyText }),
      }),
    draftReply: (id: string) =>
      request<{ reviewId: string; draftReply: string; provider: string }>(
        `/api/reviews/${id}/draft-reply`,
        { method: 'POST' },
      ),
    sync: () =>
      request<{ synced: number; source: string; review: Review }>(
        '/api/reviews/sync',
        { method: 'POST' },
      ),
  },
  alerts: {
    list: (status?: string) =>
      request<Alert[]>(`/api/alerts${status ? `?status=${status}` : ''}`),
    count: () => request<{ count: number }>('/api/alerts/count'),
    resolve: (id: string, resolveNote: string, sendReviewNudge: boolean = false) =>
      request<Alert>(`/api/alerts/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolveNote, sendReviewNudge }),
      }),
  },
  billing: {
    getPlans: () => request<PlanTier[]>('/api/billing/plans'),
    getCurrent: () => request<BillingInfo>('/api/billing'),
    changePlan: (plan: string) =>
      request<{ previousPlan: string; newPlan: string; message: string }>(
        '/api/billing/change-plan',
        { method: 'POST', body: JSON.stringify({ plan }) },
      ),
    getFeatures: () => request<PlanFeatures>('/api/billing/features'),
  },
  compliance: {
    consentStats: () => request<ConsentStats>('/api/compliance/consent-stats'),
    purgeStale: () =>
      request<{ purged: number; message: string }>('/api/compliance/purge-stale', {
        method: 'POST',
      }),
    exportData: () =>
      request<Record<string, unknown>[]>('/api/compliance/export'),
  },
  restaurant: {
    getSettings: () => request<RestaurantSettings>('/api/restaurant/settings'),
    updateSettings: (data: Partial<RestaurantSettings>) =>
      request<RestaurantSettings>('/api/restaurant/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    listLocations: () => request<LocationInfo[]>('/api/restaurant/locations'),
    switchLocation: (restaurantId: string) =>
      request<SwitchLocationResult>(`/api/restaurant/switch/${restaurantId}`, {
        method: 'POST',
      }),
    addLocation: (data: { name: string; location: string }) =>
      request<LocationInfo>('/api/restaurant/add-location', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  qr: {
    get: () => request<QrData>('/api/qr'),
    downloadUrl: () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      return `${API_BASE}/api/qr/download${token ? `?token=${token}` : ''}`;
    },
  },
  surveys: {
    send: (phone: string, customerName?: string) =>
      request<SurveySendResult>('/api/surveys/send', {
        method: 'POST',
        body: JSON.stringify({ phone, customerName, channel: 'manual' }),
      }),
    simulateRating: (surveyId: string, rating: number, feedback?: string) =>
      request<Survey>(`/api/surveys/${surveyId}/simulate-rating`, {
        method: 'POST',
        body: JSON.stringify({ rating, feedback }),
      }),
    list: (params?: { status?: string; limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      const qs = searchParams.toString();
      return request<{ surveys: Survey[]; total: number }>(`/api/surveys${qs ? `?${qs}` : ''}`);
    },
    stats: () => request<SurveyStats>('/api/surveys/stats'),
    simulateScan: (phone: string) =>
      request<SurveySendResult>('/api/surveys/simulate-scan', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
  },
};

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  restaurantId?: string;
  restaurant?: { id: string; name: string; location: string };
}

export interface Review {
  id: string;
  restaurantId: string;
  source: 'google' | 'facebook' | 'whatsapp';
  author: string;
  rating: number;
  text: string | null;
  language: string;
  sentiment: string | null;
  postedAt: string;
  replied: boolean;
  replyText: string | null;
  repliedAt: string | null;
}

export interface ReviewStats {
  total: number;
  avgRating: number;
  distribution: { rating: number; count: number }[];
  bySource: { source: string; count: number; avgRating: number }[];
  negativesIntercepted: number;
}

export interface Alert {
  id: string;
  restaurantId: string;
  surveyId: string | null;
  rating: number;
  reason: string | null;
  tableOrSource: string | null;
  customerPhone: string | null;
  status: 'open' | 'resolved';
  resolveNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PlanFeatures {
  plan: string;
  features: string[];
  limits: { surveysPerMonth: number; locations: number };
}

export interface PlanTier {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  popular?: boolean;
}

export interface BillingInfo {
  currentPlan: PlanTier;
  usage: { surveysThisMonth: number; locations: number };
  billingCycle: string;
  nextBillingDate: string;
  paymentMethod: string | null;
}

export interface ConsentStats {
  totalCustomers: number;
  consentedCustomers: number;
  consentRate: number;
}

export interface LocationInfo {
  id: string;
  name: string;
  location: string;
  plan: string;
}

export interface SwitchLocationResult {
  userId: string;
  restaurantId: string;
  restaurant: LocationInfo;
}

export interface RestaurantSettings {
  gatingEnabled: boolean;
  recoveryOffer: string | null;
  googlePlaceId: string | null;
  whatsappNumber: string | null;
  voiceSetting: string;
}

export interface QrData {
  dataUrl: string;
  whatsappUrl: string;
  restaurantName: string;
}

export interface Survey {
  id: string;
  restaurantId: string;
  customerId: string;
  channel: string;
  rating: number | null;
  feedback: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; phone: string; name: string | null };
}

export interface SurveySendResult {
  surveyId: string;
  messageId: string;
  simulated: boolean;
  phone: string;
  status: string;
}

export interface SurveyStats {
  total: number;
  sentToday: number;
  sentThisWeek: number;
  sentThisMonth: number;
  responded: number;
  responseRate: number;
  avgRating: number;
}
