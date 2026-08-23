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
const FIREBASE_DATABASE_URL = "https://khetos-69d64-default-rtdb.firebaseio.com";
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

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Reads the latest packet written by the ESP32 through Firebase. */
export async function firebaseTelemetry(fallback: Telemetry): Promise<Telemetry | null> {
  try {
    const response = await fetch(
      `${FIREBASE_DATABASE_URL}/farms/FARM-001/telemetry.json`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Firebase ${response.status}`);
    const raw = (await response.json()) as Record<string, unknown> | null;
    if (!raw) return null;

    const temperature = asFiniteNumber(raw.temperature_c);
    const humidity = asFiniteNumber(raw.humidity_pct);
    const rainfall = asFiniteNumber(raw.rainfall_mm_h);
    const windSpeed = asFiniteNumber(raw.wind_speed_kmh);
    const windDirection = asFiniteNumber(raw.wind_direction_deg);
    const light = asFiniteNumber(raw.light_lux);
    const soil = asFiniteNumber(raw.soil_moisture_pct);
    if (temperature === null || humidity === null || windSpeed === null) return null;

    return {
      ...fallback,
      device_id: String(raw.device_id || "ESP32"),
      zone_id: String(raw.zone_id || fallback.zone_id || "ACR-Z01"),
      timestamp: typeof raw.timestamp === "string" ? raw.timestamp : new Date().toISOString(),
      temperature_c: Number(temperature.toFixed(1)),
      humidity_pct: Math.round(humidity),
      rainfall_mm_h: Math.max(0, rainfall ?? 0),
      rain_detected: Boolean(raw.rain_detected) || (rainfall ?? 0) > 0,
      wind_speed_kmh: Math.max(0, Number(windSpeed.toFixed(1))),
      wind_direction_deg: Math.round(windDirection ?? fallback.wind_direction_deg),
      light_lux: Math.max(0, light ?? 0),
      soil_moisture_pct: soil === null ? fallback.soil_moisture_pct : Math.max(0, Math.min(100, soil)),
      pressure_hpa: asFiniteNumber(raw.pressure_hpa) ?? fallback.pressure_hpa,
      battery_pct: asFiniteNumber(raw.battery_pct) ?? fallback.battery_pct,
      source: "live",
      data_provider: "Firebase · ESP32",
      rain_gauge_type: "esp32_sensor",
      wind_sensor_type: "esp32_sensor",
      soil_sensor_type: soil === null ? undefined : "esp32_sensor",
      sensor_status: {
        temperature_humidity_ok: true,
        rain_detection_ok: rainfall !== null,
        wind_ok: true,
        light_ok: light !== null,
        soil_ok: soil !== null,
      },
    };
  } catch {
    return null;
  }
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

type OpenMeteoCurrent = {
  time?: string;
  interval?: number;
  temperature_2m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  rain?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  shortwave_radiation?: number;
  shortwave_radiation_instant?: number;
  soil_moisture_0_to_1cm?: number;
  surface_pressure?: number;
};

type MetNoDetails = {
  air_temperature?: number;
  relative_humidity?: number;
  wind_speed?: number;
  wind_from_direction?: number;
  air_pressure_at_sea_level?: number;
  cloud_area_fraction?: number;
};

type MetNoPayload = {
  properties?: {
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: { details?: MetNoDetails };
        next_1_hours?: { details?: { precipitation_amount?: number } };
      };
    }>;
  };
};

function estimatedSolarRadiation(
  timestamp: string,
  latitude: number,
  longitude: number,
  cloudPct: number,
) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 0;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start) / 86_400_000);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const gamma = (2 * Math.PI / 365) * (day - 1 + (hour - 12) / 24);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const solarMinutes = hour * 60 + equationOfTime + 4 * longitude;
  const hourAngle = (solarMinutes / 4 - 180) * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  const cosZenith = Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle);
  if (cosZenith <= 0) return 0;
  const clearSky = 1000 * Math.pow(cosZenith, 1.2);
  const cloudFraction = Math.min(1, Math.max(0, cloudPct / 100));
  return Math.round(Math.max(0, clearSky * (1 - 0.75 * Math.pow(cloudFraction, 3.4))));
}

async function metNorwayTelemetry(
  latitude: number,
  longitude: number,
  fallback: Telemetry,
): Promise<Telemetry> {
  const url = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  // Four decimals is the precision recommended by MET Norway for cacheable
  // location forecasts and is more precise than the underlying model grid.
  url.searchParams.set("lat", latitude.toFixed(4));
  url.searchParams.set("lon", longitude.toFixed(4));
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`MET Norway ${response.status}`);
  const payload = (await response.json()) as MetNoPayload;
  const point = payload.properties?.timeseries?.[0];
  const details = point?.data?.instant?.details;
  if (!details || typeof details.air_temperature !== "number") {
    throw new Error("MET Norway current forecast unavailable");
  }

  const timestamp = point?.time || new Date().toISOString();
  const rainfall = Math.max(0, Number(point?.data?.next_1_hours?.details?.precipitation_amount ?? 0));
  const solarWm2 = estimatedSolarRadiation(timestamp, latitude, longitude, Number(details.cloud_area_fraction ?? 0));
  return {
    ...fallback,
    device_id: "MET-NORWAY",
    timestamp,
    temperature_c: Number(details.air_temperature.toFixed(1)),
    humidity_pct: Math.round(Number(details.relative_humidity ?? fallback.humidity_pct)),
    rainfall_mm_h: Number(rainfall.toFixed(1)),
    rain_detected: rainfall > 0,
    wind_speed_kmh: Number((Number(details.wind_speed ?? 0) * 3.6).toFixed(1)),
    wind_direction_deg: Math.round(Number(details.wind_from_direction ?? fallback.wind_direction_deg)),
    solar_radiation_wm2: solarWm2,
    light_lux: Math.round(solarWm2 * 120),
    pressure_hpa: Number(Number(details.air_pressure_at_sea_level ?? fallback.pressure_hpa).toFixed(1)),
    source: "weather",
    data_provider: "MET Norway",
    rain_gauge_type: "weather_model",
    wind_sensor_type: "weather_model",
    sensor_status: {
      temperature_humidity_ok: true,
      rain_detection_ok: true,
      wind_ok: true,
      light_ok: true,
      soil_ok: false,
    },
  };
}

/**
 * Hardware-independent live readings for the public demo. Open-Meteo provides
 * current model/observation-blended weather at the saved farm coordinates.
 * Solar radiation is converted to an approximate outdoor illuminance, while
 * soil moisture remains clearly identified in the UI as modelled data.
 */
export async function liveWeatherTelemetry(
  latitude: number,
  longitude: number,
  fallback: Telemetry,
): Promise<Telemetry> {
  const cacheKey = `${CACHE_PREFIX}weather:${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  try {
    const data = await metNorwayTelemetry(latitude, longitude, fallback);
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
    return data;
  } catch {
    // Open-Meteo remains an independent fallback when MET Norway is unavailable.
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "rain",
      "wind_speed_10m",
      "wind_direction_10m",
      "shortwave_radiation",
      "shortwave_radiation_instant",
      "soil_moisture_0_to_1cm",
      "surface_pressure",
    ].join(","),
    timezone: "auto",
    models: "best_match",
    forecast_minutely_15: "1",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const payload = (await response.json()) as { current?: OpenMeteoCurrent };
    const current = payload.current;
    if (!current || typeof current.temperature_2m !== "number") {
      throw new Error("Open-Meteo current conditions unavailable");
    }

    const intervalSeconds = Math.max(1, Number(current.interval || 3600));
    const precipitationRate = Number(current.precipitation ?? current.rain ?? 0) * 3600 / intervalSeconds;
    const radiationWm2 = Math.max(
      0,
      Number(current.shortwave_radiation_instant ?? current.shortwave_radiation ?? 0),
    );
    const soilVolumetric = Number(current.soil_moisture_0_to_1cm);
    const data: Telemetry = {
      ...fallback,
      device_id: "OPEN-METEO",
      zone_id: fallback.zone_id || "ACR-Z01",
      timestamp: current.time || new Date().toISOString(),
      temperature_c: Number(current.temperature_2m.toFixed(1)),
      humidity_pct: Math.round(Number(current.relative_humidity_2m ?? fallback.humidity_pct)),
      rainfall_mm_h: Number(Math.max(0, precipitationRate).toFixed(1)),
      rain_detected: precipitationRate > 0,
      wind_speed_kmh: Number(Number(current.wind_speed_10m ?? fallback.wind_speed_kmh).toFixed(1)),
      wind_direction_deg: Math.round(Number(current.wind_direction_10m ?? fallback.wind_direction_deg)),
      // Keep the API's native solar-radiation value for an honest forecast
      // reading. Lux is retained only for backwards compatibility with the
      // hardware card and is explicitly presented as an estimate in the UI.
      solar_radiation_wm2: Math.round(radiationWm2),
      light_lux: Math.round(radiationWm2 * 120),
      soil_moisture_pct: Number.isFinite(soilVolumetric)
        ? Math.round(Math.min(1, Math.max(0, soilVolumetric)) * 100)
        : fallback.soil_moisture_pct,
      pressure_hpa: Number(Number(current.surface_pressure ?? fallback.pressure_hpa).toFixed(1)),
      source: "weather",
      data_provider: "Open-Meteo",
      rain_gauge_type: "weather_model",
      wind_sensor_type: "weather_model",
      soil_sensor_type: "weather_model",
      sensor_status: {
        temperature_humidity_ok: true,
        rain_detection_ok: true,
        wind_ok: true,
        light_ok: true,
        soil_ok: true,
      },
    };
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), data }));
    return data;
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null") as { data?: Telemetry } | null;
      if (cached?.data) return { ...cached.data, source: "cached", data_provider: `${cached.data.data_provider || "Weather API"} cache` };
    } catch {
      localStorage.removeItem(cacheKey);
    }
    return fallback;
  }
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
