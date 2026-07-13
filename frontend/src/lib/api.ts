const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

function setToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem('token', token);
}

function clearSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Single in-flight refresh shared across concurrent 401s, so we hit /refresh once.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends the httpOnly refresh cookie
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { access_token?: string; user?: unknown };
        if (data.access_token) {
          setToken(data.access_token);
          if (data.user && typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          return data.access_token;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options?: RequestInit, _retried = false): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });

  // Access token expired — try one transparent refresh, then retry the request.
  if (res.status === 401 && !_retried && !path.startsWith('/api/auth/')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, true);
    }
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || error.message || `HTTP ${res.status}`);
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
    refresh: () =>
      request<{ access_token: string; user: User }>('/api/auth/refresh', {
        method: 'POST',
      }),
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
    // The SVG endpoint requires auth, so fetch it as a blob (Bearer header) and
    // trigger a client-side download rather than a plain <a href> (which can't
    // carry the token). The PNG download in the UI uses QrData.dataUrl directly.
    downloadUrl: () => `${API_BASE}/api/qr/download`,
    downloadSvg: async () => {
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/qr/download`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to download QR code');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sitara-feedback-qr.svg';
      link.click();
      URL.revokeObjectURL(url);
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
