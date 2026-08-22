# Gramin Connect IHAT1 — Full Hardware Integration

This folder implements the remaining IHAT1 suggested components as real integration paths, not UI placeholders.

## 1. Ultrasonic anemometer

The full edge sketch reads an RS485/Modbus RTU ultrasonic wind sensor. Because register maps differ by manufacturer, the sketch exposes these constants at the top:

- `ULTRASONIC_BAUD`
- `ULTRASONIC_SLAVE_ID`
- `ULTRASONIC_SPEED_REGISTER`
- `ULTRASONIC_DIRECTION_REGISTER`
- `ULTRASONIC_SPEED_SCALE`
- `ULTRASONIC_DIRECTION_SCALE`

Connect the ultrasonic sensor through an RS485 transceiver (for example MAX485/isolated RS485). Use the exact register map and scaling from the sensor's manual. If the sensor is temporarily unavailable, the firmware reports that state rather than pretending pulse data is ultrasonic data.

## 2. Tipping-bucket rain gauge

The rain gauge is enabled by default in `gramin_connect_full_hardware.ino`. Each bucket tip is counted by a GPIO interrupt. `MM_PER_TIP` is the only calibration value you need to change to match your gauge. The payload includes both `rainfall_mm_h` and `rain_tip_count`.

## 3. Soil spectral sensing

The full sketch supports an Adafruit AS7265x 18-channel spectral sensor over I2C and sends calibrated spectral channels under `soil_spectrum`. This is a spectral measurement layer; it must be physically mounted/calibrated for soil samples. Do not claim that raw spectral channels directly equal NPK without a calibration model.

Install the **Adafruit AS7265x** Arduino library. Keep the existing capacitive probe too; moisture and spectral data complement each other.

## 4. BLE Node + Gateway

`ble_sensor_node.ino` exposes a GATT service/characteristic and sends JSON telemetry. `ble_gateway.ino` actively scans, connects to matching nodes, reads the telemetry characteristic, adds `source=ble` and `ble_gateway_id`, then POSTs the packet to `/api/telemetry/ble` over Wi-Fi. This is the actual bridge path.

## 5. Offline data logger

The full edge node writes every packet to `/telemetry.ndjson` on an optional microSD card (CS pin 13). It separately keeps an NDJSON queue at `/offline.ndjson` on ESP32 LittleFS whenever the API is unreachable. The microSD file is the evidence log; LittleFS is the delivery-retry queue.

## Suggested demo topology

`Ultrasonic Anemometer + Rain Gauge + DHT + Light + Soil Moisture + AS7265x`

→ **ESP32 Full Edge Node**

→ Wi-Fi → **FastAPI**

and, for another field zone:

`BLE Sensor Node` → **BLE Gateway** → Wi-Fi → **FastAPI**

→ zone-level microclimate → early warning → farmer guidance → spray relay/buzzer.

## Important hardware safety

- Use a proper isolated RS485 transceiver for outdoor/long cable runs.
- Do not power a relay, pump, buzzer or sensor directly from an ESP32 GPIO beyond the pin's rated current.
- Use a transistor/MOSFET or relay driver and a separate supply where required.
- Calibrate every sensor before presenting measured values as field-grade data.

### Spectral library

The full sketch uses the SparkFun `SparkFun_AS7265X` Arduino library. The AS7265x provides 18 discrete spectral channels; the firmware forwards calibrated A–W channel values. This is spectral sensing, not an NPK claim. Any soil-property model should be calibrated with local soil samples.

## Reference ESP32 pin map

| Function | ESP32 pin | Interface |
|---|---:|---|
| DHT11 temperature/RH | GPIO 4 | Digital |
| Tipping bucket | GPIO 14 | Interrupt / pull-up |
| RS485 RX/TX | GPIO 16 / 17 | UART2 |
| RS485 DE/RE | GPIO 5 | Digital |
| I2C SDA/SCL | GPIO 21 / 22 | AS7265x |
| Soil moisture | GPIO 34 | ADC |
| Rain wetness backup | GPIO 35 | ADC |
| Light/LDR backup | GPIO 32 | ADC |
| Wind direction backup | GPIO 33 | ADC |
| Pulse anemometer fallback | GPIO 27 | Interrupt |
| Spray relay | GPIO 26 | Driver/relay input |
| Buzzer | GPIO 25 | Driver/buzzer |

Use the actual sensor manufacturer's wiring and voltage requirements. Outdoor sensors should use appropriate surge protection, grounding and isolation. The pin map is a reference for the provided sketch, not a claim that every commercial sensor uses these pins.

## BLE node hardware note

The full BLE node sketch no longer contains fixed demo readings. Connect the physical DHT, soil-moisture and light sensors to the configured pins. Enable the tipping-bucket and pulse-anemometer flags only when those physical sensors are connected. The packet contains `sensor_status` flags so the backend can distinguish an unavailable sensor from a genuine zero reading.

## BLE gateway reliability

The gateway now maintains a LittleFS queue at `/ble_gateway_queue.ndjson`. If Wi-Fi or the FastAPI endpoint is unavailable, the packet is stored locally and replayed after connectivity returns. The gateway reconnects to Wi-Fi on each loop.

## Frontend build reliability

`npm run build` now checks for `vinext` and automatically runs the locked `npm ci` installation when dependencies are missing. This removes the previous `vinext is unavailable` failure caused by building before installing dependencies.
