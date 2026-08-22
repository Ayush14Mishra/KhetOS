from __future__ import annotations

import asyncio
import math
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
import httpx
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .auth import CurrentUser, LoginRequest, allow_farm, allow_roles, get_current_user, login
from .models import CropThresholds, DeviceHeartbeat, SyncBatch, Telemetry, ThresholdUpdate
from .rules import evaluate, evidence_event
from .storage import storage


demo_override_until = 0.0
forecast_cache: dict[str, tuple[float, dict]] = {}


def seconds_since(timestamp: str) -> float:
    try:
        parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        return max(0, (datetime.now(timezone.utc) - parsed).total_seconds())
    except (TypeError, ValueError):
        return 9999


async def process_reading(reading: Telemetry, crop: str, growth_stage: str) -> dict:
    limits = storage.get_thresholds(crop, growth_stage)
    decision = evaluate(reading, 0, limits)
    await storage.save_telemetry(reading)
    await storage.add_event(evidence_event(reading, decision))
    return {
        "accepted": True,
        "field_status": decision,
        "actuators": actuator_commands(decision),
        "logger": {"saved_locally": True, "format": "NDJSON"},
    }


def actuator_commands(decision: dict) -> dict:
    status = decision["status"]
    alert_codes = {alert["code"] for alert in decision["alerts"]}
    climate_danger = bool(alert_codes & {"heat_stress", "heavy_rain", "high_wind"})
    return {
        "spray_relay": {
            "locked": not decision["spray_allowed"],
            "fail_safe": True,
            "reason": decision["spray_check"]["reason"],
        },
        "buzzer": {
            "active": climate_danger,
            "pattern": "one_long_two_short" if climate_danger else "none",
        },
    }


async def demo_loop() -> None:
    tick = 0
    while True:
        await asyncio.sleep(2)
        if asyncio.get_running_loop().time() < demo_override_until:
            continue
        tick += 1
        latest = await storage.latest("FARM-001")
        if latest and latest.get("source") in {"live", "ble"} and seconds_since(latest.get("timestamp", "")) < settings.live_packet_ttl_seconds:
            continue
        if settings.demo_mode:
            reading = Telemetry(
                farm_id="FARM-001",
                zone_id="ZONE-01",
                device_id="BLE-NODE-01",
                gateway_id="BLE-GATEWAY-01",
                source="demo",
                temperature_c=round(32.4 + math.sin(tick / 8) * 2.0, 1),
                humidity_pct=round(73 + math.sin(tick / 6) * 6, 1),
                rainfall_mm_h=0,
                wind_speed_kmh=round(10.8 + math.sin(tick / 5) * 3.8, 1),
                wind_direction_deg=(215 + tick * 3) % 360,
                light_lux=round(43800 + math.sin(tick / 9) * 3200),
                soil_moisture_pct=round(42 + math.sin(tick / 12) * 3, 1),
                soil_temperature_c=27.8,
                soil_ph=6.7,
                soil_ec_ds_m=1.2,
                pressure_hpa=1007.6,
                battery_pct=86,
                rssi_dbm=-62,
            )
            await process_reading(reading, "tomato", "flowering")


@asynccontextmanager
async def lifespan(_: FastAPI):
    await storage.connect()
    task = asyncio.create_task(demo_loop())
    yield
    task.cancel()
    await storage.close()


app = FastAPI(
    title="KhetOS IHAT1 API",
    description="Offline-first crop microclimate monitoring and explainable early-warning backend.",
    version="2.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def validate_device_key(x_device_key: str = Header(default="")) -> None:
    if settings.device_ingest_key and x_device_key != settings.device_ingest_key:
        raise HTTPException(401, "Invalid device key")


@app.post("/api/auth/login")
async def auth_login(item: LoginRequest):
    return login(item)


@app.get("/api/auth/me")
async def auth_me(user: CurrentUser = Depends(get_current_user)):
    return user


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "mongo": storage.mongo_online,
        "influx": storage.influx_online,
        "local_logger": True,
        "demo_mode": settings.demo_mode,
    }


@app.get("/api/hardware/capabilities")
async def hardware_capabilities():
    return {
        "system": "IHAT1 cyber-physical microclimate station",
        "offline_first": True,
        "components": [
            {"id": "environmental_sensor", "measures": ["temperature", "humidity", "pressure"], "interface": "I2C"},
            {"id": "ultrasonic_anemometer", "measures": ["wind_speed", "wind_direction"], "interface": "RS485/Modbus RTU"},
            {"id": "tipping_bucket_rain_gauge", "measures": ["rainfall_rate", "tip_count"], "interface": "GPIO interrupt"},
            {"id": "light_sensor", "measures": ["light_lux"], "interface": "I2C/ADC"},
            {"id": "soil_spectra", "measures": ["moisture", "temperature", "pH", "EC", "raw_spectrum"], "interface": "I2C/ADC"},
            {"id": "ble_node", "role": "field acquisition and local fail-safe"},
            {"id": "ble_gateway", "role": "BLE-to-local-HTTP bridge"},
            {"id": "data_logger", "role": "LittleFS on node plus NDJSON on gateway/backend"},
        ],
        "flow": ["sensors", "BLE node", "BLE gateway", "FastAPI", "local logger + InfluxDB", "dashboard + buzzer + spray relay"],
    }


