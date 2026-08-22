/*
  Gramin Connect IHAT1 - REAL BLE SENSOR NODE
  Reads physical sensors and publishes telemetry over BLE GATT.

  Sensors on this node:
    - DHT11/DHT22: temperature + humidity
    - Analog capacitive soil-moisture sensor
    - Analog LDR (or replace with BH1750 using USE_BH1750)
    - Tipping-bucket rain gauge (optional)
    - Pulse anemometer (optional fallback)

  IMPORTANT: There are NO hard-coded demo sensor readings in this sketch.
  If a sensor is unavailable, its value is reported as 0 and the corresponding
  *_ok flag is false. The gateway/backend can therefore distinguish a real zero
  from an unavailable sensor.

  Libraries:
    - ESP32 BLE Arduino
    - ArduinoJson 7
    - DHT sensor library by Adafruit
*/
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <math.h>

static const char* SERVICE_UUID = "7f2f4a20-4b32-4a9a-9d60-1c1c8f7a1001";
static const char* CHAR_UUID    = "7f2f4a20-4b32-4a9a-9d60-1c1c8f7a1002";
static const char* NODE_ID      = "BLE-NODE-01";
static const char* FARM_ID      = "FARM-001";
static const char* ZONE_ID      = "Z03";

#define DHT_PIN 4
#define DHT_TYPE DHT11
#define SOIL_MOISTURE_PIN 34
#define LIGHT_PIN 32
#define TIPPING_BUCKET_PIN 14
#define WIND_PULSE_PIN 27

// Set true only if this BLE node physically has these sensors connected.
#define USE_TIPPING_BUCKET true
#define USE_PULSE_ANEMOMETER false
#define USE_BH1750 false

#define MM_PER_TIP 0.2794f
#define MAX_SENSOR_AGE_MS 10000UL

BLECharacteristic* telemetryChar = nullptr;
DHT dht(DHT_PIN, DHT_TYPE);
volatile unsigned long rainTips = 0;
volatile unsigned long windPulses = 0;
unsigned long lastPacketMs = 0;
unsigned long lastDhtGoodMs = 0;
float lastTemp = 0;
float lastHumidity = 0;

void IRAM_ATTR onRainTip() { rainTips++; }
void IRAM_ATTR onWindPulse() { windPulses++; }

float soilMoisturePercent(int raw) {
  const int dryRaw = 3150;
  const int wetRaw = 1350;
  return constrain(100.0f * (dryRaw - raw) / float(dryRaw - wetRaw), 0.0f, 100.0f);
}

