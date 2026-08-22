export type DataMode = "live" | "cached" | "demo" | "ble" | "weather";

export type Telemetry = {
  farm_id: string;
  device_id: string;
  zone_id: string;
  timestamp: string;
  temperature_c: number;
  humidity_pct: number;
  rainfall_mm_h: number;
  rain_detected?: boolean;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  light_lux: number;
  soil_moisture_pct: number;
  pressure_hpa: number;
  battery_pct: number;
  source: DataMode;
  data_provider?: string;
  rain_gauge_type?: string;
  rain_tip_count?: number;
  wind_sensor_type?: string;
  soil_sensor_type?: string;
  soil_spectrum?: Record<string, number>;
  ble_gateway_id?: string;
  gateway_id?: string;
  sensor_status?: Record<string, boolean>;
  rssi_dbm?: number | null;
};

export type Zone = {
  id: string;
  name: string;
  soil_type: string;
  crop: string;
  area_acres: number;
  moisture: number;
  health: "good" | "watch" | "risk";
  polygon: Array<[number, number]>;
};

export type FarmerProfile = {
  id: string;
  name: string;
  mobile: string;
  state: string;
  district: string;
  village: string;
  land_acres: number;
  ownership: "owner" | "tenant" | "shared";
  category: "general" | "sc" | "st" | "obc";
  gender: "female" | "male" | "other";
  annual_income: number;
  crop: string;
  crop_variety?: string;
  growth_stage: string;
  sowing_date?: string;
  expected_harvest_date?: string;
  previous_crop?: string;
  irrigation: string;
  water_source?: string;
  soil_type?: string;
  drainage?: string;
  field_slope?: string;
  last_irrigation_date?: string;
  last_spray_date?: string;
  last_fertilizer_date?: string;
  pest_history?: string;
  disease_history?: string;
  nearby_sensitive_area?: string;
  whatsapp_alert_consent?: boolean;
  alert_language?: string;
  has_aadhaar: boolean;
  has_farmer_id: boolean;
  agristack_farmer_id?: string;
  latitude: number;
  longitude: number;
};

export type SchemeMatch = {
  id: string;
  title: string;
  authority: string;
  benefit: string;
  score: number;
  reasons: string[];
  documents: string[];
  official_url: string;
  verified_on: string;
};

export type Decision = {
  severity: "safe" | "watch" | "danger";
  spray_allowed: boolean;
  title: string;
  reason: string;
  confidence: number;
  checks: Array<{ label: string; value: string; pass: boolean }>;
  alerts?: Array<{ code: string; severity: "green" | "yellow" | "red"; title: string; message: string; action: string }>;
  thresholds?: Record<string, number | string>;
  soil_condition?: { status: "green" | "yellow" | "red"; label: string; moisture_pct: number; advice: string };
  actuators?: {
    buzzer: { active: boolean; pattern: string };
    spray_relay: { locked: boolean; fail_safe: boolean; reason: string };
  };
};

export type SystemStatus = {
  farm_id: string;
  generated_at: string;
  packet_age_seconds: number;
  connection: "live" | "offline/cached";
  data_source: DataMode;
  components: Array<{
    id: string;
    label: string;
    status: "connected" | "demo" | "offline" | "not_connected" | "recording";
    detail: string;
  }>;
  logger: { enabled: boolean; format: string; telemetry_records: number; event_records: number; survives_internet_loss: boolean };
  actuator: { buzzer_active: boolean; buzzer_pattern: string; spray_relay_locked: boolean };
};

export type WeatherForecast = {
  farm_id: string;
  provider: string;
  forecast_type: string;
  latitude: number;
  longitude: number;
  timezone: string;
  cached: boolean;
  current: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  hours: Array<{
    time: string;
    temperature_c: number;
    humidity_pct: number;
    apparent_temperature_c: number;
    precipitation_probability_pct: number;
    precipitation_mm: number;
    wind_speed_kmh: number;
    wind_direction_deg: number;
    wind_gust_kmh: number;
    weather_code: number;
  }>;
};

export type MarketPrice = {
  commodity: string;
  market: string;
  district: string;
  state: string;
  min_price: number;
  modal_price: number;
  max_price: number;
  arrival_date: string;
  source: string;
};

export type AuctionCreate = {
  farm_id: string;
  farmer_id: string;
  commodity: string;
  quantity_kg: number;
  reserve_price_per_kg: number;
  village: string;
  closes_at: string;
};

export type Auction = AuctionCreate & {
  id: string;
  created_at: string;
  status?: "open" | "closed";
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "danger";
  created_at: string;
  status: string;
  channel: string;
};

export type JuryModel = {
  name: string;
  rain_24h_mm: number;
  max_temp_c: number;
  max_wind_kmh: number;
  source: string;
};

export type Jury = {
  verdict: "agree" | "uncertain" | "conflict";
  confidence: number;
  models: JuryModel[];
  recommendation: string;
  cached_at: string;
};

export type PestDetection = {
  crop: string;
  insect: string;
  zone_id: string;
  count_5min: number;
  vision_confidence: number;
  harmful: boolean;
  severity: "high" | "medium" | "observe" | "beneficial" | "review";
  risk_probability: number;
  reason: string;
  field_action: string;
  captured_at: string;
  source?: DataMode;
};

export type PestDetectionResponse = {
  detection: PestDetection & {
    id?: string;
    buzzer: { activate: boolean; pattern: string; duration_ms: number };
  };
  notification: {
    phone_masked: string;
    phone_status: string;
    channels: string[];
    status: string;
  };
  model: {
    model_version: string;
    training_rows: number;
    cited_crop_insect_pairs: number;
    crops: string[];
    insects: string[];
  };
};


export type EarlyWarning = {
  farm_id: string;
  zone_id: string;
  horizon_minutes: number;
  status: "safe" | "warning" | "danger";
  summary: string;
  risks: Array<{ type: string; severity: "warning" | "danger"; label: string; message: string }>;
  current: Record<string, number>;
  projected: Record<string, number>;
  trend_per_minute: Record<string, number>;
  evidence_packets: number;
  source: string;
};


export type FarmerAction = {
  id: string;
  farm_id: string;
  farmer_id?: string;
  zone_id: string;
  action_type: "irrigation" | "spray" | "inspection" | "fertilizer" | "maintenance" | "harvest" | "other";
  metric: string;
  before_value: number;
  unit: string;
  target_value?: number | null;
  note?: string;
  started_at: string;
  completed_at?: string;
  after_value?: number;
  status: "started" | "completed";
  created_at?: string;
};

export type PestLiveStatus = {
  connected: boolean;
  last_seen_seconds: number | null;
  detection: (PestDetection & {
    id?: string;
    farmer_id?: string;
    farm_id?: string;
    device_id?: string;
    image_ref?: string;
    buzzer?: { activate: boolean; pattern: string; duration_ms: number };
  }) | null;
  notification: {
    id?: string;
    phone_masked?: string;
    phone_status?: string;
    status?: string;
    provider?: string;
    channels?: string[];
    created_at?: string;
  } | null;
};
