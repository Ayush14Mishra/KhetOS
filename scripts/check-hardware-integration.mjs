import fs from "node:fs";

const root = new URL("..", import.meta.url);
const ble = fs.readFileSync(new URL("iot/esp32/full_hardware/ble_sensor_node.ino", root), "utf8");
const gateway = fs.readFileSync(new URL("iot/esp32/full_hardware/ble_gateway.ino", root), "utf8");
const edge = fs.readFileSync(new URL("iot/esp32/full_hardware/gramin_connect_full_hardware.ino", root), "utf8");

for (const forbidden of ["return 31.7f", "return 68.0f", "return 42.0f", "return 32000.0f"]) {
  if (ble.includes(forbidden)) throw new Error(`Demo sensor constant remains: ${forbidden}`);
}
for (const required of ["DHT.h", "analogRead(SOIL_MOISTURE_PIN)", "readBH1750", "rainTips", "sensor_status"]) {
  if (!ble.includes(required)) throw new Error(`BLE sensor input missing: ${required}`);
}
for (const required of ["postTelemetry", "queuePayload", "flushQueue", "/api/telemetry/ble", "ble_gateway_id"]) {
  if (!gateway.includes(required)) throw new Error(`BLE gateway path missing: ${required}`);
}
for (const required of ["SD.begin", "appendDataLog", "/telemetry.ndjson", "appendOffline", "setSprayRelay"]) {
  if (!edge.includes(required)) throw new Error(`Edge logger/safety path missing: ${required}`);
}
console.log("Hardware integration source check: PASS");
