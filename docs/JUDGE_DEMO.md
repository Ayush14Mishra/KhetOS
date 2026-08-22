# KhetOS IHAT1 judge demonstration

## 90-second flow

1. Open **Dashboard** and point out the source badge: LIVE, BLE, DEMO or CACHED.
2. Show the seven required field measurements and the green/yellow/red field status.
3. Press **Heat**. Open **Heat stress** and explain temperature, humidity, heat index, soil moisture and the configured crop limit.
4. Press **Rain**. Explain that a tipping bucket reports mm/h, while an MH-RD board only detects rain.
5. Press **Wind**. Show wind speed, compass direction and degrees. The spray relay must lock.
6. Press **Spray unsafe**. Open **Spray safety** and show the five checks: sensor health, freshness, wind, rain and humidity.
7. Open **Hardware status**. Show sensors, BLE node, BLE gateway, microSD logger, backend logger, buzzer and relay.
8. Finish with the flow: Sensors → BLE node → BLE gateway → FastAPI → logger/InfluxDB → dashboard/buzzer/spray lock.

Each demonstration scenario stays active for approximately 45 seconds.

## Honest hardware statement

KhetOS never presents an unavailable sensor as live. The available-hardware
firmware marks missing wind and light sensors as not connected. An MH-RD board
provides rain detection only; quantitative rainfall needs a tipping-bucket
gauge. Crop limits are configurable starting values and must be validated with
an agronomist before field deployment.

## One-line explanation

> KhetOS is an offline-first cyber-physical early-warning system that turns localized field measurements into explainable alerts and physical actions, even when internet connectivity fails.
