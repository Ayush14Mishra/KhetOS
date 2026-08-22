# ESP32 → Gramin Connect telemetry contract

Send one `POST` request per second to `http://<laptop-ip>:8000/api/telemetry`.

```json
{
  "farm_id": "FARM-001",
  "device_id": "ESP32-EDGE-01",
  "zone_id": "Z02",
  "temperature_c": 31.7,
  "humidity_pct": 68,
  "rainfall_mm_h": 0,
  "rain_detected": false,
  "wind_speed_kmh": 12.4,
  "wind_direction_deg": 238,
  "light_lux": 46200,
  "soil_moisture_pct": 37,
  "pressure_hpa": 1007.6,
  "battery_pct": 86
}
```

The backend sets `source=live`; never send a fake source label from firmware. A rain plate only supplies `rain_detected`. Use a tipping-bucket gauge before claiming `rainfall_mm_h`.