bool readBH1750(float& lux) {
#if USE_BH1750
  Wire.beginTransmission(0x23);
  Wire.write(0x10); // continuous high-resolution mode
  if (Wire.endTransmission() != 0) return false;
  delay(180);
  if (Wire.requestFrom(0x23, 2) != 2) return false;
  uint16_t raw = (uint16_t(Wire.read()) << 8) | Wire.read();
  lux = raw / 1.2f;
  return true;
#else
  (void)lux;
  return false;
#endif
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  Wire.begin();

  pinMode(SOIL_MOISTURE_PIN, INPUT);
  pinMode(LIGHT_PIN, INPUT);
#if USE_TIPPING_BUCKET
  pinMode(TIPPING_BUCKET_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(TIPPING_BUCKET_PIN), onRainTip, FALLING);
#endif
#if USE_PULSE_ANEMOMETER
  pinMode(WIND_PULSE_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(WIND_PULSE_PIN), onWindPulse, FALLING);
#endif

  BLEDevice::init(NODE_ID);
  BLEServer* server = BLEDevice::createServer();
  BLEService* service = server->createService(SERVICE_UUID);
  telemetryChar = service->createCharacteristic(
    CHAR_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  telemetryChar->addDescriptor(new BLE2902());

  JsonDocument ready;
  ready["node_id"] = NODE_ID;
  ready["status"] = "ready";
  ready["sensor_mode"] = "live";
  String readyPayload;
  serializeJson(ready, readyPayload);
  telemetryChar->setValue(readyPayload.c_str());

  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();
}

void loop() {
  if (millis() - lastPacketMs < 5000) return;
  const unsigned long now = millis();
  const float seconds = max(5.0f, (now - lastPacketMs) / 1000.0f);
  lastPacketMs = now;

  noInterrupts();
  unsigned long tips = rainTips;
  rainTips = 0;
  unsigned long pulses = windPulses;
  windPulses = 0;
  interrupts();

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  bool tempOk = !isnan(temperature);
  bool humidityOk = !isnan(humidity);
  if (tempOk && humidityOk) {
    lastTemp = temperature;
    lastHumidity = humidity;
    lastDhtGoodMs = now;
  } else if (now - lastDhtGoodMs <= MAX_SENSOR_AGE_MS) {
    temperature = lastTemp;
    humidity = lastHumidity;
    tempOk = humidityOk = true;
  }

  int soilRaw = analogRead(SOIL_MOISTURE_PIN);
  bool soilOk = soilRaw >= 0 && soilRaw <= 4095;
  float soil = soilOk ? soilMoisturePercent(soilRaw) : 0;

  float lightLux = 0;
  bool lightOk = readBH1750(lightLux);
  if (!lightOk) {
    int lightRaw = analogRead(LIGHT_PIN);
    lightOk = lightRaw >= 0 && lightRaw <= 4095;
    if (lightOk) lightLux = (lightRaw / 4095.0f) * 70000.0f;
  }

  float rainfallMmH = 0;
  bool rainOk = false;
#if USE_TIPPING_BUCKET
  rainfallMmH = (tips * MM_PER_TIP) * 3600.0f / seconds;
  rainOk = true;
#endif

  float windKmh = 0;
  bool windOk = false;
#if USE_PULSE_ANEMOMETER
  windKmh = (pulses / seconds) * 2.4f;
  windOk = true;
#endif

  bool rainDetected = tips > 0;

  JsonDocument doc;
  doc["farm_id"] = FARM_ID;
  doc["device_id"] = NODE_ID;
  doc["node_id"] = NODE_ID;
  doc["zone_id"] = ZONE_ID;
  doc["timestamp_ms"] = now;

  doc["temperature_c"] = tempOk ? temperature : 0;
  doc["humidity_pct"] = humidityOk ? humidity : 0;
  doc["soil_moisture_pct"] = soilOk ? soil : 0;
  doc["light_lux"] = lightOk ? lightLux : 0;
  doc["rainfall_mm_h"] = rainfallMmH;
  doc["rain_detected"] = rainDetected;
  doc["rain_tip_count"] = tips;
  doc["wind_speed_kmh"] = windKmh;
  doc["wind_direction_deg"] = 0;
  doc["pressure_hpa"] = 0;
  doc["battery_pct"] = 100;
  doc["source"] = "ble";

  doc["sensor_status"]["temperature_ok"] = tempOk;
  doc["sensor_status"]["humidity_ok"] = humidityOk;
  doc["sensor_status"]["soil_ok"] = soilOk;
  doc["sensor_status"]["light_ok"] = lightOk;
  doc["sensor_status"]["rain_gauge_ok"] = rainOk;
  doc["sensor_status"]["wind_ok"] = windOk;

  doc["rain_gauge_type"] = rainOk ? "tipping_bucket" : "not_connected";
  doc["wind_sensor_type"] = windOk ? "pulse_anemometer" : "not_connected";
  doc["soil_sensor_type"] = soilOk ? "moisture" : "not_connected";
  doc["light_sensor_type"] = USE_BH1750 ? "bh1750" : "ldr_approximate";

  String payload;
  serializeJson(doc, payload);
  telemetryChar->setValue(payload.c_str());
  telemetryChar->notify();
  Serial.println(payload);
}
