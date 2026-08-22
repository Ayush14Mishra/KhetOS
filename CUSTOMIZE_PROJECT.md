# How to customize the IHAT1 project

Make one small change at a time, run the relevant test, and commit only after it works.

## Login, roles and private farms

The local login API is in `backend/app/auth.py`.

- `DEFAULT_USERS` holds the three local hackathon accounts.
- `allow_farm()` blocks a user from viewing an unassigned farm.
- `allow_roles()` restricts admin-only actions, such as changing thresholds.
- `AUTH_SECRET` signs short-lived browser sessions. Change it before cloud deployment.
- `DEVICE_INGEST_KEY`, when configured, makes ESP32/gateway POST requests send an `X-Device-Key` header.

The automatic local account is intended only for the hackathon demonstration.

## 1. Add or remove a sensor field

Edit `backend/app/models.py`, inside `Telemetry`.

Example:

```python
leaf_wetness_pct: float | None = Field(default=None, ge=0, le=100)
```

Then add it to the InfluxDB field list in `backend/app/storage.py`. Add a card to `sensorCards` in `app/dashboard.tsx` only if farmers need to see it immediately. Update the ESP32 JSON packet with the identical key.

## 2. Change alert or spray rules

Edit `backend/app/rules.py`.

- `evaluate()` creates heat, rain, wind, humidity and soil alerts.
- `spray_checks` controls the physical relay permission.
- `_alert()` defines the common green/yellow/red response format.
- `soil_condition()` classifies soil moisture.

Do not put separate safety limits inside the frontend. The backend must remain the single source of truth.

## 3. Change crop-specific thresholds

Seed values are stored in `backend/data/crop_thresholds.json`. Admin users can
change them through the authenticated API.

The API method is:

```bash
curl -X PUT http://localhost:8000/api/config/thresholds \
  -H 'Content-Type: application/json' \
  -d '{
    "crop":"tomato",
    "growth_stage":"flowering",
    "heat_warning_c":33,
    "heat_danger_c":38,
    "humidity_warning_pct":85,
    "heavy_rain_warning_mm_h":7.5,
    "heavy_rain_danger_mm_h":15,
    "wind_warning_kmh":12,
    "wind_danger_kmh":20,
    "spray_max_wind_kmh":15,
    "spray_max_rain_mm_h":0.2,
    "spray_max_humidity_pct":88,
    "soil_moisture_min_pct":30,
    "soil_moisture_max_pct":75
  }'
```

Use verified crop guidance or an agronomist before presenting a threshold as field-ready.

## 4. Add a new early-warning type

Add the current-condition rule to `backend/app/rules.py`. The `/api/early-warning` route in `backend/app/main.py` already projects temperature, humidity, rainfall and wind from recent packets. Add another numeric field to its `fields` list only when a linear trend is meaningful.

## 5. Change dashboard cards or wording

Edit `app/dashboard.tsx`:

- `ihat-command-hero`: overall severity, spray lock and buzzer state
- `sensor-grid`: immediate field measurements
- `early-warning`: projected warnings
- `hardware-grid`: sensors, BLE node/gateway and logger health
- `judge-scenarios`: normal, heat, rain, wind and spray-unsafe demonstrations

Edit colors, spacing and mobile layout in `app/globals.css`.

## 6. Connect the BLE gateway

Edit `iot/esp32/full_hardware/ble_gateway.ino`:

1. Set Wi-Fi name and password.
2. On macOS, run `ipconfig getifaddr en0` to find the laptop IP.
3. Set `API_URL` to `http://LAPTOP_IP:8000/api/telemetry/ble`.
4. Ensure JSON keys match `Telemetry` in `backend/app/models.py`.
5. Keep the LittleFS queue enabled so packets survive Wi-Fi loss.

The backend accepts both `gateway_id` and the older `ble_gateway_id` key.

## 7. Change demo scenarios

Edit the `values` dictionary in `backend/app/main.py` under `demo_scenario()`.

Available dashboard buttons are defined in `app/dashboard.tsx`:

```tsx
["normal", "heat", "rain", "wind", "spray-unsafe"]
```

Set `DEMO_MODE=false` in `.env` for real deployment. The demo endpoint then returns HTTP 403.

## 8. Storage behavior

- InfluxDB: timestamped sensor readings for graphs and trends.
- MongoDB: latest readings and decision events when available.
- `backend/data/logs/telemetry.ndjson`: always-on local telemetry log.
- `backend/data/logs/events.ndjson`: explainable decision evidence.
- ESP32 LittleFS: queues packets if the gateway/backend is unreachable.
- ESP32 microSD: records every full-edge packet in `/telemetry.ndjson` when a card is connected.

Docker stores backend logs in the `local_logs` volume.

## 9. Parts safe to remove

The focused app no longer imports the old frontend modules under `app/lib/` or `app/components/`. It also no longer imports `backend/app/data_sources.py`, `backend/app/pest_ml.py`, or `backend/app/farmer_identity.py`.

After keeping a backup, these old prototype areas can be deleted if you want the smallest submission:

- `ml/`
- `iot/pest-guard/`
- `backend/data/crop_pest_*`
- `backend/data/schemes.json`
- `backend/data/market_sample.json`
- `backend/data/msp_2025_26.csv`
- old change-note Markdown files about pest, market or farmer identity

Keep `iot/esp32/full_hardware/`, `backend/app/`, `backend/tests/`, `app/`, `grafana/`, Docker files and the root package files.

## 10. Safe verification sequence

```bash
cd backend && PYTHONPATH=. pytest -q && cd ..
npm run verify:hardware
npm run build
docker compose up --build
```

Then test `/health`, `/api/field-status`, each demo scenario and the dashboard.
