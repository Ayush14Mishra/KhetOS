import asyncio
from bleak import BleakClient

ESP32_ADDRESS = "28:05:A5:E2:4C:7A"

async def main():
    print("Connecting to KhetOS-ESP32...")

    async with BleakClient(ESP32_ADDRESS) as client:
        print("Connected:", client.is_connected)
        print("\nAvailable BLE Services:\n")

        for service in client.services:
            print("SERVICE:", service.uuid)

            for characteristic in service.characteristics:
                print("   CHARACTERISTIC:", characteristic.uuid)
                print("   PROPERTIES:", characteristic.properties)

asyncio.run(main())