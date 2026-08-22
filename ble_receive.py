import asyncio
from bleak import BleakScanner, BleakClient

DEVICE_NAME = "KhetOS-ESP32"
CHAR_UUID = "abcd1234-5678-1234-5678-abcdef123456"


def notification_handler(sender, data):
    try:
        print("LIVE DATA:", data.decode("utf-8"))
    except Exception:
        print("RAW DATA:", data)


async def main():
    print("Searching for KhetOS-ESP32...")

    device = await BleakScanner.find_device_by_name(
        DEVICE_NAME,
        timeout=15.0
    )

    if device is None:
        print("ERROR: KhetOS-ESP32 not found.")
        print("Check ESP32 power and make sure BLE sketch is running.")
        return

import asyncio
import json
import requests

from bleak import BleakScanner, BleakClient

DEVICE_NAME = "KhetOS-ESP32"
CHAR_UUID = "abcd1234-5678-1234-5678-abcdef123456"

API_URL = "http://127.0.0.1:8000/api/telemetry/ble"

def send_to_khetos(text):
    try:
        sensor = json.loads(text)

        # Current physical sensors
        payload = {
            "farm_id": "FARM-001",
            "zone_id": "ACR-Z01",
            "device_id": "ESP32-NODE-01",
            "gateway_id": "WINDOWS-BLE-GATEWAY",
            "source": "ble",

            # TEMPORARY until temperature/humidity hardware is added.
            # Required by current backend Telemetry model.
            "temperature_c": 0,
            "humidity_pct": 0,

            "soil_moisture_pct": sensor.get(
                "soil_moisture_pct", 0
            ),

            "rain_detected": sensor.get(
                "rain_detected", False
            ),

            "sensor_status": {
                "temperature_humidity_ok": False,
                "soil_moisture_ok": True,
                "rain_detection_ok": True,
                "wind_ok": False,
                "light_ok": False
            }
        }

        response = requests.post(
            API_URL,
            params={
                "crop": "soyabean",
                "growth_stage": "all"
            },
            json=payload,
            timeout=5
        )

        print("KhetOS API:", response.status_code)

        if response.status_code == 200:
            print("SAVED TO KHETOS")
        else:
            print("API RESPONSE:", response.text)

    except Exception as e:
        print("KhetOS API ERROR:", e)


def notification_handler(sender, data):
    try:
        text = data.decode("utf-8")

        print("\nLIVE DATA:", text)

        send_to_khetos(text)

    except Exception as e:
        print("BLE DATA ERROR:", e)


async def main():

    print("Searching for KhetOS-ESP32...")

    device = await BleakScanner.find_device_by_name(
        DEVICE_NAME,
        timeout=20
    )

    if device is None:
        print("ERROR: KhetOS-ESP32 not found.")
        print("Press ESP32 EN/RESET and try again.")
        return

    print("Found:", device.name)
    print("Address:", device.address)

    print("\nConnecting...")

    async with BleakClient(device) as client:

        print("Connected:", client.is_connected)

        print("\nListening for LIVE sensor data...")
        print("Press Ctrl+C to stop.\n")

        await client.start_notify(
            CHAR_UUID,
            notification_handler
        )

        while True:
            await asyncio.sleep(1)


asyncio.run(main())