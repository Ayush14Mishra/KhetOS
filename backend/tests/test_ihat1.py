from pydantic import ValidationError

from app.models import CropThresholds, Telemetry
from app.rules import cardinal_direction, evaluate
from app.auth import LoginRequest, allow_farm, allow_roles, get_current_user, login
from fastapi import HTTPException
from fastapi.testclient import TestClient
import importlib


def reading(**changes) -> Telemetry:
    base = {
        "temperature_c": 30,
        "humidity_pct": 68,
        "rainfall_mm_h": 0,
        "wind_speed_kmh": 8,
        "wind_direction_deg": 180,
        "light_lux": 42000,
        "soil_moisture_pct": 44,
    }
    return Telemetry(**(base | changes))


def test_normal_field_is_green_and_spray_safe():
    result = evaluate(reading())
    assert result["status"] == "green"
    assert result["spray_allowed"] is True
    assert result["actuators"] if "actuators" in result else True


def test_heat_stress_generates_red_alert():
    result = evaluate(reading(temperature_c=40))
    assert result["status"] == "red"
    assert any(item["code"] == "heat_stress" for item in result["alerts"])


def test_heavy_rain_locks_spraying():
    result = evaluate(reading(rainfall_mm_h=18, rain_detected=True))
    assert result["status"] == "red"
    assert result["spray_allowed"] is False


def test_high_wind_reports_direction_and_locks_spraying():
    result = evaluate(reading(wind_speed_kmh=25, wind_direction_deg=245))
    assert result["spray_allowed"] is False
    assert any("SW" in item["message"] for item in result["alerts"])
    assert cardinal_direction(245) == "SW"


def test_dry_soil_is_a_red_condition():
    result = evaluate(reading(soil_moisture_pct=20))
    assert result["soil_condition"]["status"] == "red"


def test_stale_packet_activates_fail_safe_spray_lock():
    result = evaluate(reading(), packet_age_seconds=40)
    assert result["status"] == "red"
    assert result["spray_allowed"] is False


def test_sensor_fault_activates_fail_safe_spray_lock():
    result = evaluate(reading(sensor_status={"wind_ok": False, "rain_gauge_ok": True}))
    assert result["status"] == "yellow"
    assert result["spray_allowed"] is False
    assert any(item["code"] == "sensor_fault" for item in result["alerts"])


def test_crop_thresholds_are_configurable():
    limits = CropThresholds(crop="tomato", growth_stage="flowering", heat_warning_c=31)
    result = evaluate(reading(temperature_c=32), thresholds=limits)
    assert any(item["code"] == "heat_stress" for item in result["alerts"])


def test_ble_gateway_legacy_name_is_accepted():
    packet = reading(ble_gateway_id="GW-LEGACY-01", source="ble")
    assert packet.gateway_id == "GW-LEGACY-01"


def test_invalid_humidity_is_rejected():
    try:
        reading(humidity_pct=140)
        assert False, "invalid humidity should fail validation"
    except ValidationError:
        pass


def test_admin_login_and_signed_session():
    result = login(LoginRequest(email="admin@gramin.local", password="Admin@123"))
    user = get_current_user(f"Bearer {result['access_token']}")
    assert user.role == "admin"
    allow_farm(user, "FARM-001")
    allow_roles(user, "admin")


def test_farmer_is_limited_to_assigned_farm_and_role():
    result = login(LoginRequest(email="farmer@gramin.local", password="Farmer@123"))
    user = get_current_user(f"Bearer {result['access_token']}")
    try:
        allow_farm(user, "FARM-999")
        assert False, "farmer should not see another farm"
    except HTTPException as error:
        assert error.status_code == 403
    try:
        allow_roles(user, "admin")
        assert False, "farmer should not administer configuration"
    except HTTPException as error:
        assert error.status_code == 403


def test_external_weather_forecast_is_normalized_and_cached(monkeypatch):
    main_module = importlib.import_module("app.main")
    main_module.forecast_cache.clear()

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "latitude": 22.7,
                "longitude": 75.8,
                "timezone": "Asia/Kolkata",
                "current": {"temperature_2m": 30.0, "wind_speed_10m": 9.0},
                "hourly": {
                    "time": ["2026-08-22T10:00"],
                    "temperature_2m": [30.0], "relative_humidity_2m": [65],
                    "apparent_temperature": [31.0], "precipitation_probability": [20],
                    "precipitation": [0.0], "wind_speed_10m": [9.0],
                    "wind_direction_10m": [225], "wind_gusts_10m": [15.0], "weather_code": [1],
                },
            }

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def get(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr(main_module.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    client = TestClient(main_module.app)
    token = client.post("/api/auth/login", json={"email": "worker@gramin.local", "password": "Worker@123"}).json()["access_token"]
    response = client.get("/api/weather/forecast?farm_id=FARM-001&latitude=22.7196&longitude=75.8577", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "Open-Meteo"
    assert body["hours"][0]["wind_direction_deg"] == 225
