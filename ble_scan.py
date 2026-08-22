import asyncio
from bleak import BleakScanner

async def main():
    print("Scanning for BLE devices...")

    devices = await BleakScanner.discover(timeout=10)

    if not devices:
        print("No BLE devices found.")
        return

    for device in devices:
        print("Name:", device.name)
        print("Address:", device.address)
        print("----------------------")

asyncio.run(main())