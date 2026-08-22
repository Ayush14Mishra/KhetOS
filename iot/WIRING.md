# Suggested ESP32 wiring

| Part | ESP32 pin | Note |
|---|---:|---|
| DHT11 data | GPIO 4 | 3.3 V, common ground |
| Capacitive soil sensor | GPIO 34 | ADC input; calibrate wet/dry raw values |
| MH-RD rain plate AO | GPIO 35 | Wet/dry only, not rainfall millimetres |
| LDR/module AO | GPIO 32 | Approximate light; BH1750 is better for lux |
| Anemometer pulse | GPIO 27 | Interrupt input; calibrate pulse factor |
| Wind direction analog | GPIO 33 | Optional vane |
| Relay IN | GPIO 26 | Pump/sprayer test only; use safe isolation |
| Active buzzer | GPIO 25 | Unsafe-operation alarm |

Never connect a mains pump directly to a breadboard relay. For the hackathon use a low-voltage LED or mini DC pump and a suitable isolated driver.

