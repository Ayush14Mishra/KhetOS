# Your hardware: wiring and dashboard mapping

This wiring plan uses the items in your inventory with one ESP32. It is the
best first prototype because it gives real temperature, humidity, soil and rain
detection with offline microSD logging.

## Safe wiring plan

| Hardware you have | ESP32 connection | What appears in Gramin Connect | Important note |
|---|---|---|---|
| DHT11 | VCC → 3.3V, GND → GND, DATA → GPIO 4 | Temperature and humidity cards; heat/humidity warning | Do not use 5V data logic on ESP32 GPIO. |
| Capacitive soil-moisture probe | VCC → 3.3V, GND → GND, AO → GPIO 34 | Soil moisture card; dry/too-wet condition | Calibrate dry and wet raw readings in the sketch. |
| MH-RD raindrop sensor | VCC → 3.3V, GND → GND, DO → GPIO 27 | Rain detected alert; spray lock | This is **not** rainfall in mm/hour. |
| MicroSD module | VCC/GND as labelled; CS → GPIO 5, SCK → 18, MISO → 19, MOSI → 23 | Persistent `/telemetry.ndjson` local evidence log | Check whether your module accepts 3.3V. Keep SPI logic at 3.3V. |
| Active buzzer module | Signal → GPIO 25, VCC/GND as module requires | Audible warning for red field status | Use a transistor driver if the buzzer load is not GPIO-safe. |
| Optional LED | GPIO 33 → 220-ohm resistor → LED anode; LED cathode → GND | Visible red alert indicator | The LED follows the same warning command as the buzzer. |
| Mini DC pump | MOSFET gate/driver input → GPIO 26; separate pump supply; common GND | Physical irrigation demonstration | Never connect the pump to ESP32 power or a GPIO directly. Add a flyback diode across the motor. |
| Solar panel | Panel → charge controller → battery → 5V/3.3V regulator → ESP32 | Field power source | Never connect the panel directly to the ESP32. |
| MQ gas sensor | Optional analog output → GPIO 32 after confirming voltage | Optional environmental value only | Not required for IHAT1 microclimate decisions. |

## Physical data flow

```text
DHT11 + soil probe + rain detector
              ↓
           ESP32
       ┌──────┼─────────┐
       ↓      ↓         ↓
  MicroSD log Wi-Fi  buzzer/pump driver
              ↓
     FastAPI decision engine
              ↓
    login dashboard + alerts
```

## What the dashboard will show

- DHT11: live temperature and humidity.
- Soil probe: soil-moisture percentage and dry/optimal/too-wet status.
- MH-RD: `Rain detected` and an immediate `Do not spray` decision when wet.
- MicroSD: local data logger evidence, even if Wi-Fi fails.
- Buzzer: active for red alerts such as rain, heat, unsafe conditions or sensor faults.
- Pump: use only as a supervised irrigation demonstration after connecting a MOSFET/relay driver.

The dashboard will label **wind speed/direction** and **light intensity** as not connected until you add an anemometer and BH1750 light sensor. Accurate rainfall in mm/hour requires a tipping-bucket rain gauge.

## Upload the matching sketch

Use:

`iot/esp32/available_hardware/gramin_connect_available_hardware.ino`

Before upload:

1. Install the Arduino libraries **DHT sensor library by Adafruit** and **ArduinoJson 7**.
2. In the sketch, enter your hotspot Wi-Fi name/password.
3. On your Mac, run `ipconfig getifaddr en0`.
4. Replace `YOUR_LAPTOP_IP` in `API_URL` with that address.
5. Select the correct ESP32 board and port in Arduino IDE, then upload.
6. Open Serial Monitor at `115200` baud.

If your board receives `401 Invalid device key`, either clear `DEVICE_INGEST_KEY`
in `.env` or put the same value in `DEVICE_KEY` in the ESP32 sketch.

## Hardware gaps for the full problem statement

| Requirement | Your current kit | Add for full measurement |
|---|---|---|
| Rainfall amount | Rain detection only | Tipping-bucket rain gauge |
| Wind speed/direction | Not present | Ultrasonic RS485/Modbus anemometer |
| Light intensity | Not present | BH1750 sensor |
| Soil spectra | Not present | AS7265x/suitable calibrated spectral sensor |
| BLE multi-zone network | One ESP32 Wi-Fi node is enough for first demo | Extra BLE node + BLE gateway for multiple zones |
