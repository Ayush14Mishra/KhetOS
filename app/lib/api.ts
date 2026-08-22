import type {
  Auction,
  AuctionCreate,
  Decision,
  EarlyWarning,
  FarmerAction,
  FarmerProfile,
  Jury,
  MarketPrice,
  NotificationItem,
  PestDetection,
  PestDetectionResponse,
  PestLiveStatus,
  SchemeMatch,
  SystemStatus,
  Telemetry,
  WeatherForecast,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CACHE_PREFIX = "gramin-connect:";
const LOCAL_TOKEN_KEY = "khetos:local-api-token";
let localLogin: Promise<string> | null = null;

async function localGatewayToken(): Promise<string> {
  const saved = sessionStorage.getItem(LOCAL_TOKEN_KEY);
  if (saved) return saved;
  if (!localLogin) {
    localLogin = fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.NEXT_PUBLIC_LOCAL_API_EMAIL || "worker@gramin.local",
        password: process.env.NEXT_PUBLIC_LOCAL_API_PASSWORD || "Worker@123",
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Local gateway sign-in failed");
        const result = await response.json() as { access_token: string };
        sessionStorage.setItem(LOCAL_TOKEN_KEY, result.access_token);
        return result.access_token;
      })
      .finally(() => { localLogin = null; });
  }
  return localLogin;
}

