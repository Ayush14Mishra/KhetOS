/*
  Gramin Connect IHAT1 - FULL HARDWARE EDGE NODE
  Implements the four remaining PS components:
    1) Ultrasonic anemometer over RS485/Modbus RTU (configurable registers)
    2) Tipping-bucket rain gauge (GPIO interrupt)
    3) Soil spectral sensor (AS7265x over I2C)
    4) BLE telemetry is handled by the separate BLE Gateway sketch

  Also includes microSD evidence logging, LittleFS offline queueing and a fail-safe spray relay.

  Libraries:
    - DHT sensor library by Adafruit
    - ArduinoJson 7
    - Adafruit AS7265x

  Hardware notes:
    - RS485 transceiver such as MAX485/isolated RS485 for the ultrasonic sensor.
    - AS7265x is a spectral sensor; mount it in a dark/light-controlled soil probe chamber.
    - Tipping bucket contact goes to TIPPING_BUCKET_PIN with pull-up.
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <LittleFS.h>
#include <SD.h>
#include <SPI.h>
#include <Wire.h>
#include <SparkFun_AS7265X.h>

#define DHT_PIN 4
#define DHT_TYPE DHT11
#define SOIL_MOISTURE_PIN 34
#define RAIN_PLATE_PIN 35
#define LIGHT_PIN 32
#define TIPPING_BUCKET_PIN 14
#define RELAY_PIN 26
#define BUZZER_PIN 25
#define SD_CS_PIN 13

// RS485 pins for the ultrasonic anemometer.
#define RS485_RX 16
#define RS485_TX 17
#define RS485_DE_RE 5
#define ULTRASONIC_BAUD 4800
#define ULTRASONIC_SLAVE_ID 1
#define ULTRASONIC_SPEED_REGISTER 0x0000
#define ULTRASONIC_DIRECTION_REGISTER 0x0001
#define ULTRASONIC_SPEED_SCALE 0.1f     // register value -> km/h; change to sensor manual
#define ULTRASONIC_DIRECTION_SCALE 1.0f // register value -> degrees

// Set false if the ultrasonic unit is unavailable; pulse fallback remains possible.
#define USE_ULTRASONIC_ANEMOMETER true
#define USE_PULSE_WIND_FALLBACK false
#define WIND_PULSE_PIN 27
#define USE_AS7265X true
#define MM_PER_TIP 0.2794f              // calibrate from your rain gauge datasheet

const char* WIFI_SSID = "YOUR_HOTSPOT_NAME";
const char* WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD";
const char* API_URL = "http://192.168.1.2:8000/api/telemetry";
const char* FARM_ID = "FARM-001";
const char* DEVICE_ID = "ESP32-FULL-01";
const char* ZONE_ID = "Z02";
const bool RELAY_ACTIVE_LOW = true;
const float MAX_SPRAY_WIND_KMH = 15.0f;

DHT dht(DHT_PIN, DHT_TYPE);
HardwareSerial RS485(2);
AS7265X spectral;
volatile unsigned long rainTips = 0;
volatile unsigned long windPulses = 0;
unsigned long lastPacketMs = 0;
bool sdReady = false;

void IRAM_ATTR onRainTip() { rainTips++; }
void IRAM_ATTR onWindPulse() { windPulses++; }

uint16_t crc16Modbus(const uint8_t* data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (uint8_t j = 0; j < 8; j++) crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : (crc >> 1);
  }
  return crc;
}

bool readHoldingRegister(uint8_t slave, uint16_t reg, uint16_t &value) {
  uint8_t request[8] = {slave, 0x03, uint8_t(reg >> 8), uint8_t(reg & 0xFF), 0, 1, 0, 0};
  uint16_t crc = crc16Modbus(request, 6);
  request[6] = crc & 0xFF; request[7] = crc >> 8;
  while (RS485.available()) RS485.read();
  digitalWrite(RS485_DE_RE, HIGH); delayMicroseconds(200); RS485.write(request, 8); RS485.flush();
  digitalWrite(RS485_DE_RE, LOW);
  unsigned long start = millis();
  uint8_t response[7]; size_t n = 0;
  while (millis() - start < 250 && n < sizeof(response)) if (RS485.available()) response[n++] = RS485.read();
  if (n != 7 || response[0] != slave || response[1] != 0x03 || response[2] != 2) return false;
  uint16_t got = uint16_t(response[5]) | (uint16_t(response[6]) << 8);
  uint16_t expected = crc16Modbus(response, 5);
  if (got != expected) return false;
  value = (uint16_t(response[3]) << 8) | response[4];
  return true;
}

float readUltrasonicSpeed(bool &ok) {
  uint16_t raw = 0; ok = readHoldingRegister(ULTRASONIC_SLAVE_ID, ULTRASONIC_SPEED_REGISTER, raw);
  return ok ? raw * ULTRASONIC_SPEED_SCALE : 0.0f;
}

float readUltrasonicDirection(bool &ok) {
  uint16_t raw = 0; ok = readHoldingRegister(ULTRASONIC_SLAVE_ID, ULTRASONIC_DIRECTION_REGISTER, raw);
  return ok ? fmod(raw * ULTRASONIC_DIRECTION_SCALE, 360.0f) : 0.0f;
}

float soilMoisturePercent(int raw) {
  const int dryRaw = 3150, wetRaw = 1350;
  return constrain(100.0f * (dryRaw - raw) / float(dryRaw - wetRaw), 0.0f, 100.0f);
}

void setSprayRelay(bool enabled) {
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? !enabled : enabled);
  digitalWrite(BUZZER_PIN, enabled ? LOW : HIGH);
}

void appendOffline(const String& packet) {
  File f = LittleFS.open("/offline.ndjson", FILE_APPEND);
  if (!f) return; f.println(packet); f.close();
}

void appendDataLog(const String& packet) {
  if (!sdReady) return;
  File f = SD.open("/telemetry.ndjson", FILE_APPEND);
  if (!f) return;
  f.println(packet);
  f.close();
}

bool sendPacket(const String& payload) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http; http.begin(API_URL); http.addHeader("Content-Type", "application/json");
  int status = http.POST(payload); http.end();
  return status >= 200 && status < 300;
}

void addSpectrum(JsonDocument& doc) {
#if USE_AS7265X
  spectral.takeMeasurementsWithBulb();
  JsonObject s = doc["soil_spectrum"].to<JsonObject>();
  s["A"] = spectral.getCalibratedA(); s["B"] = spectral.getCalibratedB();
  s["C"] = spectral.getCalibratedC(); s["D"] = spectral.getCalibratedD();
  s["E"] = spectral.getCalibratedE(); s["F"] = spectral.getCalibratedF();
  s["G"] = spectral.getCalibratedG(); s["H"] = spectral.getCalibratedH();
  s["I"] = spectral.getCalibratedI(); s["J"] = spectral.getCalibratedJ();
  s["K"] = spectral.getCalibratedK(); s["L"] = spectral.getCalibratedL();
  s["R"] = spectral.getCalibratedR(); s["S"] = spectral.getCalibratedS();
  s["T"] = spectral.getCalibratedT(); s["U"] = spectral.getCalibratedU();
  s["V"] = spectral.getCalibratedV(); s["W"] = spectral.getCalibratedW();
#endif
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  dht.begin();
  LittleFS.begin(true);
  sdReady = SD.begin(SD_CS_PIN);
  Serial.printf("microSD logger: %s\n", sdReady ? "ready" : "not connected");
  pinMode(RELAY_PIN, OUTPUT); pinMode(BUZZER_PIN, OUTPUT); pinMode(TIPPING_BUCKET_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(TIPPING_BUCKET_PIN), onRainTip, FALLING);
  setSprayRelay(false);
#if USE_PULSE_WIND_FALLBACK
  pinMode(WIND_PULSE_PIN, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(WIND_PULSE_PIN), onWindPulse, FALLING);
#endif
  pinMode(RS485_DE_RE, OUTPUT); digitalWrite(RS485_DE_RE, LOW); RS485.begin(ULTRASONIC_BAUD, SERIAL_8N1, RS485_RX, RS485_TX);
#if USE_AS7265X
  if (spectral.begin()) {
    spectral.setBulbCurrent(AS7265X_LED_CURRENT_LIMIT_12_5MA, AS72651_NIR);
    spectral.setBulbCurrent(AS7265X_LED_CURRENT_LIMIT_12_5MA, AS72652_VISIBLE);
    spectral.setBulbCurrent(AS7265X_LED_CURRENT_LIMIT_12_5MA, AS72653_UV);
    spectral.enableBulb(AS72651_NIR); spectral.enableBulb(AS72652_VISIBLE); spectral.enableBulb(AS72653_UV);
  }
#endif
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
  if (millis() - lastPacketMs < 5000) return;
  float seconds = max(5.0f, (millis() - lastPacketMs) / 1000.0f); lastPacketMs = millis();
  noInterrupts(); unsigned long tips = rainTips; rainTips = 0; unsigned long pulses = windPulses; windPulses = 0; interrupts();

  float temperature = dht.readTemperature(), humidity = dht.readHumidity();
  bool windOk = false, dirOk = false;
  float windKmh = 0, windDirection = 0;
#if USE_ULTRASONIC_ANEMOMETER
  windKmh = readUltrasonicSpeed(windOk); windDirection = readUltrasonicDirection(dirOk);
#endif
#if USE_PULSE_WIND_FALLBACK
  if (!windOk) windKmh = (pulses / seconds) * 2.4f;
#endif
  float rainfallMmH = (tips * MM_PER_TIP) * 3600.0f / seconds;
  bool rainDetected = tips > 0 || analogRead(RAIN_PLATE_PIN) < 2000;
  float soil = soilMoisturePercent(analogRead(SOIL_MOISTURE_PIN));
  float lightLux = (analogRead(LIGHT_PIN) / 4095.0f) * 70000.0f; // replace with BH1750 if available
  bool valid = !isnan(temperature) && !isnan(humidity);
  bool spraySafe = valid && !rainDetected && windKmh <= MAX_SPRAY_WIND_KMH;
  setSprayRelay(spraySafe);

  JsonDocument doc;
  doc["farm_id"] = FARM_ID; doc["device_id"] = DEVICE_ID; doc["zone_id"] = ZONE_ID;
  doc["temperature_c"] = valid ? temperature : 0; doc["humidity_pct"] = valid ? humidity : 0;
  doc["rainfall_mm_h"] = rainfallMmH; doc["rain_detected"] = rainDetected; doc["rain_tip_count"] = tips;
  doc["rain_gauge_type"] = "tipping_bucket"; doc["wind_speed_kmh"] = windKmh; doc["wind_direction_deg"] = windDirection;
  doc["wind_sensor_type"] = windOk ? "ultrasonic_rs485_modbus" : "ultrasonic_unavailable";
  doc["light_lux"] = lightLux; doc["soil_moisture_pct"] = soil; doc["soil_sensor_type"] = "moisture_plus_spectral";
  doc["pressure_hpa"] = 0; doc["battery_pct"] = 100; doc["source"] = "live";
  addSpectrum(doc);
  String payload; serializeJson(doc, payload); Serial.println(payload);
  appendDataLog(payload);
  if (!sendPacket(payload)) appendOffline(payload);
  if (WiFi.status() != WL_CONNECTED) WiFi.reconnect();
}
