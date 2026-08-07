import { secureGet, secureSet, secureDelete } from "@/utils/secureStorage";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const TOKEN_KEY = "bjj_instructor_token";

let _cachedToken: string | null = null;
let _baseUrl: string | null = null;

export function getApiBaseUrl(): string {
  if (_baseUrl) return _baseUrl;
  const domain =
    typeof process !== "undefined"
      ? (process.env.EXPO_PUBLIC_DOMAIN ?? "")
      : "";
  if (domain) {
    _baseUrl = `https://${domain}`;
    return _baseUrl;
  }
  if (__DEV__) {
    console.warn("[apiClient] EXPO_PUBLIC_DOMAIN is not set. API calls will fail.");
  }
  return "";
}

export async function loadToken(): Promise<string | null> {
  if (_cachedToken) return _cachedToken;
  const stored = await secureGet(TOKEN_KEY);
  _cachedToken = stored;
  return stored;
}

export async function saveToken(token: string): Promise<void> {
  _cachedToken = token;
  await secureSet(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  _cachedToken = null;
  await secureDelete(TOKEN_KEY);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true
): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (withAuth) {
    const token = await loadToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, (data as { code?: string }).code);
  }

  return data as T;
}

export interface ApiInstructorAuth {
  id: number;
  slug: string;
  name: string;
  token: string;
}