async function request<T>(
  path: string,
  fallback: T,
  init?: RequestInit,
): Promise<T> {
  // Cache only reads. A cached POST response can belong to a different farmer
  // and must never overwrite newly edited profile or consent data.
  const method = (init?.method || "GET").toUpperCase();
  const cacheKey = `${CACHE_PREFIX}${method}:${path}`;
  try {
    const token = await localGatewayToken();
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${response.status}`);
    const data = (await response.json()) as T;
    if (method === "GET") {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ savedAt: Date.now(), data }),
      );
    }
    return data;
  } catch {
    if (method !== "GET") return fallback;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return (JSON.parse(cached).data ?? fallback) as T;
    } catch {
      localStorage.removeItem(cacheKey);
    }
    return fallback;
  }
}

function safeArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export async function latestTelemetry(
  farmId: string,
  fallback: Telemetry,
): Promise<Telemetry> {
  const value = await request(
    `/api/telemetry/latest?farm_id=${encodeURIComponent(farmId)}`,
    fallback,
  );
  const source = value?.source;
  return {
    ...fallback,
    ...(value || {}),
    source:
      source === "live" || source === "ble" || source === "cached" || source === "demo"
        ? source
        : fallback.source,
  };
}

export async function earlyWarning(
  farmId: string,
  fallback: EarlyWarning,
  crop = "default",
  growthStage = "all",
): Promise<EarlyWarning> {
  const value = await request(
    `/api/early-warning?farm_id=${encodeURIComponent(farmId)}&horizon_minutes=${fallback.horizon_minutes}&crop=${encodeURIComponent(crop)}&growth_stage=${encodeURIComponent(growthStage)}`,
    fallback,
  );
  const rawStatus = String(value?.status || fallback.status);
  return {
    ...fallback,
    ...(value || {}),
    status: rawStatus === "red" ? "danger" : rawStatus === "yellow" ? "warning" : rawStatus === "green" ? "safe" : fallback.status,
    risks: safeArray(value?.risks, []).map((risk) => ({
      type: String((risk as Record<string, unknown>).type || (risk as Record<string, unknown>).code || "field_risk"),
      severity: String((risk as Record<string, unknown>).severity) === "red" ? "danger" : "warning",
      label: String((risk as Record<string, unknown>).label || (risk as Record<string, unknown>).title || "Field warning"),
      message: String((risk as Record<string, unknown>).message || (risk as Record<string, unknown>).action || "Inspect field conditions."),
    })),
  };
}

export async function decision(
  farmId: string,
  fallback: Decision,
  crop = "default",
  growthStage = "all",
): Promise<Decision> {
  const value = await request(
    `/api/decisions/current?farm_id=${encodeURIComponent(farmId)}&crop=${encodeURIComponent(crop)}&growth_stage=${encodeURIComponent(growthStage)}`,
    fallback,
  );
  return {
    ...fallback,
    ...(value || {}),
    checks: safeArray(value?.checks, fallback.checks).map((check, index) => ({
      ...(fallback.checks[index] || fallback.checks[0]),
      ...(check || {}),
    })),
  };
}

export async function systemStatus(farmId: string, fallback: SystemStatus): Promise<SystemStatus> {
  return request(`/api/system/status?farm_id=${encodeURIComponent(farmId)}`, fallback);
}

export async function weatherForecast(
  farmId: string,
  latitude: number,
  longitude: number,
  fallback: WeatherForecast,
): Promise<WeatherForecast> {
  return request(
    `/api/weather/forecast?farm_id=${encodeURIComponent(farmId)}&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`,
    fallback,
  );
}

export async function runDemoScenario(scenario: "normal" | "heat" | "rain" | "wind" | "spray-unsafe") {
  return request(`/api/demo/${scenario}`, { accepted: false }, { method: "POST" });
}

export async function jury(
  lat: number,
  lon: number,
  fallback: Jury,
): Promise<Jury> {
  const value = await request(
    `/api/weather/jury?latitude=${lat}&longitude=${lon}`,
    fallback,
  );
  return {
    ...fallback,
    ...(value || {}),
    models: safeArray(value?.models, fallback.models).map((model, index) => ({
      ...(fallback.models[index] || fallback.models[0]),
      ...(model || {}),
    })),
  };
}

export async function schemeMatches(
  profile: FarmerProfile,
  fallback: SchemeMatch[],
): Promise<SchemeMatch[]> {
  const values = await request("/api/schemes/match", fallback, {
    method: "POST",
    body: JSON.stringify(profile),
  });
  return safeArray(values, fallback).map((scheme, index) => {
    const seed = fallback[index] || fallback[0];
    return {
      ...seed,
      ...(scheme || {}),
      reasons: safeArray(scheme?.reasons, seed?.reasons || []),
      documents: safeArray(scheme?.documents, seed?.documents || []),
    };
  });
}

export async function marketPrices(
  commodity: string,
  state: string,
  fallback: MarketPrice[],
): Promise<MarketPrice[]> {
  const values = await request(
    `/api/market/prices?commodity=${encodeURIComponent(commodity)}&state=${encodeURIComponent(state)}`,
    fallback,
  );
  return safeArray(values, fallback).map((price, index) => ({
    ...(fallback[index] || fallback[0]),
    ...(price || {}),
  }));
}

export async function saveProfile(
  profile: FarmerProfile,
): Promise<FarmerProfile> {
  localStorage.setItem(`${CACHE_PREFIX}farmer`, JSON.stringify(profile));
  const profiles = getLocalProfiles();
  localStorage.setItem(
    `${CACHE_PREFIX}farmer-profiles`,
    JSON.stringify([
      profile,
      ...profiles.filter((item) => item.id !== profile.id),
    ]),
  );
  return request("/api/farmers", profile, {
    method: "POST",
    body: JSON.stringify(profile),
  });
}

export async function queueWhatsApp(payload: {
  farm_id: string;
  farmer_id: string;
  mobile: string;
  kind: "scheme" | "farm_report" | "pest_alert";
  message: string;
  consent: boolean;
}): Promise<{ status: string; provider: string }> {
  return request(
    "/api/whatsapp/outbox",
    { status: "saved_offline", provider: "whatsapp_click_to_chat" },
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function postTelemetry(payload: Telemetry): Promise<void> {
  await request(
    "/api/telemetry",
    { ok: false },
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function detectPest(
  payload: {
    farm_id: string;
    farmer_id: string;
    zone_id: string;
    device_id: string;
    crop: string;
    growth_stage: string;
    insect: string;
    count_5min: number;
    vision_confidence: number;
  },
  fallback: PestDetectionResponse,
): Promise<PestDetectionResponse> {
  const value = await request("/api/pests/detect", fallback, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    ...fallback,
    ...(value || {}),
    detection: {
      ...fallback.detection,
      ...(value?.detection || {}),
      buzzer: {
        ...fallback.detection.buzzer,
        ...(value?.detection?.buzzer || {}),
      },
    },
    notification: {
      ...fallback.notification,
      ...(value?.notification || {}),
      channels: safeArray(
        value?.notification?.channels,
        fallback.notification.channels,
      ),
    },
    model: {
      ...fallback.model,
      ...(value?.model || {}),
      crops: safeArray(value?.model?.crops, fallback.model.crops),
      insects: safeArray(value?.model?.insects, fallback.model.insects),
    },
  };
}



export async function pestLiveStatus(
  farmerId: string,
  fallback: PestLiveStatus,
): Promise<PestLiveStatus> {
  const value = await request(
    `/api/pests/live?farmer_id=${encodeURIComponent(farmerId)}&farm_id=FARM-001`,
    fallback,
  );
  return {
    ...fallback,
    ...(value || {}),
    detection: value?.detection ? { ...(fallback.detection || {}), ...value.detection } : null,
    notification: value?.notification
      ? { ...(fallback.notification || {}), ...value.notification }
      : null,
  };
}

export async function listFarmerActions(
  farmerId: string,
  fallback: FarmerAction[],
): Promise<FarmerAction[]> {
  const localKey = `${CACHE_PREFIX}actions:${farmerId}`;
  let local: FarmerAction[] = fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(localKey) || "[]");
    if (Array.isArray(saved) && saved.length) local = saved;
  } catch {
    localStorage.removeItem(localKey);
  }
  const values = await request(
    `/api/actions?farmer_id=${encodeURIComponent(farmerId)}&farm_id=FARM-001`,
    local,
  );
  const result = safeArray(values, local).map((item, index) => ({
    ...(local[index] || {}),
    ...(item || {}),
  })) as FarmerAction[];
  localStorage.setItem(localKey, JSON.stringify(result));
  return result;
}

export async function createFarmerAction(payload: {
  farm_id: string;
  farmer_id: string;
  zone_id: string;
  action_type: FarmerAction["action_type"];
  metric: string;
  before_value: number;
  unit: string;
  target_value?: number | null;
  note?: string;
}): Promise<FarmerAction> {
  const offline: FarmerAction = {
    ...payload,
    id: `ACTION-LOCAL-${Date.now()}`,
    started_at: new Date().toISOString(),
    status: "started",
  };
  const result = await request("/api/actions", offline, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const localKey = `${CACHE_PREFIX}actions:${payload.farmer_id}`;
  let saved: FarmerAction[] = [];
  try {
    const current = JSON.parse(localStorage.getItem(localKey) || "[]");
    saved = Array.isArray(current) ? current : [];
  } catch {
    saved = [];
  }
  localStorage.setItem(
    localKey,
    JSON.stringify([result, ...saved.filter((item) => item.id !== result.id)].slice(0, 50)),
  );
  return result;
}

export async function recentPests(
  fallback: PestDetection[],
): Promise<PestDetection[]> {
  const values = await request("/api/pests/recent", fallback);
  if (!Array.isArray(values) || !values.length) return fallback;
  const seed = fallback[0];
  return values.map((value) => ({ ...seed, ...(value || {}) }));
}

const AUCTION_CACHE = `${CACHE_PREFIX}auction-list`;

export async function listAuctions(fallback: Auction[]): Promise<Auction[]> {
  let local = fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(AUCTION_CACHE) || "[]");
    if (Array.isArray(saved) && saved.length) local = saved;
  } catch {
    localStorage.removeItem(AUCTION_CACHE);
  }
  const values = await request("/api/auctions", local);
  const result = safeArray(values, local).map((auction, index) => ({
    ...(local[index] || fallback[0]),
    ...(auction || {}),
  }));
  localStorage.setItem(AUCTION_CACHE, JSON.stringify(result));
  return result;
}

export async function createAuction(payload: AuctionCreate): Promise<Auction> {
  const offline: Auction = {
    ...payload,
    id: `AUCTION-LOCAL-${Date.now()}`,
    created_at: new Date().toISOString(),
    status: "open",
  };
  const value = await request("/api/auctions", offline, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const result = { ...offline, ...(value || {}) };
  let saved: Auction[] = [];
  try {
    const current = JSON.parse(localStorage.getItem(AUCTION_CACHE) || "[]");
    saved = Array.isArray(current) ? current : [];
  } catch {
    saved = [];
  }
  localStorage.setItem(
    AUCTION_CACHE,
    JSON.stringify([result, ...saved.filter((item) => item.id !== result.id)]),
  );
  return result;
}

export async function notificationOutbox(
  fallback: NotificationItem[],
): Promise<NotificationItem[]> {
  const raw = await request<unknown[]>("/api/notifications/outbox", []);
  if (!Array.isArray(raw) || !raw.length) return fallback;
  return raw.map((item, index) => {
    const value = item && typeof item === "object" ? item : {};
    const record = value as Record<string, unknown>;
    return {
      id: String(record.id || `NOTICE-${index}`),
      title: String(record.title || "Field alert"),
      message: String(record.sms_text || record.message || "New field event"),
      severity:
        record.severity === "danger" || record.severity === "warning"
          ? record.severity
          : "info",
      created_at: String(record.created_at || new Date().toISOString()),
      status: String(record.status || "pending"),
      channel: safeArray(record.channels, ["dashboard"]).join(" + "),
    };
  });
}

export function getLocalProfile(): FarmerProfile | null {
  try {
    return JSON.parse(
      localStorage.getItem(`${CACHE_PREFIX}farmer`) || "null",
    ) as FarmerProfile | null;
  } catch {
    return null;
  }
}

export function getLocalProfiles(): FarmerProfile[] {
  try {
    const saved = JSON.parse(
      localStorage.getItem(`${CACHE_PREFIX}farmer-profiles`) || "[]",
    );
    const profiles: FarmerProfile[] = Array.isArray(saved)
      ? (saved as FarmerProfile[])
      : [];
    const current = getLocalProfile();
    if (current && !profiles.some((item) => item?.id === current.id)) {
      return [current, ...profiles];
    }
    return profiles;
  } catch {
    const current = getLocalProfile();
    return current ? [current] : [];
  }
}

export function selectLocalProfile(profile: FarmerProfile) {
  localStorage.setItem(`${CACHE_PREFIX}farmer`, JSON.stringify(profile));
}

export function clearLocalSession() {
  localStorage.removeItem(`${CACHE_PREFIX}farmer`);
  sessionStorage.removeItem(LOCAL_TOKEN_KEY);
}

export function apiBase(): string {
  return API;
}