@app.post("/api/telemetry")
async def ingest(reading: Telemetry, crop: str = "default", growth_stage: str = "all", _: None = Depends(validate_device_key)):
    reading.source = "live" if reading.source not in {"ble", "demo"} else reading.source
    return await process_reading(reading, crop, growth_stage)


@app.post("/api/telemetry/ble")
async def ingest_ble(reading: Telemetry, crop: str = "default", growth_stage: str = "all", _: None = Depends(validate_device_key)):
    reading.source = "ble"
    return await process_reading(reading, crop, growth_stage)


@app.get("/api/telemetry/latest", response_model=Telemetry)
async def latest(farm_id: str = "FARM-001", zone_id: Optional[str] = None, user: CurrentUser = Depends(get_current_user)):
    allow_farm(user, farm_id)
    item = await storage.latest(farm_id, zone_id)
    if not item:
        raise HTTPException(404, "No telemetry received yet")
    return item


@app.get("/api/telemetry/history")
async def history(farm_id: str = "FARM-001", limit: int = Query(60, ge=1, le=500), user: CurrentUser = Depends(get_current_user)):
    allow_farm(user, farm_id)
    return await storage.recent_telemetry(farm_id, limit)


@app.get("/api/field-status")
async def field_status(farm_id: str = "FARM-001", zone_id: Optional[str] = None, crop: str = "default", growth_stage: str = "all", user: CurrentUser = Depends(get_current_user)):
    allow_farm(user, farm_id)
    item = await storage.latest(farm_id, zone_id)
    if not item:
        raise HTTPException(404, "No telemetry received yet")
    reading = Telemetry(**item)
    age = seconds_since(reading.timestamp)
    decision = evaluate(reading, age, storage.get_thresholds(crop, growth_stage))
    return {
        "farm_id": farm_id,
        "zone_id": reading.zone_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "packet_age_seconds": round(age, 1),
        "connection": "live" if age <= settings.live_packet_ttl_seconds else "offline/cached",
        "telemetry": reading.model_dump(),
        **decision,
        "actuators": actuator_commands(decision),
    }


@app.get("/api/decisions/current")
async def current_decision(farm_id: str = "FARM-001", crop: str = "default", growth_stage: str = "all", user: CurrentUser = Depends(get_current_user)):
    status = await field_status(farm_id=farm_id, crop=crop, growth_stage=growth_stage, user=user)
    checks = [
        {"label": check["name"], "value": check["value"], "pass": check["passed"]}
        for check in status["spray_check"]["checks"]
    ]
    return {
        **{key: status[key] for key in ["status", "severity", "status_label", "spray_allowed", "spray_check", "soil_condition", "alerts", "thresholds", "actuators"]},
        "title": status["status_label"],
        "reason": status["alerts"][0]["message"],
        "confidence": 100 if status["packet_age_seconds"] <= 10 else 70,
        "checks": checks,
    }