export interface ApiSession {
  id: number;
  instructorId: number;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  date: string;
  time: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  serviceName: string;
  servicePrice: number;
  packageCount?: number | null;
  packageTotal?: number | null;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  paymentIntentId?: string | null;
  cancellationToken?: string | null;
  waiverId?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiService {
  id: number;
  instructorId: number;
  name: string;
  price: number;
}

export interface ApiAvailability {
  id: number;
  instructorId: number;
  day: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
  sessionDurationMinutes: number;
}

export interface ApiInstructorProfile {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  location: string | null;
  phone: string | null;
  website: string | null;
  photoUrl: string | null;
}

export interface ApiPublicProfile {
  instructor: ApiInstructorProfile;
  services: ApiService[];
  availability: ApiAvailability[];
  stripeEnabled?: boolean;
}

export interface ApiSlots {
  slots: string[];
}

export const api = {
  instructors: {
    register: (name: string, pin: string) =>
      apiRequest<ApiInstructorAuth>("/api/instructors/register", {
        method: "POST",
        body: JSON.stringify({ name, pin }),
      }, false),

    login: (slug: string, pin: string) =>
      apiRequest<ApiInstructorAuth>("/api/instructors/login", {
        method: "POST",
        body: JSON.stringify({ slug, pin }),
      }, false),

    verifySession: () =>
      apiRequest<{ valid: boolean; authSource?: string; instructor?: { id: number; slug: string; name: string } }>(
        "/api/instructors/verify-session"
      ),

    registerEmail: (name: string, email: string, password: string) =>
      apiRequest<ApiInstructorAuth & { email: string }>("/api/instructors/register-email", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      }, false),

    loginEmail: (email: string, password: string) =>
      apiRequest<ApiInstructorAuth & { email: string }>("/api/instructors/login-email", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }, false),
  },

  sessions: {
    list: () => apiRequest<ApiSession[]>("/api/sessions"),

    create: (data: {
      clientName: string;
      clientEmail?: string;
      clientPhone?: string;
      date: string;
      time: string;
      serviceName: string;
      servicePrice?: number;
      packageCount?: number;
      packageTotal?: number;
      notes?: string;
    }) => apiRequest<ApiSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

    update: (id: number, data: Record<string, unknown>) =>
      apiRequest<ApiSession>(`/api/sessions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      apiRequest<void>(`/api/sessions/${id}`, { method: "DELETE" }),

    getWaiver: (id: number) =>
      apiRequest<{
        id: number;
        clientName: string;
        clientEmail: string;
        signedAt: string;
        signatureData: string;
      }>(`/api/sessions/${id}/waiver`),
  },

  services: {
    list: () => apiRequest<ApiService[]>("/api/services"),

    create: (name: string, price: number) =>
      apiRequest<ApiService>("/api/services", {
        method: "POST",
        body: JSON.stringify({ name, price }),
      }),

    update: (id: number, data: { name?: string; price?: number }) =>
      apiRequest<ApiService>(`/api/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: number) =>
      apiRequest<void>(`/api/services/${id}`, { method: "DELETE" }),
  },

  availability: {
    get: () => apiRequest<ApiAvailability[]>("/api/availability"),

    set: (availability: Array<{
      day: string;
      enabled: boolean;
      startTime: string;
      endTime: string;
      sessionDurationMinutes: number;
    }>) =>
      apiRequest<ApiAvailability[]>("/api/availability", {
        method: "PUT",
        body: JSON.stringify({ availability }),
      }),
  },

  security: {
    getEvents: () =>
      apiRequest<{
        alertThreshold: number;
        windowMs: number;
        events: Array<{
          ip: string;
          count: number;
          windowStart: number;
          alerted: boolean;
          alertedAt: number | null;
        }>;
        history: Array<{
          ip: string;
          count: number;
          windowStart: number;
          windowEnd: number;
          alerted: boolean;
          alertedAt: number | null;
        }>;
      }>("/api/security/events"),

    getCrossAccountEvents: () =>
      apiRequest<{
        alertThreshold: number;
        windowMs: number;
        events: Array<{
          slug: string;
          ip: string;
          count: number;
          windowStart: number;
          alerted: boolean;
          alertedAt: number | null;
        }>;
        summary: {
          affectedAccounts: number;
          distinctIpCount: number;
          totalFailures: number;
          isCoordinatedAttack: boolean;
        };
      }>("/api/security/cross-account-events"),

    getCrossAccountHistory: () =>
      apiRequest<{
        history: Array<{
          id: number;
          ip: string;
          firstSeen: number;
          lastSeen: number;
          totalFailures: number;
          affectedSlugs: number;
          archivedAt: number;
        }>;
      }>("/api/security/cross-account-history"),
  },

  instructor: {
    getProfile: () =>
      apiRequest<{ profile: ApiInstructorProfile }>("/api/instructor/profile"),

    updateProfile: (data: {
      name?: string;
      bio?: string;
      location?: string;
      phone?: string;
      website?: string;
      photoUrl?: string;
    }) =>
      apiRequest<{ profile: ApiInstructorProfile }>("/api/instructor/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),

    changePin: (data: { currentPin: string; newPin: string }) =>
      apiRequest<{ message: string }>("/api/instructors/change-pin", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  connect: {
    getStatus: () =>
      apiRequest<{
        connected: boolean;
        accountId?: string;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted?: boolean;
      }>("/api/instructor/connect/status"),

    startOnboarding: () =>
      apiRequest<{ url: string }>("/api/instructor/connect/onboard", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },

  public: {
    getStripeKey: () =>
      apiRequest<{ publishableKey: string }>("/api/public/stripe-key", {}, false),

    getProfile: (slug: string) =>
      apiRequest<ApiPublicProfile>(`/api/public/${slug}`, {}, false),

    getSlots: (slug: string, date: string) =>
      apiRequest<ApiSlots>(`/api/public/${slug}/slots?date=${date}`, {}, false),

    createIntent: (slug: string, data: {
      serviceId: number;
      packageCount: number;
      clientName: string;
    }) =>
      apiRequest<{ clientSecret: string; id: string }>(`/api/public/${slug}/create-intent`, {
        method: "POST",
        body: JSON.stringify(data),
      }, false),

    createSession: (slug: string, data: {
      clientName: string;
      clientEmail?: string;
      clientPhone?: string;
      date: string;
      time: string;
      serviceId?: number;
      packageCount?: number;
      paymentIntentId?: string;
      subscriptionId?: string;
      notes?: string;
    }) =>
      apiRequest<ApiSession>(`/api/public/${slug}/session`, {
        method: "POST",
        body: JSON.stringify(data),
      }, false),
  },
};
