from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from influxdb_client import Point
from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync
from motor.motor_asyncio import AsyncIOMotorClient

from .config import settings
from .models import CropThresholds, DeviceHeartbeat, Telemetry


class Storage:
    """Online databases plus an always-on local NDJSON data logger."""

    def __init__(self) -> None:
        self.mongo_client: AsyncIOMotorClient | None = None
        self.mongo = None
        self.influx: InfluxDBClientAsync | None = None
        self.mongo_online = False
        self.influx_online = False
        self.memory: dict[str, Any] = {
            "latest": {},
            "history": {},
            "events": [],
            "devices": {},
            "thresholds": {},
        }
        self.log_dir = settings.data_dir / "logs"
        self.telemetry_log = self.log_dir / "telemetry.ndjson"
        self.event_log = self.log_dir / "events.ndjson"
        self.threshold_file = settings.data_dir / "thresholds.local.json"
        self.threshold_seed_file = settings.data_dir / "crop_thresholds.json"

    async def connect(self) -> None:
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self._load_thresholds()
        self._restore_recent_telemetry()
        try:
            self.mongo_client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=1500)
            await self.mongo_client.admin.command("ping")
            self.mongo = self.mongo_client[settings.mongo_database]
            self.mongo_online = True
        except Exception:
            self.mongo_online = False
        try:
            self.influx = InfluxDBClientAsync(url=settings.influx_url, token=settings.influx_token, org=settings.influx_org)
            self.influx_online = bool(await self.influx.ping())
        except Exception:
            self.influx_online = False

    async def close(self) -> None:
        if self.mongo_client:
            self.mongo_client.close()
        if self.influx:
            await self.influx.close()

    async def save_telemetry(self, reading: Telemetry) -> None:
        data = reading.model_dump()
        key = f"{reading.farm_id}:{reading.zone_id}"
        self.memory["latest"][key] = data
        history = self.memory["history"].setdefault(reading.farm_id, [])
        history.append(data)
        if len(history) > 500:
            del history[:-500]
        await asyncio.to_thread(self._append_json, self.telemetry_log, data)

        if self.mongo_online:
            await self.mongo.latest_telemetry.replace_one({"farm_id": reading.farm_id, "zone_id": reading.zone_id}, data, upsert=True)
        if self.influx_online and self.influx:
            point = Point("microclimate").tag("farm_id", reading.farm_id).tag("zone_id", reading.zone_id).tag("device_id", reading.device_id).tag("source", reading.source)
            fields = [
                "temperature_c", "humidity_pct", "rainfall_mm_h", "wind_speed_kmh",
                "wind_direction_deg", "light_lux", "soil_moisture_pct", "pressure_hpa",
                "battery_pct", "rain_tip_count",
            ]
            for field in fields:
                point = point.field(field, float(getattr(reading, field)))
            for field in ["soil_temperature_c", "soil_ph", "soil_ec_ds_m", "rssi_dbm"]:
                value = getattr(reading, field)
                if value is not None:
                    point = point.field(field, float(value))
            for channel, value in reading.soil_spectrum.items():
                try:
                    point = point.field(f"spectrum_{channel}", float(value))
                except (TypeError, ValueError):
                    pass
            point = point.time(reading.timestamp)
            try:
                async with self.influx.write_api() as writer:
                    await writer.write(bucket=settings.influx_bucket, record=point)
            except Exception:
                self.influx_online = False

    async def latest(self, farm_id: str, zone_id: str | None = None) -> dict | None:
        if zone_id:
            item = self.memory["latest"].get(f"{farm_id}:{zone_id}")
            if item:
                return item
        candidates = [item for item in self.memory["latest"].values() if item.get("farm_id") == farm_id]
        if candidates:
            return max(candidates, key=lambda item: item.get("timestamp", ""))
        if self.mongo_online:
            query = {"farm_id": farm_id, **({"zone_id": zone_id} if zone_id else {})}
            return await self.mongo.latest_telemetry.find_one(query, {"_id": 0}, sort=[("timestamp", -1)])
        return None

    async def recent_telemetry(self, farm_id: str, limit: int = 60) -> list[dict]:
        history = [item for item in self.memory["history"].get(farm_id, [])]
        return list(reversed(history[-limit:]))

    async def add_event(self, event: dict) -> None:
        self.memory["events"].append(event)
        self.memory["events"] = self.memory["events"][-500:]
        await asyncio.to_thread(self._append_json, self.event_log, event)
        if self.mongo_online:
            await self.mongo.events.insert_one(event.copy())

    async def list_events(self, farm_id: str, limit: int = 100) -> list[dict]:
        return [event for event in reversed(self.memory["events"]) if event.get("farm_id") == farm_id][:limit]

    async def save_heartbeat(self, heartbeat: DeviceHeartbeat) -> dict:
        data = heartbeat.model_dump()
        self.memory["devices"][heartbeat.device_id] = data
        return data

    def list_devices(self, farm_id: str) -> list[dict]:
        return [item for item in self.memory["devices"].values() if item.get("farm_id") == farm_id]

    def get_thresholds(self, crop: str = "default", growth_stage: str = "all") -> CropThresholds:
        exact = self.memory["thresholds"].get(f"{crop.lower()}:{growth_stage.lower()}")
        crop_default = self.memory["thresholds"].get(f"{crop.lower()}:all")
        return CropThresholds(**(exact or crop_default or {"crop": crop, "growth_stage": growth_stage}))

    async def save_thresholds(self, thresholds: CropThresholds) -> CropThresholds:
        key = f"{thresholds.crop.lower()}:{thresholds.growth_stage.lower()}"
        self.memory["thresholds"][key] = thresholds.model_dump()
        await asyncio.to_thread(self._write_thresholds)
        return thresholds

    def logger_status(self) -> dict:
        return {
            "enabled": True,
            "format": "NDJSON",
            "telemetry_file": str(self.telemetry_log),
            "telemetry_records": self._line_count(self.telemetry_log),
            "event_records": self._line_count(self.event_log),
            "survives_internet_loss": True,
        }

    @staticmethod
    def _append_json(path: Path, value: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")

    def _restore_recent_telemetry(self) -> None:
        if not self.telemetry_log.exists():
            return
        try:
            lines = self.telemetry_log.read_text(encoding="utf-8").splitlines()[-500:]
            for line in lines:
                item = json.loads(line)
                reading = Telemetry(**item)
                key = f"{reading.farm_id}:{reading.zone_id}"
                self.memory["latest"][key] = reading.model_dump()
                self.memory["history"].setdefault(reading.farm_id, []).append(reading.model_dump())
        except (OSError, ValueError):
            pass

    def _load_thresholds(self) -> None:
        source = self.threshold_file if self.threshold_file.exists() else self.threshold_seed_file
        if not source.exists():
            return
        try:
            self.memory["thresholds"] = json.loads(source.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.memory["thresholds"] = {}

    def _write_thresholds(self) -> None:
        self.threshold_file.write_text(json.dumps(self.memory["thresholds"], indent=2), encoding="utf-8")

    @staticmethod
    def _line_count(path: Path) -> int:
        try:
            with path.open("r", encoding="utf-8") as handle:
                return sum(1 for _ in handle)
        except OSError:
            return 0


storage = Storage()
