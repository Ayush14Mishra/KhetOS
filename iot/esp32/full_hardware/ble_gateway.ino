/*
  Gramin Connect IHAT1 - FULL BLE GATEWAY
  BLE node -> GATT read -> JSON -> Wi-Fi -> POST /api/telemetry.
  This is a real bridge, not only a scanner.
  Libraries: ESP32 BLE Arduino + ArduinoJson 7.
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>

static const char* WIFI_SSID = "YOUR_HOTSPOT_NAME";
static const char* WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD";
static const char* API_URL = "http://192.168.1.2:8000/api/telemetry/ble";
static const char* GATEWAY_ID = "BLE-GATEWAY-01";
static const char* SERVICE_UUID = "7f2f4a20-4b32-4a9a-9d60-1c1c8f7a1001";
static const char* CHAR_UUID    = "7f2f4a20-4b32-4a9a-9d60-1c1c8f7a1002";

bool postTelemetry(const String& raw) {
  if (WiFi.status() != WL_CONNECTED) return false;
  JsonDocument doc; if (deserializeJson(doc, raw)) return false;
  doc["source"] = "ble"; doc["ble_gateway_id"] = GATEWAY_ID;
  if (!doc["device_id"].is<const char*>()) doc["device_id"] = "BLE-NODE-UNKNOWN";
  String body; serializeJson(doc, body);
  HTTPClient http; http.begin(API_URL); http.addHeader("Content-Type", "application/json");
  int code = http.POST(body); http.end();
  Serial.printf("Gateway -> API: HTTP %d\n", code); return code >= 200 && code < 300;
}

String readNode(BLEAdvertisedDevice& advertised) {
  BLEClient* client = BLEDevice::createClient();
  client->setConnectTimeout(5000);
  if (!client->connect(&advertised)) { delete client; return ""; }

  BLERemoteService* service = client->getService(BLEUUID(SERVICE_UUID));
  if (!service) { client->disconnect(); delete client; return ""; }

  BLERemoteCharacteristic* characteristic = service->getCharacteristic(BLEUUID(CHAR_UUID));
  if (!characteristic || !characteristic->canRead()) {
    client->disconnect(); delete client; return "";
  }

  std::string value = characteristic->readValue();
  client->disconnect();
  delete client;
  return String(value.c_str());
}

void queuePayload(const String& payload) {
  File f = LittleFS.open("/ble_gateway_queue.ndjson", FILE_APPEND);
  if (!f) return;
  f.println(payload);
  f.close();
}

void flushQueue() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!LittleFS.exists("/ble_gateway_queue.ndjson")) return;

  File src = LittleFS.open("/ble_gateway_queue.ndjson", FILE_READ);
  if (!src) return;
  File remaining = LittleFS.open("/ble_gateway_queue.tmp", FILE_WRITE);
  if (!remaining) { src.close(); return; }

  bool blocked = false;
  while (src.available()) {
    String line = src.readStringUntil('\n');
    line.trim();
    if (!line.length()) continue;
    if (!blocked && postTelemetry(line)) continue;
    blocked = true;
    remaining.println(line);
  }
  src.close();
  remaining.close();
  LittleFS.remove("/ble_gateway_queue.ndjson");
  if (blocked) LittleFS.rename("/ble_gateway_queue.tmp", "/ble_gateway_queue.ndjson");
  else LittleFS.remove("/ble_gateway_queue.tmp");
}

void setup() {
  Serial.begin(115200);
  LittleFS.begin(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  BLEDevice::init(GATEWAY_ID);
}

void loop() {
  BLEScan* scan = BLEDevice::getScan(); scan->setActiveScan(true);
  BLEScanResults results = scan->start(4, false);
  for (int i = 0; i < results.getCount(); i++) {
    BLEAdvertisedDevice device = results.getDevice(i);
    if (!device.haveServiceUUID() || !device.isAdvertisingService(BLEUUID(SERVICE_UUID))) continue;
    Serial.printf("BLE node found: %s\n", device.getAddress().toString().c_str());
    String payload = readNode(device);
    if (payload.length()) { Serial.println(payload); if (!postTelemetry(payload)) queuePayload(payload); }
  }
  scan->clearResults();
  flushQueue();
  if (WiFi.status() != WL_CONNECTED) WiFi.reconnect();
  delay(1000);
}
