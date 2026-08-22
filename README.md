# KhetOS — IHAT1

An offline-first cyber-physical system for **Intelligent Crop Microclimate Monitoring and Early Warning**.

## What this focused build includes

- Live air temperature and humidity
- Soil moisture, temperature, pH, EC and raw spectral channels
- Rain detection, tipping-bucket rainfall rate and tip count
- Ultrasonic wind speed and direction
- Light intensity and node battery/RSSI
- Overall field status: green, yellow or red
- Explainable heat, heavy-rain, wind, humidity and soil alerts
- Crop-spraying safety check with fail-safe relay command
- ESP32 microSD evidence log, LittleFS retry queue, backend NDJSON logger, InfluxDB time series and MongoDB event storage
- BLE field node → BLE gateway → local FastAPI flow
- Offline packet synchronization
- Editable crop and growth-stage thresholds
- Demo scenarios for normal, heat, rain, wind and unsafe spraying
- Open-Meteo 24-hour forecast for the saved farm coordinates, clearly separated from field-sensor decisions

The unrelated market, auction, scheme and pest surfaces from the earlier prototype are not part of the focused dashboard or API.

## Local gateway authorization

The dashboard opens directly for the local hackathon demonstration. It obtains
a field-worker session from the credentials in `.env`, while the FastAPI API
remains role-protected. Default API accounts are:

| Role | Email | Password | Permissions |
|---|---|---|---|
| Admin | `admin@gramin.local` | `Admin@123` | Every farm, settings and demo controls |
| Field worker | `worker@gramin.local` | `Worker@123` | Assigned farm and demo controls |
| Farmer | `farmer@gramin.local` | `Farmer@123` | Assigned farm dashboard only |

Change `AUTH_SECRET` before any cloud deployment. Automatic sign-in is intended
only for the local hackathon build.

## Honest hardware modes

The dashboard marks every value as `LIVE`, `BLE`, `DEMO`, `CACHED` or
`SENSOR NOT CONNECTED`. With the currently available DHT11, capacitive soil
probe and MH-RD board, KhetOS can measure temperature, humidity and soil
moisture and can detect rain. The MH-RD cannot measure rainfall in mm/h. Real
rainfall rate needs a tipping-bucket gauge; real wind and light readings need an
anemometer and light sensor.

## Run with Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Dashboard: <http://localhost:5173>
- FastAPI documentation: <http://localhost:8000/docs>
- Grafana: <http://localhost:3001> (`admin` / `gramin-connect`)

The Docker frontend uses Debian instead of Alpine so the ARM64 `workerd` binary runs on Apple Silicon Macs.

## Run without Docker

Terminal 1:

```bash
npm install
npm run dev
```

Terminal 2:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Send a real sensor packet

```bash
curl -X POST 'http://localhost:8000/api/telemetry/ble?crop=tomato&growth_stage=flowering' \
  -H 'Content-Type: application/json' \
  -d '{
    "farm_id":"FARM-001",
    "zone_id":"ZONE-01",
    "device_id":"BLE-NODE-01",
    "gateway_id":"BLE-GATEWAY-01",
    "source":"ble",
    "temperature_c":34.2,
    "humidity_pct":78,
    "rainfall_mm_h":0,
    "wind_speed_kmh":13.4,
    "wind_direction_deg":225,
    "light_lux":46000,
    "soil_moisture_pct":38,
    "soil_temperature_c":28.1,
    "soil_ph":6.7,
    "soil_ec_ds_m":1.2,
    "battery_pct":88,
    "rssi_dbm":-61
  }'
```

The response contains the field status, alerts, spray decision, buzzer command, relay command and local-log acknowledgement.

## Main API routes

| Route | Purpose |
|---|---|
| `POST /api/telemetry` | Direct Wi-Fi/HTTP sensor packet |
| `POST /api/telemetry/ble` | BLE gateway packet |
| `GET /api/field-status` | Complete dashboard decision |
| `GET /api/system/status` | Sensor, BLE, logger and actuator status |
| `GET /api/early-warning` | Transparent recent-trend warning |
| `GET /api/weather/forecast` | External 24-hour forecast for saved coordinates |
| `GET /api/telemetry/history` | Recent readings |
| `GET/PUT /api/config/thresholds` | Read or change crop thresholds |
| `POST /api/devices/heartbeat` | BLE node/gateway health |
| `GET /api/logger/status` | Persistent local logger status |
| `POST /api/offline/sync` | Replay queued packets |
| `POST /api/demo/{scenario}` | Hackathon demonstration |

## Tests

```bash
cd backend
PYTHONPATH=. pytest -q
```

See `CUSTOMIZE_PROJECT.md` for the exact places to change sensors, thresholds, alerts, dashboard cards, BLE settings and removable files.

If you are using the currently listed ESP32, DHT11, soil probe, MH-RD rain board,
MicroSD, buzzer and pump, follow `docs/YOUR_HARDWARE_WIRING.md` and upload the
matching sketch at `iot/esp32/available_hardware/gramin_connect_available_hardware.ino`.
