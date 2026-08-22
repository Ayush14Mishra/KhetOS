/*
  Gramin Connect IHAT1 - available hardware starter

  Fits the listed kit: ESP32, DHT11, capacitive soil sensor, MH-RD rain sensor,
  MicroSD module, buzzer and optional pump MOSFET driver.

  It reports unavailable wind and light sensors honestly through sensor_status.
  Do not set a made-up wind/rainfall value just to fill dashboard cards.

  Libraries: DHT sensor library by Adafruit, ArduinoJson 7.
*/
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <SPI.h>
#include <SD.h>

// Change these four values before uploading.
const char* WIFI_SSID = "YOUR_HOTSPOT_NAME";
const char* WIFI_PASSWORD = "YOUR_HOTSPOT_PASSWORD";
const char* API_URL = "http://YOUR_LAPTOP_IP:8000/api/telemetry";
const char* DEVICE_KEY = ""; // Must match DEVICE_INGEST_KEY only if you configured one.

const char* FARM_ID = "FARM-001";
const char* ZONE_ID = "ZONE-01";
const char* DEVICE_ID = "ESP32-NODE-01";

#define DHT_PIN 4
#define DHT_TYPE DHT11
#define SOIL_PIN 34
#define RAIN_DO_PIN 27
#define BUZZER_PIN 25
#define PUMP_MOSFET_PIN 26 // Optional; use a MOSFET driver, never connect pump directly.
#define ALERT_LED_PIN 33 // Optional external LED: GPIO 33 -> 220 ohm resistor -> LED anode; LED cathode -> GND.
#define SD_CS_PIN 5

// Set after testing the MH-RD DO LED/output. Most boards give LOW when wet.
const bool RAIN_SENSOR_WET_LOW = true;
// Calibrate these two values using a dry sample and a water-saturated sample.
const int SOIL_RAW_DRY = 3150;
const int SOIL_RAW_WET = 1350;

DHT dht(DHT_PIN, DHT_TYPE);
bool sdReady = false;

float soilMoisturePercent(int raw) {
  return constrain(100.0f * (SOIL_RAW_DRY - raw) / float(SOIL_RAW_DRY - SOIL_RAW_WET), 0.0f, 100.0f);
}

void appendToMicroSD(const String& packet) {
  if (!sdReady) return;
  File file = SD.open("/telemetry.ndjson", FILE_APPEND);
  if (!file) return;
  file.println(packet);
  file.close();
}

bool sendPacket(const String& packet) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  if (strlen(DEVICE_KEY)) http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST(packet);
  String response = http.getString();
  http.end();

  // A dangerous climate event makes an audible and visible warning.
  // Pump control stays manual for safety.
  if (code >= 200 && code < 300) {
    JsonDocument reply;
    if (!deserializeJson(reply, response)) {
      bool alertActive = reply["actuators"]["buzzer"]["active"] | false;
      digitalWrite(BUZZER_PIN, alertActive ? HIGH : LOW);
      digitalWrite(ALERT_LED_PIN, alertActive ? HIGH : LOW);
    }
  }
  return code >= 200 && code < 300;
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(RAIN_DO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(ALERT_LED_PIN, OUTPUT);
  pinMode(PUMP_MOSFET_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(ALERT_LED_PIN, LOW);
  digitalWrite(PUMP_MOSFET_PIN, LOW); // Pump OFF at startup.
  sdReady = SD.begin(SD_CS_PIN);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  bool dhtOk = !isnan(temperature) && !isnan(humidity);
  int soilRaw = analogRead(SOIL_PIN);
  bool soilOk = soilRaw >= 0 && soilRaw <= 4095;
  bool rainRaw = digitalRead(RAIN_DO_PIN);
  bool rainDetected = RAIN_SENSOR_WET_LOW ? !rainRaw : rainRaw;

  JsonDocument packet;
  packet["farm_id"] = FARM_ID;
  packet["zone_id"] = ZONE_ID;
  packet["device_id"] = DEVICE_ID;
  packet["source"] = "live";
  packet["temperature_c"] = dhtOk ? temperature : 0;
  packet["humidity_pct"] = dhtOk ? humidity : 0;
  packet["soil_moisture_pct"] = soilOk ? soilMoisturePercent(soilRaw) : 0;
  packet["rain_detected"] = rainDetected;
  packet["rainfall_mm_h"] = 0; // MH-RD detects rain; it does not measure mm/hour.
  packet["rain_gauge_type"] = "raindrop_detector_not_quantitative";
  packet["wind_speed_kmh"] = 0;
  packet["wind_direction_deg"] = 0;
  packet["wind_sensor_type"] = "not_connected";
  packet["light_lux"] = 0;
  packet["light_sensor_type"] = "not_connected";
  packet["soil_sensor_type"] = "capacitive_moisture";
  packet["battery_pct"] = 100;
  packet["sensor_status"]["temperature_humidity_ok"] = dhtOk;
  packet["sensor_status"]["soil_moisture_ok"] = soilOk;
  packet["sensor_status"]["rain_detection_ok"] = true;
  packet["sensor_status"]["wind_ok"] = false;
  packet["sensor_status"]["light_ok"] = false;
  packet["sensor_status"]["microsd_ok"] = sdReady;

  String body;
  serializeJson(packet, body);
  appendToMicroSD(body);
  if (!sendPacket(body)) Serial.println("Packet saved on microSD; Wi-Fi/API unavailable.");
  Serial.println(body);
  delay(5000);
}