@app.get("/api/system/status")
async def system_status(farm_id: str = "FARM-001", user: CurrentUser = Depends(get_current_user)):
    allow_farm(user, farm_id)
    item = await storage.latest(farm_id)
    if not item:
        raise HTTPException(404, "No telemetry received yet")
    reading = Telemetry(**item)
    age = seconds_since(reading.timestamp)
    decision = evaluate(reading, age, storage.get_thresholds("tomato", "flowering"))
    health = reading.sensor_status
    is_demo = reading.source == "demo"

    def sensor_component(component_id: str, label: str, health_key: str, detail: str) -> dict:
        if is_demo:
            state = "demo"
        elif health.get(health_key, True):
            state = "connected"
        else:
            state = "not_connected"
        return {"id": component_id, "label": label, "status": state, "detail": detail}

    logger = storage.logger_status()
    components = [
        sensor_component("environment", "Environmental sensor", "temperature_humidity_ok", "Temperature + humidity"),
        sensor_component("soil", "Soil sensor", "soil_moisture_ok", f"Moisture · {reading.soil_sensor_type}"),
        sensor_component("rain", "Rain sensor", "rain_detection_ok", "Detection only" if reading.rain_gauge_type == "raindrop_detector_not_quantitative" else "Quantitative mm/h"),
        sensor_component("wind", "Wind sensor", "wind_ok", reading.wind_sensor_type),
        sensor_component("light", "Light sensor", "light_ok", reading.light_sensor_type),
        {"id": "ble_node", "label": "BLE node", "status": "demo" if is_demo else ("connected" if age <= 30 else "offline"), "detail": f"{reading.device_id} · battery {reading.battery_pct:.0f}%"},
        {"id": "ble_gateway", "label": "BLE gateway", "status": "demo" if is_demo else ("connected" if age <= 30 else "offline"), "detail": reading.gateway_id},
        sensor_component("microsd", "ESP32 microSD logger", "microsd_ok", "On-device offline evidence log"),
        {"id": "logger", "label": "Gateway/backend logger", "status": "recording", "detail": f"{logger['telemetry_records']} packets · {logger['format']}"},
    ]
    return {
        "farm_id": farm_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "packet_age_seconds": round(age, 1),
        "connection": "live" if age <= settings.live_packet_ttl_seconds else "offline/cached",
        "data_source": reading.source,
        "components": components,
        "logger": {key: logger[key] for key in ["enabled", "format", "telemetry_records", "event_records", "survives_internet_loss"]},
        "actuator": {
            "buzzer_active": actuator_commands(decision)["buzzer"]["active"],
            "buzzer_pattern": actuator_commands(decision)["buzzer"]["pattern"],
            "spray_relay_locked": actuator_commands(decision)["spray_relay"]["locked"],
        },
    }


@app.get("/api/early-warning")
async def early_warning(farm_id: str = "FARM-001", crop: str = "default", growth_stage: str = "all", horizon_minutes: int = Query(60, ge=15, le=180), user: CurrentUser = Depends(get_current_user)):
    allow_farm(user, farm_id)
    rows = await storage.recent_telemetry(farm_id, 30)
    if not rows:
        raise HTTPException(404, "No telemetry received yet")
    current = Telemetry(**rows[0])
    fields = ["temperature_c", "humidity_pct", "rainfall_mm_h", "wind_speed_kmh"]
    slopes = {field: 0.0 for field in fields}
    if len(rows) >= 2:
        oldest = Telemetry(**rows[-1])
        elapsed_minutes = max(seconds_since(oldest.timestamp) - seconds_since(current.timestamp), 1) / 60
        for field in fields:
            slopes[field] = (getattr(current, field) - getattr(oldest, field)) / elapsed_minutes
    projected_values = {field: round(max(0, getattr(current, field) + slopes[field] * horizon_minutes), 2) for field in fields}
    projected = current.model_copy(update=projected_values, deep=True)
    projected_decision = evaluate(projected, 0, storage.get_thresholds(crop, growth_stage))
    risks = [alert for alert in projected_decision["alerts"] if alert["code"] != "normal"]
    return {
        "farm_id": farm_id,
        "zone_id": current.zone_id,
        "horizon_minutes": horizon_minutes,
        "status": projected_decision["status"],
        "summary": risks[0]["message"] if risks else f"No configured limit is projected to be crossed in {horizon_minutes} minutes.",
        "risks": risks,
        "current": {field: getattr(current, field) for field in fields},
        "projected": projected_values,
        "trend_per_minute": {key: round(value, 3) for key, value in slopes.items()},
        "evidence_packets": len(rows),
        "method": "linear trend over recent local packets; not a trained weather forecast",
    }


@app.get("/api/weather/forecast")
async def weather_forecast(
    farm_id: str = "FARM-001",
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    user: CurrentUser = Depends(get_current_user),
):
    """External 24-hour context; never replaces field-level safety decisions."""
    allow_farm(user, farm_id)
    cache_key = f"{latitude:.4f}:{longitude:.4f}"
    cached = forecast_cache.get(cache_key)
    if cached and time.monotonic() - cached[0] < 900:
        return {**cached[1], "cached": True}

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": "auto",
        "forecast_hours": 24,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,wind_direction_10m,weather_code",
        "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code",
    }
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(settings.weather_forecast_api_url, params=params)
            response.raise_for_status()
            raw = response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(503, f"Weather forecast is temporarily unavailable: {error}")

    hourly = raw.get("hourly", {})
    times = hourly.get("time", [])
    hours = [
        {
            "time": times[index],
            "temperature_c": hourly.get("temperature_2m", [None] * len(times))[index],
            "humidity_pct": hourly.get("relative_humidity_2m", [None] * len(times))[index],
            "apparent_temperature_c": hourly.get("apparent_temperature", [None] * len(times))[index],
            "precipitation_probability_pct": hourly.get("precipitation_probability", [None] * len(times))[index],
            "precipitation_mm": hourly.get("precipitation", [None] * len(times))[index],
            "wind_speed_kmh": hourly.get("wind_speed_10m", [None] * len(times))[index],
            "wind_direction_deg": hourly.get("wind_direction_10m", [None] * len(times))[index],
            "wind_gust_kmh": hourly.get("wind_gusts_10m", [None] * len(times))[index],
            "weather_code": hourly.get("weather_code", [None] * len(times))[index],
        }
        for index in range(min(24, len(times)))
    ]
    result = {
        "farm_id": farm_id,
        "provider": "Open-Meteo",
        "forecast_type": "external regional forecast; do not use as a replacement for field sensors",
        "latitude": raw.get("latitude", latitude),
        "longitude": raw.get("longitude", longitude),
        "timezone": raw.get("timezone", "auto"),
        "current": raw.get("current", {}),
        "hours": hours,
        "cached": False,
    }
    forecast_cache[cache_key] = (time.monotonic(), result)
    return result


