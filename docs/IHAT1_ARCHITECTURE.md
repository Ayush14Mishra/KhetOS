# IHAT1 architecture and full flow

```text
Environmental sensor ─┐
Rain gauge ────────────┤
Ultrasonic wind ───────┤
Light sensor ──────────┼─> BLE field node ─> BLE gateway ─> FastAPI
Soil sensors/spectra ──┘       │                    │            │
                               └─ LittleFS queue     │            ├─ rule engine
                                                    │            ├─ trend warning
                                                    │            ├─ local NDJSON
                                                    │            ├─ InfluxDB
                                                    │            └─ MongoDB
                                                    │                    │
                                                    └────────────────────┼─> Dashboard
                                                                         ├─> Buzzer
                                                                         └─> Spray relay
```

## Packet flow

1. Sensors are sampled by the BLE field node.
2. The node validates ranges, writes the packet to microSD and creates a timestamped BLE/HTTP packet.
3. The packet is sent through BLE GATT to the gateway.
4. The gateway posts it to `/api/telemetry/ble` over local Wi-Fi.
5. FastAPI validates the schema and stores the raw packet locally.
6. The same packet is written to InfluxDB when available.
7. Crop thresholds generate green, yellow or red alerts.
8. Spray checks evaluate data freshness, wind, rain and humidity.
9. FastAPI returns a fail-safe relay command and buzzer pattern.
10. The dashboard polls `/api/field-status` and `/api/early-warning`.

If internet fails, the local Wi-Fi system continues. If local Wi-Fi fails, the ESP32 LittleFS queue retains packets and the edge fail-safe can keep spraying locked. Queued readings synchronize after reconnection.
