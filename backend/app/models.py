from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import AliasChoices, BaseModel, Field, field_validator


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Telemetry(BaseModel):
    """One normalized packet produced by a field node or BLE gateway."""

    farm_id: str = "FARM-001"
    zone_id: str = "ZONE-01"
    device_id: str = "BLE-NODE-01"
    gateway_id: str = Field(default="BLE-GATEWAY-01", validation_alias=AliasChoices("gateway_id", "ble_gateway_id"))
    timestamp: str = Field(default_factory=now_iso)
    source: Literal["live", "ble", "cached", "demo"] = "live"

    temperature_c: float = Field(ge=-20, le=70)
    humidity_pct: float = Field(ge=0, le=100)
    rainfall_mm_h: float = Field(default=0, ge=0, le=500)
    rain_detected: bool = False
    rain_tip_count: int = Field(default=0, ge=0)
    rain_gauge_type: str = "tipping_bucket"

    wind_speed_kmh: float = Field(default=0, ge=0, le=300)
    wind_direction_deg: float = Field(default=0, ge=0, le=360)
    wind_sensor_type: str = "ultrasonic_rs485_modbus"
    light_lux: float = Field(default=0, ge=0, le=250000)
    light_sensor_type: str = "bh1750"

    soil_moisture_pct: float = Field(default=0, ge=0, le=100)
    soil_temperature_c: Optional[float] = Field(default=None, ge=-10, le=80)
    soil_ph: Optional[float] = Field(default=None, ge=0, le=14)
    soil_ec_ds_m: Optional[float] = Field(default=None, ge=0, le=30)
    soil_sensor_type: str = "moisture_plus_spectral"
    soil_spectrum: dict[str, float] = Field(default_factory=dict)

    pressure_hpa: float = Field(default=0, ge=0, le=1200)
    battery_pct: float = Field(default=100, ge=0, le=100)
    rssi_dbm: Optional[int] = Field(default=None, ge=-140, le=0)
    sensor_status: dict[str, bool] = Field(default_factory=dict)

    @field_validator("farm_id", "zone_id", "device_id")
    @classmethod
    def identifier_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("identifier cannot be blank")
        return value


class CropThresholds(BaseModel):
    """Editable crop and growth-stage limits used by the explainable rule engine."""

    crop: str = "default"
    growth_stage: str = "all"
    heat_warning_c: float = 33
    heat_danger_c: float = 38
    humidity_warning_pct: float = 85
    heavy_rain_warning_mm_h: float = 7.5
    heavy_rain_danger_mm_h: float = 15
    wind_warning_kmh: float = 12
    wind_danger_kmh: float = 20
    spray_max_wind_kmh: float = 15
    spray_max_rain_mm_h: float = 0.2
    spray_max_humidity_pct: float = 88
    soil_moisture_min_pct: float = 30
    soil_moisture_max_pct: float = 75


class ThresholdUpdate(CropThresholds):
    pass


class SyncBatch(BaseModel):
    device_id: str
    events: list[Telemetry]


class DeviceHeartbeat(BaseModel):
    device_id: str
    gateway_id: str = ""
    farm_id: str = "FARM-001"
    zone_id: str = "ZONE-01"
    battery_pct: float = Field(default=100, ge=0, le=100)
    rssi_dbm: Optional[int] = Field(default=None, ge=-140, le=0)
    firmware_version: str = "unknown"
    timestamp: str = Field(default_factory=now_iso)