@app.get("/api/config/thresholds", response_model=CropThresholds)
async def get_thresholds(crop: str = "default", growth_stage: str = "all", user: CurrentUser = Depends(get_current_user)):
    return storage.get_thresholds(crop, growth_stage)


@app.put("/api/config/thresholds", response_model=CropThresholds)
async def update_thresholds(item: ThresholdUpdate, user: CurrentUser = Depends(get_current_user)):
    allow_roles(user, "admin")
    return await storage.save_thresholds(item)


@app.post("/api/devices/heartbeat")
async def device_heartbeat(item: DeviceHeartbeat, _: None = Depends(validate_device_key)):
    return await storage.save_heartbeat(item)


@app.get("/api/devices")
async def devices(farm_id: str = "FARM-001", user: CurrentUser = Depends(get_current_user)):
    allow_farm(user, farm_id)
    devices = storage.list_devices(farm_id)
    latest_reading = await storage.latest(farm_id)
    if latest_reading:
        devices.append({
            "device_id": latest_reading["device_id"],
            "gateway_id": latest_reading.get("gateway_id", ""),
            "farm_id": farm_id,
            "zone_id": latest_reading["zone_id"],
            "battery_pct": latest_reading["battery_pct"],
            "rssi_dbm": latest_reading.get("rssi_dbm"),
            "timestamp": latest_reading["timestamp"],
            "online": seconds_since(latest_reading["timestamp"]) <= 30,
            "source": latest_reading["source"],
        })
    return devices


@app.get("/api/logger/status")
async def logger_status(user: CurrentUser = Depends(get_current_user)):
    allow_roles(user, "admin", "field_worker")
    return storage.logger_status()


@app.get("/api/events")
async def events(farm_id: str = "FARM-001", limit: int = Query(100, ge=1, le=500), user: CurrentUser = Depends(get_current_user)):
    allow_farm(user, farm_id)
    return await storage.list_events(farm_id, limit)


@app.post("/api/offline/sync")
async def sync(batch: SyncBatch, _: None = Depends(validate_device_key)):
    for reading in batch.events:
        reading.source = "cached"
        await process_reading(reading, "default", "all")
    return {"accepted": len(batch.events), "device_id": batch.device_id, "status": "synced"}


@app.post("/api/demo/{scenario}")
async def demo_scenario(scenario: str, user: CurrentUser = Depends(get_current_user)):
    global demo_override_until
    allow_roles(user, "admin", "field_worker")
    if not settings.demo_mode:
        raise HTTPException(403, "Demo scenarios are disabled")
    values = {
        "normal": {},
        "heat": {"temperature_c": 40.2, "soil_moisture_pct": 24},
        "rain": {"rainfall_mm_h": 18.5, "rain_detected": True},
        "wind": {"wind_speed_kmh": 27.4, "wind_direction_deg": 245},
        "spray-unsafe": {"wind_speed_kmh": 18.4, "humidity_pct": 91},
    }
    if scenario not in values:
        raise HTTPException(404, f"Unknown scenario. Use: {', '.join(values)}")
    demo_override_until = asyncio.get_running_loop().time() + 45
    base = {
        "farm_id": "FARM-001", "zone_id": "ZONE-01", "device_id": "DEMO-NODE", "gateway_id": "DEMO-GATEWAY", "source": "demo",
        "temperature_c": 31.5, "humidity_pct": 68, "rainfall_mm_h": 0, "wind_speed_kmh": 8, "wind_direction_deg": 180,
        "light_lux": 41000, "soil_moisture_pct": 44, "soil_temperature_c": 27, "soil_ph": 6.8, "soil_ec_ds_m": 1.1,
        "battery_pct": 92, "rssi_dbm": -58,
        "sensor_status": {"temperature_humidity_ok": True, "soil_moisture_ok": True, "rain_detection_ok": True, "wind_ok": True, "light_ok": True, "microsd_ok": True},
    }
    reading = Telemetry(**(base | values[scenario]))
    return await process_reading(reading, "tomato", "flowering")
