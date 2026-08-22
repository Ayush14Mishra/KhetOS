from __future__ import annotations

from .models import CropThresholds, Telemetry


SEVERITY_RANK = {"green": 0, "yellow": 1, "red": 2}


def _alert(code: str, color: str, title: str, message: str, action: str) -> dict:
    return {"code": code, "severity": color, "title": title, "message": message, "action": action}


def soil_condition(reading: Telemetry, limits: CropThresholds) -> dict:
    moisture = reading.soil_moisture_pct
    if moisture < limits.soil_moisture_min_pct:
        status, label = "red", "Dry"
        advice = "Inspect the root zone and irrigate according to crop need."
    elif moisture > limits.soil_moisture_max_pct:
        status, label = "yellow", "Too wet"
        advice = "Pause irrigation and check drainage or waterlogging."
    else:
        status, label = "green", "Optimal"
        advice = "Soil moisture is inside the configured crop range."
    return {
        "status": status,
        "label": label,
        "moisture_pct": moisture,
        "temperature_c": reading.soil_temperature_c,
        "ph": reading.soil_ph,
        "ec_ds_m": reading.soil_ec_ds_m,
        "spectrum_channels": len(reading.soil_spectrum),
        "advice": advice,
        "note": "Spectral channels are logged as raw evidence; nutrient claims require field calibration.",
    }


def evaluate(reading: Telemetry, packet_age_seconds: float = 0, thresholds: CropThresholds | dict | None = None) -> dict:
    limits = thresholds if isinstance(thresholds, CropThresholds) else CropThresholds(**(thresholds or {}))
    alerts: list[dict] = []
    failed_sensors = [name for name, healthy in reading.sensor_status.items() if not healthy]

    if failed_sensors:
        critical = any(name in {"temperature_humidity_ok", "rain_detection_ok"} for name in failed_sensors)
        alerts.append(_alert("sensor_fault", "red" if critical else "yellow", "Sensor health fault", f"Unavailable inputs: {', '.join(failed_sensors)}.", "Inspect wiring and calibration before using field safety decisions."))

    if packet_age_seconds > 30:
        alerts.append(_alert("stale_data", "red", "Sensor data is stale", f"Last packet is {packet_age_seconds:.0f} seconds old.", "Check BLE node and gateway power."))
    elif packet_age_seconds > 10:
        alerts.append(_alert("delayed_data", "yellow", "Sensor packet delayed", f"Last packet is {packet_age_seconds:.0f} seconds old.", "Keep watching gateway connectivity."))

    if reading.temperature_c >= limits.heat_danger_c:
        alerts.append(_alert("heat_stress", "red", "Severe heat stress", f"Air temperature is {reading.temperature_c:.1f}°C.", "Inspect crop immediately; irrigate only if soil and crop stage require it."))
    elif reading.temperature_c >= limits.heat_warning_c:
        alerts.append(_alert("heat_stress", "yellow", "Heat stress warning", f"Air temperature is {reading.temperature_c:.1f}°C.", "Avoid midday field operations and watch crop stress."))

    if reading.rain_detected or reading.rainfall_mm_h >= limits.heavy_rain_danger_mm_h:
        alerts.append(_alert("heavy_rain", "red", "Heavy rain / rain detected", f"Rain intensity is {reading.rainfall_mm_h:.1f} mm/h.", "Stop spraying and inspect drainage."))
    elif reading.rainfall_mm_h >= limits.heavy_rain_warning_mm_h:
        alerts.append(_alert("heavy_rain", "yellow", "Heavy rain warning", f"Rain intensity is {reading.rainfall_mm_h:.1f} mm/h.", "Delay spraying and protect exposed inputs."))

    if reading.wind_speed_kmh >= limits.wind_danger_kmh:
        alerts.append(_alert("high_wind", "red", "High wind danger", f"Wind is {reading.wind_speed_kmh:.1f} km/h from {cardinal_direction(reading.wind_direction_deg)}.", "Stop spraying and secure field equipment."))
    elif reading.wind_speed_kmh >= limits.wind_warning_kmh:
        alerts.append(_alert("high_wind", "yellow", "High wind warning", f"Wind is {reading.wind_speed_kmh:.1f} km/h from {cardinal_direction(reading.wind_direction_deg)}.", "Watch spray drift and postpone if wind rises."))

    if reading.humidity_pct >= limits.humidity_warning_pct:
        alerts.append(_alert("high_humidity", "yellow", "High humidity", f"Relative humidity is {reading.humidity_pct:.0f}%.", "Check disease risk and spray drying time."))

    soil = soil_condition(reading, limits)
    if soil["status"] != "green":
        alerts.append(_alert("soil_condition", soil["status"], f"Soil is {soil['label'].lower()}", f"Soil moisture is {reading.soil_moisture_pct:.0f}%.", soil["advice"]))

    spray_checks = [
        {"name": "Sensor health", "passed": not failed_sensors, "value": "all inputs ready" if not failed_sensors else f"{len(failed_sensors)} unavailable"},
        {"name": "Fresh sensor data", "passed": packet_age_seconds <= 15, "value": f"{packet_age_seconds:.0f} sec old"},
        {"name": "Wind speed", "passed": reading.wind_speed_kmh <= limits.spray_max_wind_kmh, "value": f"{reading.wind_speed_kmh:.1f} km/h"},
        {"name": "Rain", "passed": not reading.rain_detected and reading.rainfall_mm_h <= limits.spray_max_rain_mm_h, "value": f"{reading.rainfall_mm_h:.1f} mm/h"},
        {"name": "Humidity", "passed": reading.humidity_pct <= limits.spray_max_humidity_pct, "value": f"{reading.humidity_pct:.0f}%"},
    ]
    spray_allowed = all(check["passed"] for check in spray_checks)
    failed = [check["name"] for check in spray_checks if not check["passed"]]

    overall = max((alert["severity"] for alert in alerts), key=lambda item: SEVERITY_RANK[item], default="green")
    if not alerts:
        alerts.append(_alert("normal", "green", "Field conditions normal", "All monitored values are inside configured limits.", "Continue routine observation."))

    return {
        "status": overall,
        "severity": {"green": "safe", "yellow": "watch", "red": "danger"}[overall],
        "status_label": {"green": "Good", "yellow": "Caution", "red": "Danger"}[overall],
        "spray_allowed": spray_allowed,
        "spray_check": {
            "allowed": spray_allowed,
            "label": "Safe to spray" if spray_allowed else "Do not spray",
            "reason": "All spray checks passed." if spray_allowed else f"Failed checks: {', '.join(failed)}.",
            "checks": spray_checks,
        },
        "soil_condition": soil,
        "alerts": alerts,
        "thresholds": limits.model_dump(),
    }


def cardinal_direction(degrees: float) -> str:
    labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return labels[round((degrees % 360) / 45) % 8]


def evidence_event(reading: Telemetry, decision: dict) -> dict:
    return {
        "timestamp": reading.timestamp,
        "farm_id": reading.farm_id,
        "zone_id": reading.zone_id,
        "device_id": reading.device_id,
        "event": decision["status_label"],
        "severity": decision["status"],
        "alerts": decision["alerts"],
        "spray_allowed": decision["spray_allowed"],
        "telemetry": reading.model_dump(),
        "source": reading.source,
    }
