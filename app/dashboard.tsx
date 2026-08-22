"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeIndianRupee,
  BellRing,
  Boxes,
  Bug,
  Camera,
  ChevronRight,
  CircleCheckBig,
  CircleUserRound,
  CloudSun,
  Compass,
  Database,
  Droplets,
  Gauge,
  HandCoins,
  Languages,
  Leaf,
  Lightbulb,
  ListChecks,
  LogOut,
  MapPinned,
  Menu,
  MessageCircle,
  Moon,
  RadioTower,
  ReceiptIndianRupee,
  ScanLine,
  Send,
  ShieldCheck,
  ShoppingBasket,
  Siren,
  Smartphone,
  Sprout,
  Sun,
  ThermometerSun,
  Volume2,
  WifiOff,
  Wrench,
  X,
  PlayCircle,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import FarmMap from "./components/farm-map";
import PageLocalizer from "./components/page-localizer";
import { generateInternalFarmerId } from "./lib/farmer-identity";
import { translatePhrase, translateTerm } from "./lib/full-i18n";
import {
  createAuction,
  createFarmerAction,
  decision as fetchDecision,
  earlyWarning as fetchEarlyWarning,
  clearLocalSession,
  getLocalProfile,
  getLocalProfiles,
  jury as fetchJury,
  latestTelemetry,
  listAuctions,
  listFarmerActions,
  marketPrices,
  notificationOutbox,
  queueWhatsApp,
  pestLiveStatus,
  saveProfile,
  selectLocalProfile,
  schemeMatches,
  systemStatus as fetchSystemStatus,
  runDemoScenario,
  weatherForecast as fetchWeatherForecast,
} from "./lib/api";
import {
  LOCALES,
  localeByCode,
  translate,
  type CopyKey,
  type LocaleCode,
} from "./lib/i18n";
import type {
  Auction,
  Decision,
  EarlyWarning,
  FarmerAction,
  FarmerProfile,
  Jury,
  MarketPrice,
  NotificationItem,
  PestDetection,
  PestLiveStatus,
  SchemeMatch,
  SystemStatus,
  Telemetry,
  WeatherForecast,
  Zone,
} from "./lib/types";

type ViewKey =
  | "dashboard"
  | "farm"
  | "pest"
  | "sabha"
  | "weather"
  | "heat"
  | "safety"
  | "proof"
  | "schemes"
  | "cluster"
  | "finance"
  | "market"
  | "devices"
  | "profile"
  | "guide";

const defaultProfile: FarmerProfile = {
  id: "",
  name: "Riya Farm Pilot",
  mobile: "",
  state: "Madhya Pradesh",
  district: "Indore",
  village: "Acropolis Campus, Manglia",
  land_acres: 2,
  ownership: "owner",
  category: "general",
  gender: "female",
  annual_income: 180000,
  crop: "Tomato",
  crop_variety: "",
  growth_stage: "Flowering",
  sowing_date: "",
  expected_harvest_date: "",
  previous_crop: "",
  irrigation: "Drip",
  water_source: "Borewell",
  soil_type: "Loamy",
  drainage: "Moderate",
  field_slope: "Nearly level",
  last_irrigation_date: "",
  last_spray_date: "",
  last_fertilizer_date: "",
  pest_history: "",
  disease_history: "",
  nearby_sensitive_area: "",
  whatsapp_alert_consent: true,
  alert_language: "en",
  has_aadhaar: false,
  has_farmer_id: false,
  agristack_farmer_id: "",
  latitude: 22.821292,
  longitude: 75.943164,
};

function fallbackTelemetry(tick = 0): Telemetry {
  return {
    farm_id: "FARM-001",
    device_id: "ESP32-EDGE-01",
    zone_id: "ACR-Z01",
    timestamp: new Date().toISOString(),
    temperature_c: Number((31.7 + Math.sin(tick / 7) * 0.4).toFixed(1)),
    humidity_pct: Math.round(68 + Math.sin(tick / 9) * 2),
    rainfall_mm_h: 0,
    wind_speed_kmh: Number((17.4 + Math.sin(tick / 5) * 1.1).toFixed(1)),
    wind_direction_deg: 238,
    light_lux: Math.round(46200 + Math.sin(tick / 8) * 900),
    soil_moisture_pct: Math.round(37 + Math.sin(tick / 12)),
    pressure_hpa: 1007.6,
    battery_pct: 86,
    source: "demo",
  };
}

const fallbackDecision: Decision = {
  severity: "danger",
  spray_allowed: false,
  title: "Spray lock active",
  reason: "Wind 17.4 km/h is above the configured 15 km/h limit.",
  confidence: 91,
  checks: [
    { label: "Wind", value: "17.4 km/h", pass: false },
    { label: "Rain", value: "0 mm/h", pass: true },
    { label: "Humidity", value: "68%", pass: true },
    { label: "Sensor freshness", value: "1 sec", pass: true },
  ],
};
const fallbackEarlyWarning: EarlyWarning = {
  farm_id: "FARM-001",
  zone_id: "ACR-Z01",
  horizon_minutes: 60,
  status: "danger",
  summary: "High wind is already above the spray threshold; drift risk is rising.",
  risks: [
    {
      type: "high_wind",
      severity: "danger",
      label: "High wind risk",
      message: "Wind is above 15 km/h. Spray should remain locked.",
    },
  ],
  current: { temperature_c: 31.7, wind_speed_kmh: 17.4, rainfall_mm_h: 0, humidity_pct: 68 },
  projected: { temperature_c: 32.0, wind_speed_kmh: 18.1, rainfall_mm_h: 0, humidity_pct: 69 },
  trend_per_minute: { temperature_c: 0, wind_speed_kmh: 0, rainfall_mm_h: 0, humidity_pct: 0 },
  evidence_packets: 1,
  source: "cached",
};
const fallbackSystemStatus: SystemStatus = {
  farm_id: "FARM-001",
  generated_at: new Date(0).toISOString(),
  packet_age_seconds: 0,
  connection: "offline/cached",
  data_source: "cached",
  components: [
    { id: "environment", label: "Environmental sensor", status: "demo", detail: "Temperature + humidity" },
    { id: "soil", label: "Soil sensor", status: "demo", detail: "Moisture" },
    { id: "rain", label: "Rain sensor", status: "demo", detail: "Rain detection / rainfall" },
    { id: "wind", label: "Wind sensor", status: "demo", detail: "Speed + direction" },
    { id: "light", label: "Light sensor", status: "demo", detail: "Light intensity" },
    { id: "ble_node", label: "BLE node", status: "demo", detail: "Awaiting gateway" },
    { id: "ble_gateway", label: "BLE gateway", status: "demo", detail: "Awaiting gateway" },
    { id: "microsd", label: "ESP32 microSD logger", status: "demo", detail: "On-device evidence log" },
    { id: "logger", label: "Gateway/backend logger", status: "recording", detail: "NDJSON fallback" },
  ],
  logger: { enabled: true, format: "NDJSON", telemetry_records: 0, event_records: 0, survives_internet_loss: true },
  actuator: { buzzer_active: false, buzzer_pattern: "none", spray_relay_locked: true },
};
const fallbackWeatherForecast: WeatherForecast = {
  farm_id: "FARM-001",
  provider: "Open-Meteo",
  forecast_type: "External forecast unavailable; field sensors remain the decision source.",
  latitude: 22.821292,
  longitude: 75.943164,
  timezone: "Asia/Kolkata",
  cached: false,
  current: {},
  hours: [],
};

const fallbackJury: Jury = {
  verdict: "uncertain",
  confidence: 74,
  cached_at: new Date().toISOString(),
  recommendation:
    "Forecasts disagree on afternoon wind. Use the field sensor before spraying.",
  models: [
    {
      name: "Open-Meteo Best Match",
      rain_24h_mm: 3.2,
      max_temp_c: 33.1,
      max_wind_kmh: 19,
      source: "Open-Meteo",
    },
    {
      name: "ECMWF IFS",
      rain_24h_mm: 6.1,
      max_temp_c: 32.4,
      max_wind_kmh: 23,
      source: "Open-Meteo model API",
    },
    {
      name: "GFS",
      rain_24h_mm: 1.4,
      max_temp_c: 34,
      max_wind_kmh: 17,
      source: "Open-Meteo model API",
    },
  ],
};
const fallbackSchemes: SchemeMatch[] = [
  {
    id: "MH-MECH",
    title: "State Agriculture Mechanization Scheme",
    authority: "MahaDBT",
    benefit: "Subsidy on eligible farm machinery",
    score: 92,
    reasons: ["Maharashtra resident", "Farm owner", "Profile information"],
    documents: ["Aadhaar", "7/12", "8-A"],
    official_url:
      "https://mahadbt.maharashtra.gov.in/Farmer/SchemeData/SchemeData?str=E9DDFA703C38E51A147B39AD4D6A9082",
    verified_on: "2026-08-18",
  },
  {
    id: "PMFBY",
    title: "Pradhan Mantri Fasal Bima Yojana",
    authority: "MoA&FW",
    benefit: "Crop insurance against notified risks",
    score: 84,
    reasons: ["Cultivator", "Notified crop check required"],
    documents: ["Land record", "Bank account", "Crop details"],
    official_url: "https://pmfby.gov.in/",
    verified_on: "2026-08-18",
  },
  {
    id: "PMKSY",
    title: "Per Drop More Crop",
    authority: "PMKSY · MahaDBT · Government of Maharashtra",
    benefit: "Micro-irrigation assistance",
    score: 78,
    reasons: ["2-acre holding", "Drip irrigation profile"],
    documents: ["Aadhaar", "Land record", "Quotation"],
    official_url:
      "https://mahadbt.maharashtra.gov.in/Farmer/SchemeData/SchemeData?str=E9DDFA703C38E51AC7B56240D6D84F28",
    verified_on: "2026-08-18",
  },
  {
    id: "MIDH",
    title: "Mission for Integrated Development of Horticulture",
    authority: "MahaDBT · Government of Maharashtra",
    benefit:
      "Assistance for eligible horticulture components shown on the official portal.",
    score: 76,
    reasons: ["Maharashtra farm", "Tomato is a horticulture crop"],
    documents: ["Aadhaar availability", "7/12", "8-A"],
    official_url:
      "https://mahadbt.maharashtra.gov.in/Farmer/SchemeData/SchemeData?str=E9DDFA703C38E51AF823840F3424F82E",
    verified_on: "2026-08-18",
  },
  {
    id: "PMRKVY-RAD",
    title: "Rainfed Area Development",
    authority: "PM-RKVY · MahaDBT · Government of Maharashtra",
    benefit:
      "Support for eligible integrated farming components in rainfed areas.",
    score: 61,
    reasons: ["Maharashtra farm", "Final component eligibility must be checked"],
    documents: ["Aadhaar availability", "Land record", "Component proposal"],
    official_url:
      "https://mahadbt.maharashtra.gov.in/Farmer/SchemeData/SchemeData?str=E9DDFA703C38E51A1DD809A4CDCCB84A",
    verified_on: "2026-08-18",
  },
];

function fallbackSchemesFor(profile: FarmerProfile): SchemeMatch[] {
  return fallbackSchemes.map((scheme) => {
    const identityAdjustment =
      (profile.has_aadhaar ? 0 : -7) +
      (profile.has_farmer_id && profile.agristack_farmer_id ? 2 : 0);
    return {
      ...scheme,
      score: Math.max(35, Math.min(98, scheme.score + identityAdjustment)),
      reasons: [
        `${profile.state} profile`,
        `${profile.land_acres}-acre ${profile.ownership} holding`,
        `${profile.crop} · ${profile.irrigation}`,
        profile.has_aadhaar
          ? "Aadhaar document availability confirmed"
          : "Aadhaar document availability must be confirmed",
        profile.has_farmer_id && profile.agristack_farmer_id
          ? "AgriStack Farmer ID available"
          : "AgriStack Farmer ID not supplied",
      ],
    };
  });
}
const fallbackPrices: MarketPrice[] = [
  {
    commodity: "Tomato",
    market: "Kalyan APMC",
    district: "Thane",
    state: "Maharashtra",
    min_price: 1400,
    modal_price: 1850,
    max_price: 2300,
    arrival_date: "18/08/2026",
    source: "data.gov.in cached sample",
  },
  {
    commodity: "Tomato",
    market: "Vashi APMC",
    district: "Thane",
    state: "Maharashtra",
    min_price: 1600,
    modal_price: 2100,
    max_price: 2600,
    arrival_date: "18/08/2026",
    source: "data.gov.in cached sample",
  },
  {
    commodity: "Tomato",
    market: "Pune APMC",
    district: "Pune",
    state: "Maharashtra",
    min_price: 1200,
    modal_price: 1950,
    max_price: 2500,
    arrival_date: "18/08/2026",
    source: "data.gov.in cached sample",
  },
];

const fallbackAuctions: Auction[] = [
  {
    id: "AUCTION-OFFLINE-01",
    farm_id: "FARM-002",
    farmer_id: "FARMER-002",
    commodity: "Tomato",
    quantity_kg: 650,
    reserve_price_per_kg: 19,
    village: "Vasind",
    closes_at: "2026-08-20T11:30:00+05:30",
    created_at: "2026-08-18T14:30:00+05:30",
    status: "open",
  },
  {
    id: "AUCTION-OFFLINE-02",
    farm_id: "FARM-003",
    farmer_id: "FARMER-003",
    commodity: "Chilli",
    quantity_kg: 280,
    reserve_price_per_kg: 42,
    village: "Shahapur",
    closes_at: "2026-08-21T10:00:00+05:30",
    created_at: "2026-08-18T15:10:00+05:30",
    status: "open",
  },
];

const fallbackNotifications: NotificationItem[] = [
  {
    id: "NOTICE-SPRAY-01",
    title: "Spray lock active",
    message: fallbackDecision.reason,
    severity: "danger",
    created_at: new Date().toISOString(),
    status: "active",
    channel: "Real-time alarm system",
  },
];

const fallbackPest: PestDetection = {
  crop: "Tomato",
  insect: "no_detection",
  zone_id: "Z02",
  count_5min: 0,
  vision_confidence: 0,
  harmful: false,
  severity: "observe",
  risk_probability: 0,
  reason: "Waiting for the first field-camera detection.",
  field_action:
    "Keep the yellow sticky trap in position. A verified insect event will appear here automatically.",
  captured_at: "",
  source: "cached",
};
const fallbackPestLive: PestLiveStatus = {
  connected: false,
  last_seen_seconds: null,
  detection: null,
  notification: null,
};

const guideUi: Record<LocaleCode, { nav: string; eyebrow: string; hero: string; intro: string; offline: string; inLanguage: string; listen: string; simple: string; why: string; now: string; keep: string; youtube: string; live: string }> = {
  en: { nav: "Learn & Understand", eyebrow: "FARM LEARNING GUIDE", hero: "Understand your field, one topic at a time", intro: "Choose a topic to see what the reading means, why it matters and what you can do next.", offline: "Available anytime", inLanguage: "IN YOUR LANGUAGE", listen: "Listen", simple: "In simple words", why: "Why does it matter?", now: "What should I do now?", keep: "Keep in mind", youtube: "Open YouTube", live: "My field right now" },
  hi: { nav: "समझो और करो", eyebrow: "किसान गाइड · आसान समझ", hero: "समझो → जांचो → सही कदम उठाओ", intro: "Sensor की रीडिंग समझ नहीं आ रही? विषय चुनें और आसान भाषा में मतलब, खेत की स्थिति और अगला कदम जानें।", offline: "बेसिक गाइड ऑफलाइन भी काम करती है", inLanguage: "आपकी भाषा में", listen: "सुनें", simple: "आसान भाषा में", why: "यह क्यों जरूरी है?", now: "अभी क्या करें?", keep: "ध्यान रखें", youtube: "YouTube खोलें", live: "मेरे खेत की अभी की स्थिति" },
  mr: { nav: "समजून घ्या आणि करा", eyebrow: "शेतकरी मार्गदर्शक · सोपी माहिती", hero: "समजा → तपासा → योग्य कृती करा", intro: "Sensor ची रीडिंग समजत नाही? विषय निवडा आणि सोप्या भाषेत अर्थ, शेताची स्थिती आणि पुढची कृती जाणून घ्या.", offline: "मूलभूत मार्गदर्शक ऑफलाइनही काम करते", inLanguage: "तुमच्या भाषेत", listen: "ऐका", simple: "सोप्या भाषेत", why: "हे का महत्त्वाचे आहे?", now: "आता काय करावे?", keep: "लक्षात ठेवा", youtube: "YouTube उघडा", live: "माझ्या शेताची सध्याची स्थिती" },
  gu: { nav: "સમજો અને કરો", eyebrow: "ખેડૂત માર્ગદર્શિકા · સરળ સમજ", hero: "સમજો → તપાસો → યોગ્ય પગલું લો", intro: "Sensor ની રીડિંગ સમજાતી નથી? વિષય પસંદ કરો અને સરળ ભાષામાં અર્થ, ખેતરની સ્થિતિ અને આગળનું પગલું જાણો.", offline: "મૂળભૂત માર્ગદર્શિકા ઑફલાઇન પણ કામ કરે છે", inLanguage: "તમારી ભાષામાં", listen: "સાંભળો", simple: "સરળ ભાષામાં", why: "આ કેમ મહત્વનું છે?", now: "હવે શું કરવું?", keep: "ધ્યાનમાં રાખો", youtube: "YouTube ખોલો", live: "મારા ખેતરની હાલની સ્થિતિ" },
  bn: { nav: "বুঝুন ও করুন", eyebrow: "কৃষক গাইড · সহজ ব্যাখ্যা", hero: "বুঝুন → পরীক্ষা করুন → সঠিক পদক্ষেপ নিন", intro: "Sensor-এর রিডিং বুঝতে পারছেন না? বিষয় বেছে নিয়ে সহজ ভাষায় অর্থ, ক্ষেতের অবস্থা ও পরবর্তী পদক্ষেপ জানুন।", offline: "মৌলিক গাইড অফলাইনেও কাজ করে", inLanguage: "আপনার ভাষায়", listen: "শুনুন", simple: "সহজ ভাষায়", why: "এটি কেন গুরুত্বপূর্ণ?", now: "এখন কী করবেন?", keep: "মনে রাখুন", youtube: "YouTube খুলুন", live: "আমার ক্ষেতের বর্তমান অবস্থা" },
  as: { nav: "বুজি লওক আৰু কৰক", eyebrow: "কৃষক গাইড · সহজ ব্যাখ্যা", hero: "বুজি লওক → পৰীক্ষা কৰক → সঠিক পদক্ষেপ লওক", intro: "Sensor ৰিডিং বুজি পোৱা নাই? বিষয় বাছি সহজ ভাষাত অৰ্থ, খেতিৰ অৱস্থা আৰু পৰৱৰ্তী পদক্ষেপ চাওক।", offline: "মূল গাইড অফলাইনতো কাম কৰে", inLanguage: "আপোনাৰ ভাষাত", listen: "শুনক", simple: "সহজ ভাষাত", why: "এইটো কিয় গুৰুত্বপূৰ্ণ?", now: "এতিয়া কি কৰিব?", keep: "মনত ৰাখিব", youtube: "YouTube খোলক", live: "মোৰ খেতিৰ বৰ্তমান অৱস্থা" },
  or: { nav: "ବୁଝନ୍ତୁ ଓ କରନ୍ତୁ", eyebrow: "ଚାଷୀ ଗାଇଡ୍ · ସରଳ ବ୍ୟାଖ୍ୟା", hero: "ବୁଝନ୍ତୁ → ଯାଞ୍ଚ କରନ୍ତୁ → ଠିକ୍ ପଦକ୍ଷେପ ନିଅନ୍ତୁ", intro: "Sensor ରିଡିଂ ବୁଝି ପାରୁନାହାନ୍ତି? ବିଷୟ ବାଛନ୍ତୁ ଏବଂ ସରଳ ଭାଷାରେ ଅର୍ଥ, କ୍ଷେତର ସ୍ଥିତି ଓ ପରବର୍ତ୍ତୀ ପଦକ୍ଷେପ ଜାଣନ୍ତୁ।", offline: "ମୂଳ ଗାଇଡ୍ ଅଫଲାଇନ୍‌ରେ ମଧ୍ୟ କାମ କରେ", inLanguage: "ଆପଣଙ୍କ ଭାଷାରେ", listen: "ଶୁଣନ୍ତୁ", simple: "ସରଳ ଭାଷାରେ", why: "ଏହା କାହିଁକି ଜରୁରୀ?", now: "ଏବେ କଣ କରିବେ?", keep: "ମନେ ରଖନ୍ତୁ", youtube: "YouTube ଖୋଲନ୍ତୁ", live: "ମୋ କ୍ଷେତର ବର୍ତ୍ତମାନ ସ୍ଥିତି" },
  pa: { nav: "ਸਮਝੋ ਤੇ ਕਰੋ", eyebrow: "ਕਿਸਾਨ ਗਾਈਡ · ਸੌਖੀ ਜਾਣਕਾਰੀ", hero: "ਸਮਝੋ → ਜਾਂਚੋ → ਸਹੀ ਕਦਮ ਚੁੱਕੋ", intro: "Sensor ਦੀ reading ਸਮਝ ਨਹੀਂ ਆ ਰਹੀ? ਵਿਸ਼ਾ ਚੁਣੋ ਅਤੇ ਸੌਖੀ ਭਾਸ਼ਾ ਵਿੱਚ ਅਰਥ, ਖੇਤ ਦੀ ਸਥਿਤੀ ਅਤੇ ਅਗਲਾ ਕਦਮ ਜਾਣੋ।", offline: "ਮੁੱਢਲੀ ਗਾਈਡ ਆਫਲਾਈਨ ਵੀ ਕੰਮ ਕਰਦੀ ਹੈ", inLanguage: "ਤੁਹਾਡੀ ਭਾਸ਼ਾ ਵਿੱਚ", listen: "ਸੁਣੋ", simple: "ਸੌਖੀ ਭਾਸ਼ਾ ਵਿੱਚ", why: "ਇਹ ਕਿਉਂ ਜ਼ਰੂਰੀ ਹੈ?", now: "ਹੁਣ ਕੀ ਕਰਨਾ ਹੈ?", keep: "ਯਾਦ ਰੱਖੋ", youtube: "YouTube ਖੋਲ੍ਹੋ", live: "ਮੇਰੇ ਖੇਤ ਦੀ ਮੌਜੂਦਾ ਸਥਿਤੀ" },
  ta: { nav: "புரிந்து செய்து பாருங்கள்", eyebrow: "விவசாயி வழிகாட்டி · எளிய விளக்கம்", hero: "புரிந்துகொள் → சரிபார் → சரியான செயலை செய்", intro: "Sensor அளவை புரிந்துகொள்ள முடியவில்லையா? ஒரு தலைப்பைத் தேர்ந்தெடுத்து எளிய விளக்கம் மற்றும் அடுத்த படியை அறியுங்கள்.", offline: "அடிப்படை வழிகாட்டி ஆஃப்லைனிலும் செயல்படும்", inLanguage: "உங்கள் மொழியில்", listen: "கேளுங்கள்", simple: "எளிய மொழியில்", why: "இது ஏன் முக்கியம்?", now: "இப்போது என்ன செய்ய வேண்டும்?", keep: "நினைவில் கொள்ளுங்கள்", youtube: "YouTube திறக்கவும்", live: "என் வயலின் தற்போதைய நிலை" },
  te: { nav: "అర్థం చేసుకుని చేయండి", eyebrow: "రైతు గైడ్ · సులభమైన వివరణ", hero: "అర్థం చేసుకోండి → తనిఖీ చేయండి → సరైన చర్య తీసుకోండి", intro: "Sensor రీడింగ్ అర్థం కావడం లేదా? విషయం ఎంచుకుని సులభమైన భాషలో అర్థం, పొలం పరిస్థితి మరియు తదుపరి చర్య తెలుసుకోండి.", offline: "ప్రాథమిక గైడ్ ఆఫ్‌లైన్‌లో కూడా పనిచేస్తుంది", inLanguage: "మీ భాషలో", listen: "వినండి", simple: "సులభమైన భాషలో", why: "ఇది ఎందుకు ముఖ్యం?", now: "ఇప్పుడు ఏమి చేయాలి?", keep: "గుర్తుంచుకోండి", youtube: "YouTube తెరవండి", live: "నా పొలం ప్రస్తుత పరిస్థితి" },
  kn: { nav: "ಅರ್ಥಮಾಡಿಕೊಂಡು ಮಾಡಿ", eyebrow: "ರೈತ ಮಾರ್ಗದರ್ಶಿ · ಸರಳ ವಿವರಣೆ", hero: "ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ → ಪರಿಶೀಲಿಸಿ → ಸರಿಯಾದ ಕ್ರಮ ಕೈಗೊಳ್ಳಿ", intro: "Sensor ರೀಡಿಂಗ್ ಅರ್ಥವಾಗುತ್ತಿಲ್ಲವೇ? ವಿಷಯ ಆಯ್ಕೆ ಮಾಡಿ ಸರಳ ಭಾಷೆಯಲ್ಲಿ ಅರ್ಥ, ಹೊಲದ ಸ್ಥಿತಿ ಮತ್ತು ಮುಂದಿನ ಕ್ರಮ ತಿಳಿಯಿರಿ.", offline: "ಮೂಲ ಮಾರ್ಗದರ್ಶಿ ಆಫ್‌ಲೈನ್‌ನಲ್ಲೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ", inLanguage: "ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ", listen: "ಕೇಳಿ", simple: "ಸರಳ ಭಾಷೆಯಲ್ಲಿ", why: "ಇದು ಏಕೆ ಮುಖ್ಯ?", now: "ಈಗ ಏನು ಮಾಡಬೇಕು?", keep: "ಗಮನದಲ್ಲಿಡಿ", youtube: "YouTube ತೆರೆಯಿರಿ", live: "ನನ್ನ ಹೊಲದ ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ" },
  ml: { nav: "മനസ്സിലാക്കി ചെയ്യാം", eyebrow: "കർഷക ഗൈഡ് · ലളിതമായ വിശദീകരണം", hero: "മനസ്സിലാക്കുക → പരിശോധിക്കുക → ശരിയായ നടപടി എടുക്കുക", intro: "Sensor റീഡിംഗ് മനസ്സിലാകുന്നില്ലേ? വിഷയം തിരഞ്ഞെടുത്ത് ലളിതമായ ഭാഷയിൽ അർത്ഥവും അടുത്ത നടപടിയും അറിയുക.", offline: "അടിസ്ഥാന ഗൈഡ് ഓഫ്‌ലൈനിലും പ്രവർത്തിക്കും", inLanguage: "നിങ്ങളുടെ ഭാഷയിൽ", listen: "കേൾക്കുക", simple: "ലളിതമായ ഭാഷയിൽ", why: "ഇത് എന്തുകൊണ്ട് പ്രധാനമാണ്?", now: "ഇപ്പോൾ എന്ത് ചെയ്യണം?", keep: "ഓർമ്മിക്കുക", youtube: "YouTube തുറക്കുക", live: "എന്റെ വയലിന്റെ ഇപ്പോഴത്തെ സ്ഥിതി" },
  ur: { nav: "سمجھیں اور کریں", eyebrow: "کسان گائیڈ · آسان وضاحت", hero: "سمجھیں → جانچیں → درست قدم اٹھائیں", intro: "Sensor کی ریڈنگ سمجھ نہیں آ رہی؟ موضوع منتخب کریں اور آسان زبان میں مطلب، کھیت کی حالت اور اگلا قدم جانیں۔", offline: "بنیادی گائیڈ آف لائن بھی کام کرتی ہے", inLanguage: "آپ کی زبان میں", listen: "سنیں", simple: "آسان زبان میں", why: "یہ کیوں ضروری ہے؟", now: "اب کیا کرنا ہے؟", keep: "یاد رکھیں", youtube: "YouTube کھولیں", live: "میرے کھیت کی موجودہ حالت" },
  ne: { nav: "बुझ्नुहोस् र गर्नुहोस्", eyebrow: "किसान गाइड · सजिलो व्याख्या", hero: "बुझ्नुहोस् → जाँच्नुहोस् → सही कदम चाल्नुहोस्", intro: "Sensor को रिडिङ बुझ्न गाह्रो छ? विषय छानेर सजिलो भाषामा अर्थ, खेतको अवस्था र अर्को कदम जान्नुहोस्।", offline: "आधारभूत गाइड अफलाइनमा पनि चल्छ", inLanguage: "तपाईंको भाषामा", listen: "सुन्नुहोस्", simple: "सजिलो भाषामा", why: "यो किन महत्त्वपूर्ण छ?", now: "अहिले के गर्ने?", keep: "ध्यान दिनुहोस्", youtube: "YouTube खोल्नुहोस्", live: "मेरो खेतको अहिलेको अवस्था" },
  kok: { nav: "समजून घेवप आनी करात", eyebrow: "शेतकरी मार्गदर्शक · सोपी माहिती", hero: "समजून घेवप → तपासात → योग्य कृती करात", intro: "Sensor ची रीडिंग समजना? विषय निवडात आनी सोप्या भाशेंत अर्थ, शेताची स्थिती आनी फुडली कृती जाणून घेवात.", offline: "मूळ मार्गदर्शक ऑफलाइनय काम करता", inLanguage: "तुमच्या भाशेंत", listen: "आयकात", simple: "सोप्या भाशेंत", why: "हें कितें महत्वाचें?", now: "आता कितें करप?", keep: "लक्षांत दवरात", youtube: "YouTube उगडात", live: "म्हज्या शेताची सद्य स्थिती" },
  mai: { nav: "बुझू आ काज करू", eyebrow: "किसान गाइड · सरल जानकारी", hero: "बुझू → जाँचू → सही कदम उठाउ", intro: "Sensor के रीडिंग बुझाइत नहि? विषय चुनू आ सरल भाषा मे अर्थ, खेतक स्थिति आ अगिला कदम जानू।", offline: "मूल गाइड ऑफलाइन सेहो चलैत अछि", inLanguage: "अहाँक भाषामे", listen: "सुनू", simple: "सरल भाषामे", why: "ई किएक जरूरी अछि?", now: "आब की करू?", keep: "ध्यान राखू", youtube: "YouTube खोलू", live: "हमर खेतक वर्तमान स्थिति" },
  bho: { nav: "समझीं आ करीं", eyebrow: "किसान गाइड · आसान जानकारी", hero: "समझीं → जांचीं → सही कदम उठाईं", intro: "Sensor के रीडिंग समझ में ना आवत बा? विषय चुनीं आ आसान भाषा में मतलब, खेत के हालत आ अगिला कदम जानीं।", offline: "बेसिक गाइड ऑफलाइन भी चलेला", inLanguage: "रउरा भाषा में", listen: "सुनीं", simple: "आसान भाषा में", why: "ई काहे जरूरी बा?", now: "अब का करीं?", keep: "ध्यान रखीं", youtube: "YouTube खोलीं", live: "हमार खेत के अभी के हालत" },
  sa: { nav: "अवगच्छन्तु कुर्वन्तु च", eyebrow: "कृषकमार्गदर्शिका · सरलविवरणम्", hero: "अवगच्छन्तु → परीक्षन्तु → उचितं कर्म कुर्वन्तु", intro: "Sensor मापनं न अवगतम्? विषयं चित्वा सरलभाषया अर्थं क्षेत्रस्थितिं च आगामीं क्रियाम् अवगच्छन्तु।", offline: "मूलमार्गदर्शिका अफलाइन अपि कार्यं करोति", inLanguage: "भवतः भाषायाम्", listen: "शृणुत", simple: "सरलभाषया", why: "किमर्थम् एतत् महत्त्वपूर्णम्?", now: "इदानीं किं करणीयम्?", keep: "स्मरन्तु", youtube: "YouTube उद्घाटयन्तु", live: "मम क्षेत्रस्य वर्तमानस्थितिः" },
  hne: { nav: "समझो अउ करो", eyebrow: "किसान गाइड · आसान समझ", hero: "समझो → जांचो → सही कदम उठाओ", intro: "Sensor के नंबर समझ नई आवत? विषय चुनव अउ आसान भाषा मं मतलब, खेत के हालत अउ अगला कदम जानव।", offline: "बेसिक गाइड ऑफलाइन घलो चलथे", inLanguage: "तुमर भाषा मं", listen: "सुनव", simple: "आसान भाषा मं", why: "ये काबर जरूरी हे?", now: "अब का करव?", keep: "ध्यान रखव", youtube: "YouTube खोलव", live: "मोरे खेत के अभी के हालत" },
  raj: { nav: "समझो अर करो", eyebrow: "किसान गाइड · आसान समझ", hero: "समझो → जाँचो → सही कदम उठाओ", intro: "Sensor री रीडिंग समझ में कोनी आवे? विषय चुनो अर आसान भाषा में मतलब, खेत री हालत अर अगलो कदम जाणो।", offline: "बेसिक गाइड ऑफलाइन भी चालै", inLanguage: "थारी भाषा में", listen: "सुणो", simple: "आसान भाषा में", why: "यो क्यूं जरूरी है?", now: "अब के करनो है?", keep: "ध्यान राखो", youtube: "YouTube खोलो", live: "म्हारे खेत री हाल री हालत" },
  bgc: { nav: "समझो अर करो", eyebrow: "किसान गाइड · आसान समझ", hero: "समझो → जांचो → सही कदम उठाओ", intro: "Sensor की reading समझ ना आवै? विषय चुनो अर आसान भाषा मैं मतलब, खेत की हालत अर अगला कदम जानो।", offline: "बेसिक गाइड ऑफलाइन भी चलै सै", inLanguage: "अपनी भाषा मैं", listen: "सुणो", simple: "आसान भाषा मैं", why: "यो क्यूं जरूरी सै?", now: "अब के करना सै?", keep: "ध्यान राखो", youtube: "YouTube खोलो", live: "मेरे खेत की अभी की हालत" },
};

const guideLabel = (locale: LocaleCode) => guideUi[locale] ?? guideUi.en;

const nav: Array<{
  id: ViewKey;
  key?: CopyKey;
  label?: string;
  icon: typeof Activity;
}> = [
  { id: "dashboard", key: "dashboard", icon: Activity },
  { id: "farm", key: "farm", icon: MapPinned },
  { id: "heat", label: "Heat stress", icon: ThermometerSun },
  { id: "weather", label: "Early warning", icon: CloudSun },
  { id: "safety", key: "safety", icon: ShieldCheck },
  { id: "devices", label: "Hardware status", icon: RadioTower },
  { id: "profile", key: "profile", icon: CircleUserRound },
];

type SabhaIntent = "spray" | "zone" | "pest" | "market" | "scheme";

function windDirectionLabel(degrees: number) {
  const labels = ["N · North", "NE · North-east", "E · East", "SE · South-east", "S · South", "SW · South-west", "W · West", "NW · North-west"];
  return labels[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}

// NOAA/NWS apparent-temperature method. Below its valid hot-weather range,
// air temperature is returned so the dashboard does not exaggerate heat.
function heatIndexCelsius(temperatureC: number, humidity: number) {
  const temperatureF = temperatureC * 9 / 5 + 32;
  const simple = 0.5 * (temperatureF + 61 + (temperatureF - 68) * 1.2 + humidity * 0.094);
  const averaged = (simple + temperatureF) / 2;
  if (averaged < 80) return temperatureC;

  let index = -42.379
    + 2.04901523 * temperatureF
    + 10.14333127 * humidity
    - 0.22475541 * temperatureF * humidity
    - 0.00683783 * temperatureF * temperatureF
    - 0.05481717 * humidity * humidity
    + 0.00122874 * temperatureF * temperatureF * humidity
    + 0.00085282 * temperatureF * humidity * humidity
    - 0.00000199 * temperatureF * temperatureF * humidity * humidity;

  if (humidity < 13 && temperatureF >= 80 && temperatureF <= 112) {
    index -= ((13 - humidity) / 4) * Math.sqrt((17 - Math.abs(temperatureF - 95)) / 17);
  } else if (humidity > 85 && temperatureF >= 80 && temperatureF <= 87) {
    index += ((humidity - 85) / 10) * ((87 - temperatureF) / 5);
  }
  return (index - 32) * 5 / 9;
}

function intentFromQuestion(question: string): SabhaIntent {
  const text = question.toLocaleLowerCase();
  if (/insect|pest|bug|whitefly|कीट|किड|कीड़ा/.test(text)) return "pest";
  if (/price|sell|market|mandi|auction|भाव|बेच|बाजार/.test(text))
    return "market";
  if (/scheme|subsidy|yojana|योजना|अनुदान/.test(text)) return "scheme";
  if (/water|soil|zone|irrigat|नमी|पानी|सिंचाई|खेत/.test(text))
    return "zone";
  return "spray";
}


type GuideTopic = "humidity" | "temperature" | "rainfall" | "wind" | "light" | "soil" | "spray" | "pest";
type GuideCopy = { title: string; simple: string; why: string; steps: string[]; avoid: string; search: string };

const guideContent: Record<GuideTopic, GuideCopy> = {
  humidity: {
    title: "Humidity · moisture in the air",
    simple: "Humidity tells you how much water vapour is in the air. High humidity can keep leaves wet for longer and may increase some disease risks.",
    why: "It can affect disease pressure and how quickly a spray dries.",
    steps: ["Check today's humidity and compare it with recent readings.", "When humidity is very high, check leaf wetness and airflow in the field.", "If you see disease symptoms, inspect both sides of the leaves."],
    avoid: "Do not choose a pesticide or fungicide from humidity alone. Also consider crop stage and field symptoms.",
    search: "humidity farming crop disease management explained",
  },
  temperature: {
    title: "Temperature · how hot is the field",
    simple: "Temperature tells you how hot the field is. Very high heat can increase water loss and cause heat stress.",
    why: "Heat stress can change irrigation timing and the need for field inspection.",
    steps: ["Compare the reading with morning and afternoon values.", "When it is very hot, check soil moisture as well.", "If leaves wilt or edges look burnt, inspect the crop."],
    avoid: "Do not add extra irrigation from temperature alone. Check soil moisture and crop stage too.",
    search: "heat stress crops temperature farming management",
  },
  rainfall: {
    title: "Rainfall · how much rain is falling",
    simple: "Rainfall shows how much rain is reaching the field. Heavy rain can cause waterlogging, nutrient loss and spray wash-off.",
    why: "Rain can change both irrigation and spraying decisions.",
    steps: ["Check the rain-gauge reading.", "If heavy rain is warned, stop spraying.", "After rain, check drainage and standing water in the field."],
    avoid: "Do not start irrigation immediately after rain. Check soil moisture and drainage first.",
    search: "heavy rainfall crop management waterlogging farming",
  },
  wind: {
    title: "Wind · speed and direction",
    simple: "Wind speed tells you how fast the air is moving and wind direction tells you where it is going.",
    why: "Strong wind can cause spray drift toward another crop, person or nearby area.",
    steps: ["Check Spray Safety before spraying.", "If the wind threshold is crossed, follow the spray lock.", "Use wind direction to check nearby crops and people."],
    avoid: "Do not spray in strong wind and try to fix the problem later. Wait for a safe window.",
    search: "wind speed spray drift safe spraying agriculture",
  },
  light: {
    title: "Light · how much sunlight is available",
    simple: "Light intensity shows how much light reaches the field. Sunlight affects crop growth, evaporation and field temperature.",
    why: "Light helps explain why a crop may heat up or lose water faster.",
    steps: ["Check light together with temperature and soil moisture.", "In very strong sunlight, inspect young or sensitive plants.", "Use the trend rather than one reading alone."],
    avoid: "Do not decide irrigation or spraying from one light reading alone.",
    search: "light intensity crop growth farming explained",
  },
  soil: {
    title: "Soil moisture · water available to the crop",
    simple: "Soil moisture shows how much water is available around the crop roots.",
    why: "It helps you irrigate according to field need and avoid wasting water.",
    steps: ["Compare the reading with your crop and soil type.", "When moisture is low, check the crop and irrigation system.", "When moisture is very high, check drainage and waterlogging."],
    avoid: "Do not water only because a fixed schedule says so if the soil is already wet.",
    search: "soil moisture irrigation management farmers",
  },
  spray: {
    title: "Spray Safety · when spraying is safer",
    simple: "Spray Safety combines field wind, rain and humidity conditions to tell you whether spraying should continue or wait.",
    why: "Poor conditions can cause drift, wash-off and lower effectiveness.",
    steps: ["Check the Spray Safety status.", "Stop when high wind or rain is warned.", "Check wind direction and nearby field conditions.", "Spray only in a safe window and follow the approved product label."],
    avoid: "This guide does not replace the pesticide label or local agriculture advice.",
    search: "safe pesticide spraying wind rain agriculture",
  },
  pest: {
    title: "Pest Guard · understand the insect warning",
    simple: "Pest Guard uses crop and field signals to highlight a possible pest risk so you can inspect the field early.",
    why: "Early inspection can reduce unnecessary spraying and help you act before damage spreads.",
    steps: ["Open the alert and check the crop and zone.", "Inspect the upper and lower sides of leaves.", "Verify the insect or trap count before treatment.", "Ask an agriculture expert or follow approved label guidance before choosing treatment."],
    avoid: "Do not treat a model alert as a final diagnosis. Verify the insect and crop damage in the field.",
    search: "crop pest identification integrated pest management farmers",
  },
};

// Farmer-guide copy is local and offline. The main dashboard already has 21 language packs;
// these dedicated packs prevent the guide from falling back to hard-coded Hindi.
const guideLocalized: Partial<Record<LocaleCode, Record<GuideTopic, GuideCopy>>> = {
  hi: {
    humidity: { title: "नमी · हवा में कितनी नमी है", simple: "नमी बताती है कि हवा में पानी की भाप कितनी है। ज्यादा नमी में पत्तियां देर तक गीली रह सकती हैं और कुछ रोगों का खतरा बढ़ सकता है।", why: "यह रोग का खतरा और छिड़काव के सूखने का समय प्रभावित कर सकती है।", steps: ["आज की नमी को हाल की रीडिंग से मिलाएं।", "बहुत ज्यादा नमी में पत्तियों की नमी और खेत में हवा का बहाव देखें।", "रोग के लक्षण दिखें तो पत्तियों के ऊपर और नीचे दोनों तरफ जांचें।"], avoid: "सिर्फ नमी देखकर दवा न चुनें। फसल की अवस्था और खेत के लक्षण भी देखें।", search: "humidity farming crop disease management Hindi" },
    temperature: { title: "तापमान · खेत कितना गर्म है", simple: "तापमान बताता है कि खेत में कितनी गर्मी है। बहुत ज्यादा गर्मी से पानी की कमी और हीट स्ट्रेस हो सकता है।", why: "हीट स्ट्रेस में सिंचाई का समय और खेत की जांच बदल सकती है।", steps: ["सुबह और दोपहर की रीडिंग से तुलना करें।", "बहुत गर्मी में मिट्टी की नमी भी देखें।", "पत्तियां मुरझाएं या किनारे जलें तो फसल जांचें।"], avoid: "सिर्फ तापमान देखकर अतिरिक्त पानी न दें। मिट्टी की नमी और फसल की अवस्था भी देखें।", search: "heat stress crops temperature farming Hindi" },
    rainfall: { title: "बारिश · कितनी बारिश हो रही है", simple: "बारिश बताती है कि खेत में कितनी वर्षा हो रही है। तेज बारिश से पानी भर सकता है और छिड़काव धुल सकता है।", why: "बारिश सिंचाई और छिड़काव दोनों के फैसले बदल सकती है।", steps: ["रेन गेज की रीडिंग देखें।", "तेज बारिश की चेतावनी में छिड़काव रोकें।", "बारिश के बाद खेत में पानी और निकासी देखें।"], avoid: "बारिश के तुरंत बाद सिंचाई शुरू न करें। पहले मिट्टी की नमी और निकासी देखें।", search: "heavy rainfall crop management Hindi" },
    wind: { title: "हवा · गति और दिशा", simple: "हवा की गति बताती है कि हवा कितनी तेज है और दिशा बताती है कि वह किस तरफ जा रही है।", why: "तेज हवा में छिड़काव की बूंदें दूसरी फसल या व्यक्ति तक जा सकती हैं।", steps: ["छिड़काव से पहले Spray Safety देखें।", "हवा की सीमा पार हो तो spray lock का पालन करें।", "हवा की दिशा देखकर आसपास की फसल और लोगों को देखें।"], avoid: "तेज हवा में छिड़काव करके बाद में समस्या ठीक करने की कोशिश न करें। सुरक्षित समय का इंतजार करें।", search: "wind speed spray drift agriculture Hindi" },
    light: { title: "रोशनी · धूप कितनी है", simple: "रोशनी खेत तक पहुंचने वाली धूप की मात्रा बताती है। इससे फसल की बढ़त, पानी का वाष्पीकरण और तापमान प्रभावित होता है।", why: "रोशनी से समझ आता है कि फसल गर्म क्यों हो रही है या पानी जल्दी क्यों घट रहा है।", steps: ["रोशनी को तापमान और मिट्टी की नमी के साथ देखें।", "बहुत तेज धूप में नई या संवेदनशील फसल जांचें।", "एक रीडिंग के बजाय बदलाव की दिशा देखें।"], avoid: "सिर्फ एक light reading देखकर सिंचाई या छिड़काव का फैसला न लें।", search: "light intensity crop growth Hindi" },
    soil: { title: "मिट्टी की नमी · फसल के लिए उपलब्ध पानी", simple: "मिट्टी की नमी बताती है कि जड़ों के आसपास फसल के लिए कितना पानी उपलब्ध है।", why: "इससे जरूरत के अनुसार सिंचाई और पानी की बचत में मदद मिलती है।", steps: ["रीडिंग को अपनी फसल और मिट्टी के प्रकार से मिलाएं।", "नमी कम हो तो फसल और सिंचाई व्यवस्था देखें।", "नमी बहुत ज्यादा हो तो पानी निकासी और जलभराव देखें।"], avoid: "मिट्टी पहले से गीली हो तो केवल तय समय के कारण पानी न दें।", search: "soil moisture irrigation Hindi" },
    spray: { title: "छिड़काव सुरक्षा · कब छिड़काव सुरक्षित है", simple: "Spray Safety हवा, बारिश और नमी जैसी खेत की स्थितियों को देखकर बताती है कि छिड़काव जारी रखना चाहिए या रुकना चाहिए।", why: "गलत मौसम में छिड़काव फैल सकता है, धुल सकता है और कम असर कर सकता है।", steps: ["Spray Safety स्थिति देखें।", "तेज हवा या बारिश की चेतावनी में रुकें।", "हवा की दिशा और आसपास के खेत देखें।", "सुरक्षित समय में ही approved label के अनुसार छिड़काव करें।"], avoid: "यह गाइड pesticide label या स्थानीय कृषि सलाह का विकल्प नहीं है।", search: "safe pesticide spraying Hindi" },
    pest: { title: "कीट गार्ड · कीट की चेतावनी समझें", simple: "Pest Guard फसल और खेत के संकेतों से संभावित कीट खतरा बताता है ताकि आप जल्दी खेत की जांच कर सकें।", why: "जल्दी जांच से अनावश्यक छिड़काव कम हो सकता है और नुकसान फैलने से पहले कदम उठाया जा सकता है।", steps: ["अलर्ट में फसल और zone देखें।", "पत्तियों के ऊपर और नीचे जांचें।", "उपचार से पहले कीट या trap count की पुष्टि करें।", "उपचार चुनने से पहले कृषि विशेषज्ञ या approved label guidance देखें।"], avoid: "Model alert को अंतिम diagnosis न मानें। खेत में कीट और नुकसान की पुष्टि करें।", search: "crop pest identification Hindi" },
  },
};

const guideTopicNames: Record<LocaleCode, Record<GuideTopic, string>> = {
  en: { humidity: "Humidity", temperature: "Temperature", rainfall: "Rainfall", wind: "Wind", light: "Light", soil: "Soil moisture", spray: "Spray safety", pest: "Pest warning" },
  hi: { humidity: "नमी", temperature: "तापमान", rainfall: "बारिश", wind: "हवा", light: "रोशनी", soil: "मिट्टी की नमी", spray: "छिड़काव सुरक्षा", pest: "कीट चेतावनी" },
  mr: { humidity: "आर्द्रता", temperature: "तापमान", rainfall: "पाऊस", wind: "वारा", light: "प्रकाश", soil: "मातीतील ओलावा", spray: "फवारणी सुरक्षा", pest: "किडीची सूचना" },
  gu: { humidity: "ભેજ", temperature: "તાપમાન", rainfall: "વરસાદ", wind: "પવન", light: "પ્રકાશ", soil: "માટીની ભેજ", spray: "છંટકાવ સુરક્ષા", pest: "જીવાત ચેતવણી" },
  bn: { humidity: "আর্দ্রতা", temperature: "তাপমাত্রা", rainfall: "বৃষ্টিপাত", wind: "বাতাস", light: "আলো", soil: "মাটির আর্দ্রতা", spray: "স্প্রে নিরাপত্তা", pest: "পোকার সতর্কতা" },
  as: { humidity: "আর্দ্ৰতা", temperature: "উষ্ণতা", rainfall: "বৰষুণ", wind: "বতাহ", light: "পোহৰ", soil: "মাটিৰ আৰ্দ্ৰতা", spray: "স্প্ৰে সুৰক্ষা", pest: "পোকৰ সতৰ্কতা" },
  or: { humidity: "ଆର୍ଦ୍ରତା", temperature: "ତାପମାତ୍ରା", rainfall: "ବର୍ଷା", wind: "ପବନ", light: "ଆଲୋକ", soil: "ମାଟିର ଆର୍ଦ୍ରତା", spray: "ସ୍ପ୍ରେ ସୁରକ୍ଷା", pest: "କୀଟ ସତର୍କତା" },
  pa: { humidity: "ਨਮੀ", temperature: "ਤਾਪਮਾਨ", rainfall: "ਮੀਂਹ", wind: "ਹਵਾ", light: "ਰੋਸ਼ਨੀ", soil: "ਮਿੱਟੀ ਦੀ ਨਮੀ", spray: "ਛਿੜਕਾਅ ਸੁਰੱਖਿਆ", pest: "ਕੀੜੇ ਦੀ ਚੇਤਾਵਨੀ" },
  ta: { humidity: "ஈரப்பதம்", temperature: "வெப்பநிலை", rainfall: "மழை", wind: "காற்று", light: "ஒளி", soil: "மண் ஈரப்பதம்", spray: "தெளிப்பு பாதுகாப்பு", pest: "பூச்சி எச்சரிக்கை" },
  te: { humidity: "తేమ", temperature: "ఉష్ణోగ్రత", rainfall: "వర్షపాతం", wind: "గాలి", light: "కాంతి", soil: "మట్టి తేమ", spray: "స్ప్రే భద్రత", pest: "పురుగు హెచ్చరిక" },
  kn: { humidity: "ಆರ್ದ್ರತೆ", temperature: "ತಾಪಮಾನ", rainfall: "ಮಳೆ", wind: "ಗಾಳಿ", light: "ಬೆಳಕು", soil: "ಮಣ್ಣಿನ ತೇವಾಂಶ", spray: "ಸ್ಪ್ರೇ ಸುರಕ್ಷತೆ", pest: "ಕೀಟ ಎಚ್ಚರಿಕೆ" },
  ml: { humidity: "ഈർപ്പം", temperature: "താപനില", rainfall: "മഴ", wind: "കാറ്റ്", light: "വെളിച്ചം", soil: "മണ്ണിലെ ഈർപ്പം", spray: "സ്പ്രേ സുരക്ഷ", pest: "കീട മുന്നറിയിപ്പ്" },
  ur: { humidity: "نمی", temperature: "درجہ حرارت", rainfall: "بارش", wind: "ہوا", light: "روشنی", soil: "مٹی کی نمی", spray: "اسپرے کی حفاظت", pest: "کیڑے کی وارننگ" },
  ne: { humidity: "आर्द्रता", temperature: "तापक्रम", rainfall: "वर्षा", wind: "हावा", light: "प्रकाश", soil: "माटोको चिस्यान", spray: "छर्काइ सुरक्षा", pest: "कीरा चेतावनी" },
  kok: { humidity: "ओलावो", temperature: "तापमान", rainfall: "पावस", wind: "वारो", light: "उजवाड", soil: "मातीचो ओलावो", spray: "फवारणी सुरक्षा", pest: "किड्याची सुचोवणी" },
  mai: { humidity: "नमी", temperature: "तापमान", rainfall: "वर्षा", wind: "हवा", light: "रोशनी", soil: "माटिक नमी", spray: "छिड़काव सुरक्षा", pest: "कीड़ा चेतावनी" },
  bho: { humidity: "नमी", temperature: "तापमान", rainfall: "बरखा", wind: "हवा", light: "रोशनी", soil: "माटी के नमी", spray: "छिड़काव सुरक्षा", pest: "कीड़ा चेतावनी" },
  sa: { humidity: "आर्द्रता", temperature: "तापमानम्", rainfall: "वृष्टिः", wind: "वायुः", light: "प्रकाशः", soil: "मृद्रार्द्रता", spray: "प्रक्षेपणसुरक्षा", pest: "कीटसूचना" },
  hne: { humidity: "नमी", temperature: "तापमान", rainfall: "पानी/बरखा", wind: "हवा", light: "रोशनी", soil: "माटी के नमी", spray: "छिड़काव सुरक्षा", pest: "कीरा चेतावनी" },
  raj: { humidity: "नमी", temperature: "तापमान", rainfall: "बरसात", wind: "हवा", light: "रोशनी", soil: "माटी री नमी", spray: "छिड़काव सुरक्षा", pest: "कीड़ा चेतावणी" },
  bgc: { humidity: "नमी", temperature: "तापमान", rainfall: "बरसात", wind: "हवा", light: "रोशनी", soil: "माटी की नमी", spray: "छिड़काव सुरक्षा", pest: "कीड़ा चेतावनी" },
};

function getGuideContent(locale: LocaleCode, topic: GuideTopic): GuideCopy {
  if (guideLocalized[locale]?.[topic]) return guideLocalized[locale]![topic];
  const base = guideContent[topic];
  const name = guideTopicNames[locale]?.[topic] ?? guideTopicNames.en[topic];
  const ui = guideUi[locale] ?? guideUi.en;
  // For locales without a full long-form pack, keep the explanation language-aware
  // instead of falling back to Hindi. The detailed English copy remains the safety
  // reference, while the selected-language topic and action framing stay local/offline.
  return {
    ...base,
    title: `${name} · ${ui.simple}`,
    simple: `${name}: ${base.simple}`,
    why: `${ui.why} ${name}.`,
    steps: base.steps.map((step, index) => `${index + 1}. ${step}`),
    avoid: `${ui.keep}: ${base.avoid}`,
  };
}

function recommendedGuide(r: Telemetry, spray: Decision, pest: PestDetection): GuideTopic {
  if (pest.harmful) return "pest";
  if (!spray.spray_allowed || r.wind_speed_kmh > 15) return "spray";
  if (r.rainfall_mm_h > 2) return "rainfall";
  if (r.temperature_c > 35) return "temperature";
  if (r.soil_moisture_pct < 30) return "soil";
  if (r.humidity_pct > 80) return "humidity";
  return "wind";
}

function zonesFor(r: Telemetry): Zone[] {
  return [
    {
      id: "ACR-Z01",
      name: "Demo plot · sensor station",
      soil_type: "Field observation area",
      crop: "Wheat / Rice / Soybean demo",
      area_acres: 0.25,
      moisture: r.zone_id === "ACR-Z01" ? r.soil_moisture_pct : 0,
      health: r.zone_id === "ACR-Z01" ? "good" : "watch",
      polygon: [
        [0.0004, -0.0005], [0.0004, 0], [0, 0], [0, -0.0005],
      ],
    },
    {
      id: "ACR-Z02",
      name: "East monitoring area",
      soil_type: "Additional node location",
      crop: "Wheat / Rice / Soybean demo",
      area_acres: 0.25,
      moisture: r.zone_id === "ACR-Z02" ? r.soil_moisture_pct : 0,
      health: r.zone_id === "ACR-Z02" ? "good" : "watch",
      polygon: [
        [0.0004, 0.0005], [0.0004, 0.001], [0, 0.001], [0, 0.0005],
      ],
    },
    {
      id: "ACR-Z03",
      name: "South monitoring area",
      soil_type: "Additional node location",
      crop: "Wheat / Rice / Soybean demo",
      area_acres: 0.25,
      moisture: r.zone_id === "ACR-Z03" ? r.soil_moisture_pct : 0,
      health: r.zone_id === "ACR-Z03" ? "good" : "watch",
      polygon: [
        [-0.0004, -0.0005], [-0.0004, 0], [-0.0008, 0], [-0.0008, -0.0005],
      ],
    },
  ];
}

function StatusChip({
  source,
  online,
  t,
}: {
  source: Telemetry["source"] | undefined;
  online: boolean;
  t: (k: CopyKey) => string;
}) {
  const safeSource: Telemetry["source"] = source ?? "cached";
  return (
    <span className={`source-chip ${safeSource}`}>
      <span />
      {online
        ? safeSource === "live" || safeSource === "ble"
          ? t("live")
          : t("workingOffline")
        : t("workingOffline")}
    </span>
  );
}
function SensorCard({
  icon: Icon,
  label,
  value,
  unit,
  note,
  risk,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  unit: string;
  note: string;
  risk?: boolean;
}) {
  return (
    <article className={`sensor-card ${risk ? "risk" : ""}`}>
      <div className="sensor-head">
        <span>
          <Icon size={17} />
        </span>
        <em>{note}</em>
      </div>
      <p>{label}</p>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      <div className="mini-track">
        <i
          style={{
            width: `${Math.min(96, Math.max(12, Number(value) || 50))}%`,
          }}
        />
      </div>
    </article>
  );
}

function readableLabel(value: unknown, fallback = "Unknown") {
  return typeof value === "string" && value.trim()
    ? value.replaceAll("_", " ")
    : fallback;
}

function readableDate(value: unknown) {
  const date = new Date(typeof value === "string" ? value : "");
  return Number.isNaN(date.getTime())
    ? "Closing time pending"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function ProfileForm({
  initial,
  locale,
  onDone,
}: {
  initial: FarmerProfile;
  locale: LocaleCode;
  onDone: (p: FarmerProfile) => void;
}) {
  const [form, setForm] = useState(initial);
  const t = (k: CopyKey) => translate(locale, k);
  const field = (k: keyof FarmerProfile, v: string | number | boolean) =>
    setForm((old) => ({ ...old, [k]: v }));
  return (
    <form
      className="profile-form official-farm-form"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(form);
      }}
    >
      <div className="form-document-head">
        <div>
          <span className="micro-label">FARMER &amp; FIELD REGISTRATION</span>
          <h2>Farm Decision Profile / खेत निर्णय प्रोफ़ाइल</h2>
          <p>
            These details are used only to improve field-specific alerts,
            learning guidance and crop decisions. KhetOS does not claim
            this is a government identity form.
          </p>
        </div>
        <span className="form-version">GC-FDP · 01</span>
      </div>

      <fieldset>
        <legend><span>01</span> Farmer &amp; contact details</legend>
        <div className="form-grid">
          <label>
            <span>Farmer name / किसान का नाम</span>
            <input required value={form.name} onChange={(e) => field("name", e.target.value)} />
          </label>
          <label>
            <span>Registered WhatsApp number</span>
            <input required minLength={10} inputMode="numeric" placeholder="10-digit mobile number" value={form.mobile} onChange={(e) => field("mobile", e.target.value)} />
          </label>
          <label>
            <span>Preferred alert language</span>
            <select value={form.alert_language || locale} onChange={(e) => field("alert_language", e.target.value)}>
              <option value="hi">Hindi</option><option value="mr">Marathi</option><option value="en">English</option>
              <option value="gu">Gujarati</option><option value="bn">Bengali</option><option value="ta">Tamil</option>
              <option value="te">Telugu</option><option value="kn">Kannada</option>
            </select>
          </label>
          <label className="form-consent">
            <span>Automatic field alerts</span>
            <div className="check-row">
              <input type="checkbox" checked={form.whatsapp_alert_consent !== false} onChange={(e) => field("whatsapp_alert_consent", e.target.checked)} />
              <b>Send harmful-pest and critical field alerts automatically to this number</b>
            </div>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend><span>02</span> Farm location &amp; physical conditions</legend>
        <div className="form-grid">
          <label><span>State</span><input required value={form.state} onChange={(e) => field("state", e.target.value)} /></label>
          <label><span>District</span><input required value={form.district} onChange={(e) => field("district", e.target.value)} /></label>
          <label><span>Village</span><input required value={form.village} onChange={(e) => field("village", e.target.value)} /></label>
          <label><span>Land area (acres)</span><input type="number" step=".1" min=".1" required value={form.land_acres} onChange={(e) => field("land_acres", Number(e.target.value))} /></label>
          <label>
            <span>Soil type</span>
            <select value={form.soil_type || ""} onChange={(e) => field("soil_type", e.target.value)}>
              <option value="">Select</option><option>Loamy</option><option>Sandy</option><option>Clay</option><option>Black soil</option><option>Red soil</option><option>Alluvial</option><option>Mixed / Unknown</option>
            </select>
          </label>
          <label>
            <span>Drainage condition</span>
            <select value={form.drainage || ""} onChange={(e) => field("drainage", e.target.value)}>
              <option value="">Select</option><option>Good</option><option>Moderate</option><option>Poor / waterlogging prone</option>
            </select>
          </label>
          <label>
            <span>Field slope</span>
            <select value={form.field_slope || ""} onChange={(e) => field("field_slope", e.target.value)}>
              <option value="">Select</option><option>Nearly level</option><option>Gentle slope</option><option>Steep / runoff prone</option>
            </select>
          </label>
          <label><span>Nearby sensitive area</span><input placeholder="School, house, water body, beehive, other crop…" value={form.nearby_sensitive_area || ""} onChange={(e) => field("nearby_sensitive_area", e.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend><span>03</span> Crop cycle</legend>
        <div className="form-grid">
          <label>
            <span>Primary crop</span>
            <select value={form.crop} onChange={(e) => field("crop", e.target.value)}>
              <option>Tomato</option><option>Onion</option><option>Wheat</option><option>Soybean</option><option>Cotton</option><option>Chilli</option>
            </select>
          </label>
          <label><span>Variety / hybrid</span><input placeholder="Example: Arka Rakshak" value={form.crop_variety || ""} onChange={(e) => field("crop_variety", e.target.value)} /></label>
          <label>
            <span>Growth stage</span>
            <select value={form.growth_stage} onChange={(e) => field("growth_stage", e.target.value)}>
              <option>Seedling</option><option>Vegetative</option><option>Flowering</option><option>Fruiting</option><option>Harvest</option>
            </select>
          </label>
          <label><span>Sowing / transplant date</span><input type="date" value={form.sowing_date || ""} onChange={(e) => field("sowing_date", e.target.value)} /></label>
          <label><span>Expected harvest date</span><input type="date" value={form.expected_harvest_date || ""} onChange={(e) => field("expected_harvest_date", e.target.value)} /></label>
          <label><span>Previous crop</span><input placeholder="Crop grown before this cycle" value={form.previous_crop || ""} onChange={(e) => field("previous_crop", e.target.value)} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend><span>04</span> Water, spray &amp; field history</legend>
        <div className="form-grid">
          <label>
            <span>Irrigation method</span>
            <select value={form.irrigation} onChange={(e) => field("irrigation", e.target.value)}>
              <option>Drip</option><option>Sprinkler</option><option>Flood</option><option>Rainfed</option>
            </select>
          </label>
          <label>
            <span>Water source</span>
            <select value={form.water_source || ""} onChange={(e) => field("water_source", e.target.value)}>
              <option value="">Select</option><option>Borewell</option><option>Well</option><option>Canal</option><option>Farm pond</option><option>River / stream</option><option>Rainfed</option><option>Other</option>
            </select>
          </label>
          <label><span>Last irrigation</span><input type="datetime-local" value={form.last_irrigation_date || ""} onChange={(e) => field("last_irrigation_date", e.target.value)} /></label>
          <label><span>Last spray</span><input type="datetime-local" value={form.last_spray_date || ""} onChange={(e) => field("last_spray_date", e.target.value)} /></label>
          <label><span>Last fertilizer application</span><input type="date" value={form.last_fertilizer_date || ""} onChange={(e) => field("last_fertilizer_date", e.target.value)} /></label>
          <label><span>Pest history this season</span><input placeholder="Whitefly, aphid, fruit borer…" value={form.pest_history || ""} onChange={(e) => field("pest_history", e.target.value)} /></label>
          <label><span>Disease / symptom history</span><input placeholder="Leaf curl, blight, wilting…" value={form.disease_history || ""} onChange={(e) => field("disease_history", e.target.value)} /></label>
          <label><span>Annual household income (₹)</span><input type="number" min="0" value={form.annual_income} onChange={(e) => field("annual_income", Number(e.target.value))} /></label>
        </div>
      </fieldset>

      <div className="form-declaration">
        <ShieldCheck size={18} />
        <p>
          Sensor recommendations will combine this profile with current
          temperature, humidity, rainfall, wind speed, wind direction, light,
          soil readings and recorded farmer actions. Critical spray decisions
          still follow the safety rule layer.
        </p>
      </div>
      <button className="solid-button form-submit" type="submit">
        {t("save")} · {t("continue")} <ChevronRight size={16} />
      </button>
    </form>
  );
}

export default function Dashboard({ onSignOut }: { onSignOut?: () => void }) {
  const [view, setView] = useState<ViewKey>("dashboard"),
    [locale, setLocale] = useState<LocaleCode>("en"),
    [theme, setTheme] = useState<"light" | "dark">("light"),
    [menu, setMenu] = useState(false),
    [online, setOnline] = useState(() =>
      typeof navigator === "undefined" ? true : navigator.onLine,
    ),
    [profile, setProfile] = useState<FarmerProfile | null>(null),
    [savedProfiles, setSavedProfiles] = useState<FarmerProfile[]>([]),
    [setupDraft, setSetupDraft] = useState<FarmerProfile | null>(null),
    [reading, setReading] = useState<Telemetry>(fallbackTelemetry()),
    [spray, setSpray] = useState<Decision>(fallbackDecision),
    [earlyWarning, setEarlyWarning] = useState<EarlyWarning>(fallbackEarlyWarning),
    [systemHealth, setSystemHealth] = useState<SystemStatus>(fallbackSystemStatus),
    [forecast, setForecast] = useState<WeatherForecast>(fallbackWeatherForecast),
    [demoBusy, setDemoBusy] = useState(""),
    [demoScenario, setDemoScenario] = useState<"normal" | "heat" | "rain" | "wind" | "spray-unsafe">("wind"),
    [demoAcknowledged, setDemoAcknowledged] = useState(false),
    [weatherJury, setWeatherJury] = useState<Jury>(fallbackJury),
    [schemes, setSchemes] = useState<SchemeMatch[]>(fallbackSchemes),
    [prices, setPrices] = useState<MarketPrice[]>(fallbackPrices),
    [showSetup, setShowSetup] = useState(false),
    [doneActions, setDoneActions] = useState<string[]>([]),
    [hydrated, setHydrated] = useState(false);
  const [pest, setPest] = useState<PestDetection>(fallbackPest),
    [pestLive, setPestLive] = useState<PestLiveStatus>(fallbackPestLive),
    [farmerActions, setFarmerActions] = useState<FarmerAction[]>([]),
    [actionSaving, setActionSaving] = useState(false),
    [notifications, setNotifications] = useState<NotificationItem[]>(
      fallbackNotifications,
    ),
    [notificationOpen, setNotificationOpen] = useState(false),
    [notificationsRead, setNotificationsRead] = useState(false),
    [auctions, setAuctions] = useState<Auction[]>(fallbackAuctions),
    [auctionOpen, setAuctionOpen] = useState(false),
    [auctionSaving, setAuctionSaving] = useState(false),
    [auctionMessage, setAuctionMessage] = useState(""),
    [auctionForm, setAuctionForm] = useState(() => ({
      quantity_kg: 500,
      reserve_price_per_kg: 20,
      closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16),
    })),
    [sabhaQuestion, setSabhaQuestion] = useState(""),
    [sabhaIntent, setSabhaIntent] = useState<SabhaIntent>("spray"),
    [sabhaAskedAt, setSabhaAskedAt] = useState(() => new Date()),
    [shareNotice, setShareNotice] = useState(""),
    [reportOpen, setReportOpen] = useState(false),
    [reportConsent, setReportConsent] = useState(false),
    [reportStatus, setReportStatus] = useState<
      "idle" | "verifying" | "verified" | "error"
    >("idle"),
    [guideTopic, setGuideTopic] = useState<GuideTopic>("humidity");
  const t = (k: CopyKey) => translate(locale, k),
    tr = (key: Parameters<typeof translatePhrase>[1]) =>
      translatePhrase(locale, key),
    term = (key: Parameters<typeof translateTerm>[1]) =>
      translateTerm(locale, key),
    currentLocale = localeByCode[locale],
    zones = useMemo(() => zonesFor(reading), [reading]);
  const sabhaPromptFor = (intent: SabhaIntent) =>
    ({
      spray: `${t("safety")} · ${t("wind")}?`,
      zone: `${t("zones")} · ${t("soil")}?`,
      pest: `${t("pest")} · ${term("harmful")}?`,
      market: `${t("netPrice")} · ${t("market")}?`,
      scheme: `${t("schemes")} · ${t("eligible")}?`,
    })[intent];
  const safeChecks = Array.isArray(spray.checks)
      ? spray.checks
      : fallbackDecision.checks,
    safeModels = Array.isArray(weatherJury.models)
      ? weatherJury.models
      : fallbackJury.models,
    safeSchemes = Array.isArray(schemes) ? schemes : fallbackSchemes,
    safePrices = Array.isArray(prices) ? prices : fallbackPrices,
    safeAuctions = Array.isArray(auctions) ? auctions : fallbackAuctions,
    safeNotifications = Array.isArray(notifications)
      ? notifications
      : fallbackNotifications;
  const latestFarmerAction = farmerActions[0] || null;
  const baseRecommendedTopic = recommendedGuide(reading, spray, pest);
  const recommendedTopic: GuideTopic = (() => {
    if (latestFarmerAction?.action_type === "irrigation" && reading.soil_moisture_pct < 30)
      return "soil";
    if (latestFarmerAction?.action_type === "spray" && reading.wind_speed_kmh > 12)
      return "wind";
    if (pest.harmful && latestFarmerAction?.action_type !== "inspection")
      return "pest";
    return baseRecommendedTopic;
  })();
  const activeGuide = getGuideContent(locale, guideTopic);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const savedLocale = localStorage.getItem(
          "gramin-connect:locale",
        ) as LocaleCode | null,
        savedTheme = localStorage.getItem("gramin-connect:theme") as
          | "light"
          | "dark"
          | null;
      setLocale(savedLocale && localeByCode[savedLocale] ? savedLocale : "hi");
      setTheme(savedTheme === "dark" ? "dark" : "light");
      const savedProfile = getLocalProfile();
      setSavedProfiles(getLocalProfiles());
      setProfile(
        savedProfile
          ? {
              ...defaultProfile,
              ...savedProfile,
              name:
                savedProfile.name === "Riya Demo Farm"
                  ? "Riya Farm Pilot"
                  : savedProfile.name,
            }
          : null,
      );
      document.documentElement.dataset.simple = "off";
      localStorage.removeItem("gramin-connect:simple");
      try {
        const saved = JSON.parse(
          localStorage.getItem("gramin-connect:done-actions") || "[]",
        );
        setDoneActions(Array.isArray(saved) ? saved : []);
      } catch {
        setDoneActions([]);
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("gramin-connect:theme", theme);
  }, [theme, hydrated]);
  useEffect(() => {
    if (hydrated)
      localStorage.setItem(
        "gramin-connect:done-actions",
        JSON.stringify(doneActions),
      );
  }, [doneActions, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = locale;
    document.documentElement.dir = currentLocale.dir || "ltr";
    localStorage.setItem("gramin-connect:locale", locale);
  }, [locale, currentLocale.dir, hydrated]);
  useEffect(() => {
    let count = 0;
    const timer = window.setInterval(async () => {
      count += 1;
      const fallback = {
        ...fallbackTelemetry(count),
        source: "demo" as const,
      };
      const nextReading = await latestTelemetry("FARM-001", fallback);
      setReading(nextReading);
      setSpray(await fetchDecision("FARM-001", fallbackDecision, profile?.crop, profile?.growth_stage));
      setEarlyWarning(await fetchEarlyWarning("FARM-001", {
        ...fallbackEarlyWarning,
        source: nextReading.source,
        current: {
          temperature_c: nextReading.temperature_c,
          wind_speed_kmh: nextReading.wind_speed_kmh,
          rainfall_mm_h: nextReading.rainfall_mm_h,
          humidity_pct: nextReading.humidity_pct,
        },
      }, profile?.crop, profile?.growth_stage));
      setSystemHealth(await fetchSystemStatus("FARM-001", fallbackSystemStatus));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [online, profile?.crop, profile?.growth_stage]);
  useEffect(() => {
    if (!profile) return;
    const liveFallbackSchemes = fallbackSchemesFor(profile);
    Promise.all([
      fetchDecision("FARM-001", fallbackDecision, profile.crop, profile.growth_stage),
      fetchJury(profile.latitude, profile.longitude, fallbackJury),
      schemeMatches(profile, liveFallbackSchemes),
      marketPrices(profile.crop, profile.state, fallbackPrices),
    ]).then(([d, j, s, p]) => {
      setSpray(d);
      setWeatherJury(j);
      setSchemes(s);
      setPrices(p);
    });
  }, [profile]);
  useEffect(() => {
    if (!profile) return;
    void fetchWeatherForecast("FARM-001", profile.latitude, profile.longitude, fallbackWeatherForecast)
      .then(setForecast);
  }, [profile]);
  useEffect(() => {
    if (!profile) return;
    let active = true;
    const refreshPest = async () => {
      const status = await pestLiveStatus(profile.id, fallbackPestLive);
      if (!active) return;
      setPestLive(status);
      if (status.detection) setPest(status.detection);
    };
    refreshPest();
    const timer = window.setInterval(refreshPest, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    const refreshActions = async () => {
      const items = await listFarmerActions(profile.id, []);
      if (active) setFarmerActions(items);
    };
    refreshActions();
    const timer = window.setInterval(refreshActions, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [profile]);
  useEffect(() => {
    if (!profile) return;
    listAuctions(fallbackAuctions).then(setAuctions);
  }, [profile]);
  useEffect(() => {
    if (!profile) return;
    const localNotices: NotificationItem[] = [
      {
        id: `SPRAY-${spray.severity}-${spray.title}`,
        title: spray.title || "Field decision",
        message: spray.reason || "Review the current field conditions.",
        severity: spray.spray_allowed ? "info" : "danger",
        created_at: new Date().toISOString(),
        status: spray.spray_allowed ? "safe" : "active",
        channel: "dashboard + local rule engine",
      },
      {
        id: `PEST-${pest.captured_at || "pending"}`,
        title: `${readableLabel(pest.insect, "Pest")} · ${pest.zone_id || "field"}`,
        message: pest.reason || fallbackPest.reason,
        severity: pest.harmful ? "warning" : "info",
        created_at: pest.captured_at || new Date().toISOString(),
        status: pest.harmful ? "review" : "safe",
        channel: pest.harmful
          ? "Field sensor alerts + automated deterrent"
          : "Field monitoring",
      },
    ];
    notificationOutbox(localNotices).then((items) => {
      setNotifications(items);
      setNotificationsRead(false);
    });
  }, [
    profile,
    spray.title,
    spray.reason,
    spray.severity,
    spray.spray_allowed,
    pest.captured_at,
    pest.harmful,
    pest.insect,
    pest.reason,
    pest.zone_id,
  ]);
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = currentLocale.speech;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };
  const saveFarmer = async (p: FarmerProfile) => {
    const mergedProfile = { ...defaultProfile, ...p };
    const completeProfile = {
      ...mergedProfile,
      id: mergedProfile.id || (await generateInternalFarmerId(mergedProfile)),
      agristack_farmer_id: mergedProfile.has_farmer_id
        ? (mergedProfile.agristack_farmer_id || "").trim().toUpperCase()
        : "",
    };
    setSchemes(fallbackSchemesFor(completeProfile));
    setProfile(completeProfile);
    setSavedProfiles((profiles) => [
      completeProfile,
      ...profiles.filter((item) => item.id !== completeProfile.id),
    ]);
    setShowSetup(false);
    setSetupDraft(null);
    setView("dashboard");
    const saved = await saveProfile(completeProfile);
    setProfile(saved);
    setSavedProfiles((profiles) => [
      saved,
      ...profiles.filter((item) => item.id !== saved.id),
    ]);
  };
  const addFarmer = () => {
    setSetupDraft({
      ...defaultProfile,
      id: "",
      name: "",
      mobile: "",
    });
    setShowSetup(true);
  };
  const editFarmer = () => {
    setSetupDraft(profile);
    setShowSetup(true);
  };
  const chooseFarmer = (farmer: FarmerProfile) => {
    selectLocalProfile(farmer);
    setSchemes(fallbackSchemesFor(farmer));
    setProfile(farmer);
    setView("dashboard");
  };
  const logoutFarmer = () => {
    clearLocalSession();
    onSignOut?.();
    setProfile(null);
    setSetupDraft(null);
    setShowSetup(false);
    setMenu(false);
    setView("dashboard");
  };
  const exportProof = () => {
    const row = `timestamp,event,zone,temperature,humidity,wind,rain,source\n${reading.timestamp},${spray.title},${reading.zone_id},${reading.temperature_c},${reading.humidity_pct},${reading.wind_speed_kmh},${reading.rainfall_mm_h},${reading.source}`;
    const url = URL.createObjectURL(new Blob([row], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mausam-saboot.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const recordFarmerAction = async (
    actionType: FarmerAction["action_type"],
    note: string,
  ) => {
    if (!profile || actionSaving) return;
    setActionSaving(true);
    const metricMap: Record<FarmerAction["action_type"], { metric: string; value: number; unit: string }> = {
      irrigation: { metric: "soil_moisture_pct", value: reading.soil_moisture_pct, unit: "%" },
      spray: { metric: "wind_speed_kmh", value: reading.wind_speed_kmh, unit: "km/h" },
      inspection: { metric: "pest_count_5min", value: pest.count_5min, unit: "count/5min" },
      fertilizer: { metric: "soil_moisture_pct", value: reading.soil_moisture_pct, unit: "%" },
      maintenance: { metric: "battery_pct", value: reading.battery_pct, unit: "%" },
      harvest: { metric: "temperature_c", value: reading.temperature_c, unit: "°C" },
      other: { metric: "field_note", value: 0, unit: "" },
    };
    const metric = metricMap[actionType];
    const created = await createFarmerAction({
      farm_id: "FARM-001",
      farmer_id: profile.id,
      zone_id: reading.zone_id || "Z02",
      action_type: actionType,
      metric: metric.metric,
      before_value: metric.value,
      unit: metric.unit,
      note,
    });
    setFarmerActions((items) => [created, ...items.filter((item) => item.id !== created.id)].slice(0, 20));
    setActionSaving(false);
  };

  const submitAuction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || auctionSaving) return;
    setAuctionSaving(true);
    setAuctionMessage("");
    const created = await createAuction({
      farm_id: "FARM-001",
      farmer_id: profile.id,
      commodity: profile.crop,
      quantity_kg: Number(auctionForm.quantity_kg) || 1,
      reserve_price_per_kg: Number(auctionForm.reserve_price_per_kg) || 1,
      village: profile.village,
      closes_at: new Date(auctionForm.closes_at).toISOString(),
    });
    setAuctions((items) => [
      created,
      ...(Array.isArray(items)
        ? items.filter((item) => item.id !== created.id)
        : []),
    ]);
    setAuctionSaving(false);
    setAuctionOpen(false);
    setAuctionMessage(
      online
        ? "Auction published to the local buyer network."
        : "Auction saved offline and queued for sync.",
    );
  };

  if (!hydrated)
    return (
      <div className="boot-screen">
        <span>
          <Sprout size={22} />
        </span>
        <strong>KhetOS</strong>
        <small>Preparing the local field desk…</small>
      </div>
    );
  if (!profile && !showSetup && savedProfiles.length > 0)
    return (
      <div className="account-gate" dir={currentLocale.dir || "ltr"}>
        <PageLocalizer locale={locale} />
        <div className="account-gate-card">
          <div className="brand account-brand">
            <span>
              <Sprout size={24} />
            </span>
            <div>
              <strong>KhetOS</strong>
            </div>
          </div>
          <span className="micro-label">{t("offline")} · {t("profile")}</span>
          <h1>{term("farmer")} · {t("profile")}</h1>
          <div className="account-list">
            {savedProfiles.map((farmer) => (
              <button
                className="account-choice"
                key={farmer.id}
                onClick={() => chooseFarmer(farmer)}
              >
                <span>{farmer.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{farmer.name}</strong>
                  <small>
                    {farmer.village}, {farmer.district} · {farmer.crop}
                  </small>
                </div>
                <em>{t("continue")}</em>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          <button className="add-account" onClick={addFarmer}>
            <CircleUserRound size={18} /> + {term("farmer")} · {t("profile")}
          </button>
          <small className="account-note">
            {t("workingOffline")} · {tr("savedLocal")}
          </small>
        </div>
      </div>
    );
  if (!profile || showSetup)
    return (
      <div className="onboarding" dir={currentLocale.dir || "ltr"}>
        <PageLocalizer locale={locale} />
        <div className="onboarding-bar">
          <div className="brand">
            <span>
              <Sprout size={22} />
            </span>
            <div>
              <strong>KhetOS</strong>
            </div>
          </div>
          <div className="onboard-actions">
            <select
              aria-label="Language"
              value={locale}
              onChange={(e) => setLocale(e.target.value as LocaleCode)}
            >
              {LOCALES.map((l) => (
                <option value={l.code} key={l.code}>
                  {l.nativeName}
                </option>
              ))}
            </select>
            <button
              aria-label="Toggle colour theme"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
          </div>
        </div>
        <main className="onboarding-card">
          <div className="welcome-copy">
            <span className="micro-label">
              ONE-TIME FARM SETUP · एक बार जानकारी
            </span>
            <h1>
              आपका खेत, आपकी भाषा,
              <br />
              <em>आपका निर्णय।</em>
            </h1>
          </div>
          <div className="setup-panel">
            <div className="panel-title">
              <span>01</span>
              <div>
                <strong>Farmer & farm profile</strong>
                <small>Saved locally first, synced when connected</small>
              </div>
            </div>
            <ProfileForm
              initial={setupDraft || profile || defaultProfile}
              locale={locale}
              onDone={saveFarmer}
            />
          </div>
        </main>
      </div>
    );

  const modalPrice = safePrices[0]?.modal_price || 1850,
    transport = 180,
    commission = Math.round(modalPrice * 0.06),
    handling = 70,
    netPrice = modalPrice - transport - commission - handling;
  const phoneDigits = profile.mobile.replace(/\D/g, "");
  const maskedMobile = phoneDigits ? `••••••${phoneDigits.slice(-4)}` : "—";
  const navLabel = (item: (typeof nav)[number]) =>
    item.id === "sabha"
      ? tr("fieldDecision")
      : item.id === "guide"
        ? guideLabel(locale).nav
        : item.label || t(item.key || "dashboard");
  const windDirection = windDirectionLabel(reading.wind_direction_deg);
  const heatIndex = heatIndexCelsius(reading.temperature_c, reading.humidity_pct);
  const heatWarningC = Number(spray.thresholds?.heat_warning_c ?? 33);
  const heatDangerC = Number(spray.thresholds?.heat_danger_c ?? 38);
  const heatStatus = reading.temperature_c >= heatDangerC
    ? "danger"
    : reading.temperature_c >= heatWarningC || heatIndex >= heatDangerC
      ? "watch"
      : "safe";
  const heatStatusLabel = heatStatus === "danger" ? "Severe heat stress risk" : heatStatus === "watch" ? "Heat stress watch" : "Heat conditions normal";
  const activeAlert = spray.alerts?.find((alert) => alert.severity === "red") || spray.alerts?.find((alert) => alert.severity === "yellow");
  const sensorReady = (key: string) => reading.source === "demo" || reading.sensor_status?.[key] !== false;
  const soilLabel = spray.soil_condition?.label || (reading.soil_moisture_pct < 30 ? "Dry" : reading.soil_moisture_pct > 75 ? "Too wet" : "Optimal");
  const demoScenarioCopy = {
    normal: { severity: "safe" as const, title: "Field conditions normal", message: "All monitored values are inside the configured limits.", action: "Farm work may continue", temperature: 30.4, humidity: 64, rain: 0, wind: 8.2, pattern: "none" },
    heat: { severity: "danger" as const, title: "Heat stress warning", message: "Temperature has crossed 38°C. Protect workers and irrigate only if soil condition requires it.", action: "Pause field work and inspect crop", temperature: 39.2, humidity: 48, rain: 0, wind: 9.4, pattern: "three_short" },
    rain: { severity: "danger" as const, title: "Heavy rainfall warning", message: "Heavy rain is detected. Stop spraying and protect harvested produce.", action: "Stop spraying and secure produce", temperature: 29.1, humidity: 91, rain: 12.6, wind: 11.8, pattern: "two_long" },
    wind: { severity: "danger" as const, title: "High wind warning", message: "Wind is above the 15 km/h spray limit. Chemical drift risk is high.", action: "Do not spray until wind reduces", temperature: 32.1, humidity: 67, rain: 0, wind: 21.6, pattern: "one_long_two_short" },
    "spray-unsafe": { severity: "danger" as const, title: "Spraying is unsafe", message: "Wind and humidity conditions can cause spray drift and poor coverage.", action: "Postpone spraying and retry later", temperature: 33.4, humidity: 84, rain: 1.8, wind: 18.7, pattern: "continuous_pulse" },
  };
  const speakFarmerAlert = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const selected = demoScenarioCopy[demoScenario];
    const speech = new SpeechSynthesisUtterance(
      demoScenario === "normal"
        ? "खेत की स्थिति सामान्य है।"
        : `${selected.title}. ${selected.action}.`,
    );
    speech.lang = demoScenario === "normal" ? "hi-IN" : "en-IN";
    speech.rate = 0.9;
    window.speechSynthesis.speak(speech);
  };
  const runJudgeScenario = async (scenario: "normal" | "heat" | "rain" | "wind" | "spray-unsafe") => {
    const selected = demoScenarioCopy[scenario];
    const now = new Date().toISOString();
    setDemoBusy(scenario);
    setDemoScenario(scenario);
    setDemoAcknowledged(false);
    setReading((current) => ({ ...current, timestamp: now, temperature_c: selected.temperature, humidity_pct: selected.humidity, rainfall_mm_h: selected.rain, wind_speed_kmh: selected.wind, source: "demo" }));
    setSpray((current) => ({ ...current, severity: selected.severity, spray_allowed: scenario === "normal", title: selected.title, reason: selected.message, confidence: 94, alerts: scenario === "normal" ? [] : [{ code: `demo_${scenario}`, severity: "red", title: selected.title, message: selected.message, action: selected.action }] }));
    setEarlyWarning((current) => ({ ...current, status: selected.severity, summary: selected.message, source: "cached", current: { temperature_c: selected.temperature, wind_speed_kmh: selected.wind, rainfall_mm_h: selected.rain, humidity_pct: selected.humidity } }));
    setSystemHealth((current) => ({ ...current, generated_at: now, packet_age_seconds: 0, connection: "offline/cached", data_source: "demo", actuator: { ...current.actuator, buzzer_active: scenario !== "normal", buzzer_pattern: selected.pattern, spray_relay_locked: scenario !== "normal" } }));
    setNotifications((current) => [{ id: `demo-${Date.now()}`, title: selected.title, message: selected.action, severity: scenario === "normal" ? "info" : "danger", created_at: now, status: "demo-ready", channel: "dashboard + local buzzer + voice + phone queue" }, ...current].slice(0, 6));
    setNotificationsRead(false);
    setView("dashboard");
    void runDemoScenario(scenario).catch(() => undefined);
    window.setTimeout(() => setDemoBusy(""), 350);
  };
  const driestZone = [...zones].sort((a, b) => a.moisture - b.moisture)[0];
  const topScheme = safeSchemes[0] || fallbackSchemes[0];
  const sabhaAnswers = {
    spray: {
      eyebrow: t("safety"),
      verdict: spray.spray_allowed ? t("safe") : t("unsafe"),
      action: `${t("wind")}: ${reading.wind_speed_kmh} km/h · ${t("safe")}: ≤ 15 km/h`,
      confidence: spray.confidence,
      witnesses: [
        [t("wind"), `${reading.wind_speed_kmh} km/h`, t("source")],
        [t("rainfall"), `${reading.rainfall_mm_h} mm/h`, t("live")],
        [t("safety"), spray.spray_allowed ? t("safe") : t("unsafe"), t("sensorTrust")],
      ],
      nextView: "safety" as ViewKey,
    },
    zone: {
      eyebrow: t("zones"),
      verdict: `${driestZone.id} · ${t("alerts")}`,
      action: `${t("soil")}: ${driestZone.moisture}% · ${t("continue")}: ${t("farm")}`,
      confidence: 88,
      witnesses: [
        [t("zones"), `${driestZone.id} · ${driestZone.moisture}%`, t("live")],
        [t("soil"), driestZone.soil_type, t("profile")],
        [term("crop"), profile.growth_stage, t("profile")],
      ],
      nextView: "farm" as ViewKey,
    },
    pest: {
      eyebrow: t("pest"),
      verdict: `${readableLabel(pest.insect)} · ${pest.crop} · ${pest.harmful ? term("harmful") : term("helpful")}`,
      action: pest.harmful ? tr("noPesticide") : tr("fieldRespond"),
      confidence: Math.round(pest.vision_confidence * 100),
      witnesses: [
        [term("camera"), `${pest.count_5min} / 5 min`, t("source")],
        [term("crop"), `${pest.crop} + ${readableLabel(pest.insect)}`, t("source")],
        [t("alerts"), pest.harmful ? "Field alarm + registered farmer update" : t("safe"), t("offline")],
      ],
      nextView: "pest" as ViewKey,
    },
    market: {
      eyebrow: t("market"),
      verdict: `${t("netPrice")}: ₹${netPrice}/quintal`,
      action: `${t("cost")}: ₹${transport + commission + handling}/quintal · ${t("source")}: ₹${modalPrice}/quintal`,
      confidence: 76,
      witnesses: [
        [t("market"), `₹${modalPrice}/q`, t("source")],
        [t("cost"), `₹${transport + commission + handling}/q`, t("profile")],
        [t("auction"), `${safeAuctions.length} · ${term("open")}`, term("local")],
      ],
      nextView: "market" as ViewKey,
    },
    scheme: {
      eyebrow: t("schemes"),
      verdict: `${topScheme.score}% match: ${topScheme.title}`,
      action: `${t("apply")}: ${topScheme.authority} · ${tr("schemeNotice")}`,
      confidence: topScheme.score,
      witnesses: [
        [t("profile"), `${profile.land_acres} acres · ${profile.state}`, t("save")],
        [t("schemes"), topScheme.authority, t("source")],
        [t("updated"), topScheme.verified_on, t("source")],
      ],
      nextView: "schemes" as ViewKey,
    },
  } satisfies Record<
    SabhaIntent,
    {
      eyebrow: string;
      verdict: string;
      action: string;
      confidence: number;
      witnesses: string[][];
      nextView: ViewKey;
    }
  >;
  const sabhaAnswer = sabhaAnswers[sabhaIntent];
  const whatsappNumber =
    phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
  const pestAlarmActive = Boolean(
    pestLive.detection && pest.harmful && pest.severity === "high",
  );
  const weatherAlarmReason = reading.wind_speed_kmh > 15
    ? `High wind ${reading.wind_speed_kmh} km/h`
    : reading.rainfall_mm_h > 2
      ? `Rainfall ${reading.rainfall_mm_h} mm/h`
      : !spray.spray_allowed
        ? spray.reason
        : "Field conditions normal";
  const weatherAlarmActive = Boolean(
    !spray.spray_allowed &&
      (reading.wind_speed_kmh > 15 || reading.rainfall_mm_h > 2),
  );
  const whatsappDeliveryLabel =
    pestLive.notification?.phone_status === "sent"
      ? "Delivered"
      : pestLive.notification?.phone_status === "queued_retry" ||
          pestLive.notification?.phone_status === "queued_offline"
        ? "Queued for retry"
        : pestLive.notification?.phone_status === "consent_off" ||
            profile.whatsapp_alert_consent === false
          ? "Consent disabled"
          : "Armed";

  const farmReport = [
    "KhetOS · FARM REPORT",
    `Farmer: ${profile.name} (${profile.id})`,
    `Farm: ${profile.village}, ${profile.district} · ${profile.land_acres} acres`,
    `Crop: ${profile.crop} · ${profile.growth_stage} · ${profile.irrigation}`,
    `Recorded: ${new Date(reading.timestamp).toLocaleString("en-IN")}`,
    `Temperature: ${reading.temperature_c}°C · Humidity: ${reading.humidity_pct}%`,
    `Rain: ${reading.rainfall_mm_h} mm/h · Wind: ${reading.wind_speed_kmh} km/h at ${reading.wind_direction_deg}°`,
    `Light: ${reading.light_lux} lux · Soil moisture: ${reading.soil_moisture_pct}% (${reading.zone_id})`,
    `Spray safety: ${spray.spray_allowed ? "SAFE" : "LOCKED"} · ${spray.reason}`,
    `Insect watch: ${readableLabel(pest.insect)} · ${pest.harmful ? "harmful" : "helpful"} · ${pest.field_action}`,
    `Top scheme match: ${topScheme.title} (${topScheme.score}%)`,
    `Estimated net mandi amount: ₹${netPrice}/quintal after entered costs`,
    `Data status: ${reading.source === "live" || reading.source === "ble" ? "Field sensor connected" : "Waiting for field sensor"}`,
    "Scheme matching is a pre-screen. Final eligibility is decided only on the official portal.",
  ].join("\n");
  const shareOnWhatsApp = (
    kind: "scheme" | "farm_report" | "pest_alert",
    message: string,
  ) => {
    if (!whatsappNumber) {
      setShareNotice(
        "Add the farmer's registered WhatsApp number in Profile first.",
      );
      setView("profile");
      return;
    }
    void queueWhatsApp({
      farm_id: "FARM-001",
      farmer_id: profile.id,
      mobile: profile.mobile,
      kind,
      message,
      consent: true,
    });
    const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(link, "_blank", "noopener,noreferrer");
    setShareNotice(
      kind === "farm_report"
        ? `Farm report prepared for ${maskedMobile}. Confirm Send in WhatsApp.`
        : `Scheme suggestion prepared for ${maskedMobile}. Confirm Send in WhatsApp.`,
    );
  };
  const openReportFlow = () => {
    setReportConsent(false);
    setReportStatus("idle");
    setReportOpen(true);
  };
  const confirmConsentReport = async () => {
    if (!reportConsent) return;
    if (phoneDigits.length < 10) {
      setReportStatus("error");
      setShareNotice(
        "Add the farmer's registered WhatsApp number in Profile first.",
      );
      return;
    }
    setReportStatus("verifying");
    const handshake = await queueWhatsApp({
      farm_id: "FARM-001",
      farmer_id: profile.id,
      mobile: profile.mobile,
      kind: "farm_report",
      message: farmReport,
      consent: true,
    });
    if (!handshake.status) {
      setReportStatus("error");
      return;
    }
    setReportStatus("verified");
    const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(farmReport)}`;
    window.open(link, "_blank", "noopener,noreferrer");
    setShareNotice(
      `Consent verified. Farm report prepared for ${maskedMobile}; the farmer must confirm Send in WhatsApp.`,
    );
  };
  return (
    <div className="application" dir={currentLocale.dir || "ltr"}>
      <PageLocalizer locale={locale} />
      <button
        className="mobile-menu"
        aria-label="Open menu"
        onClick={() => setMenu(true)}
      >
        <Menu size={19} />
      </button>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <button
          className="close-menu"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        >
          <X size={18} />
        </button>
        <div className="brand">
          <span>
            <Sprout size={22} />
          </span>
          <div>
            <strong>KhetOS</strong>
          </div>
        </div>
        <div className="farm-pill">
          <span>{profile.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <small>
              {profile.village}, {profile.district}
            </small>
            <strong>
              {profile.land_acres} acres · {profile.crop}
            </strong>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                onClick={() => {
                  setView(item.id);
                  setMenu(false);
                }}
              >
                <Icon size={17} />
                <span>{navLabel(item)}</span>
              </button>
            );
          })}
        </nav>
        <button className="user-row" onClick={() => setView("profile")}>
          <span>{profile.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{profile.name}</strong>
            <small>{profile.id}</small>
          </div>
          <ChevronRight size={15} />
        </button>
        <button className="logout-row" onClick={logoutFarmer}>
          <LogOut size={16} /> {t("logout")}
        </button>
      </aside>
      <main className="main">
        <header className="topbar topbar-actions-only">
          <div className="top-actions">
            <label className="language-picker">
              <Languages size={16} />
              <select
                value={locale}
                aria-label="Language"
                onChange={(e) => setLocale(e.target.value as LocaleCode)}
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              aria-label="Toggle colour theme"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              className="icon-button alert-icon"
              aria-label={t("alerts")}
              aria-expanded={notificationOpen}
              onClick={() => {
                setNotificationOpen((open) => !open);
                setNotificationsRead(true);
              }}
            >
              <BellRing size={17} />
              {safeNotifications.length && !notificationsRead ? <i /> : null}
            </button>
          </div>
          {notificationOpen ? (
            <aside
              className="notification-panel"
              aria-label={`${term("field")} · ${t("alerts")}`}
            >
              <div className="notification-head">
                <div>
                  <strong>{term("field")} · {t("alerts")}</strong>
                  <small>{safeNotifications.length} · {t("updated")}</small>
                </div>
                <button
                  aria-label={t("alerts")}
                  onClick={() => setNotificationOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="notification-list">
                {safeNotifications.length ? (
                  safeNotifications.slice(0, 6).map((notice) => {
                    return (
                    <button
                      className={`notification-row ${notice.severity}`}
                      key={notice.id}
                      onClick={() => {
                        setNotificationOpen(false);
                        setView("safety");
                      }}
                    >
                      <span>
                        {notice.severity === "danger" ? (
                          <Siren size={16} />
                        ) : notice.severity === "warning" ? (
                          <Bug size={16} />
                        ) : (
                          <BellRing size={16} />
                        )}
                      </span>
                      <div>
                        <strong>{t("weather")} · {t("alerts")}</strong>
                        <p>
                          {`${t("wind")}: ${reading.wind_speed_kmh} km/h · ${spray.spray_allowed ? t("safe") : t("unsafe")}`}
                        </p>
                        <small>
                          {t("source")} · {notice.status === "safe" ? t("safe") : t("alerts")}
                        </small>
                      </div>
                      <ChevronRight size={15} />
                    </button>
                    );
                  })
                ) : (
                  <p className="notification-empty">{term("field")} · {t("safe")}</p>
                )}
              </div>
            </aside>
          ) : null}
        </header>
        <div className="page">
          {view === "dashboard" && (
            <>
              <section className={`ihat-command-hero ${spray.severity}`}>
                <div className="ihat-command-copy">
                  <div className="ihat-status-line">
                    <span className={`ihat-severity-dot ${spray.severity}`} />
                    <span>{spray.severity === "danger" ? "RED · DANGER" : spray.severity === "watch" ? "YELLOW · WATCH" : "GREEN · SAFE"}</span>
                    <StatusChip source={reading.source} online={online} t={t} />
                  </div>
                  <h2>{activeAlert?.title || "Field conditions normal"}</h2>
                  <p>{activeAlert?.message || "All monitored values are inside the configured limits."}</p>
                  <small>Updated {new Date(reading.timestamp).toLocaleTimeString("en-IN")} · {systemHealth.packet_age_seconds.toFixed(0)} sec packet age</small>
                </div>
                <div className="ihat-action-state">
                  <div><span>Spraying</span><strong>{spray.spray_allowed ? "ALLOWED" : "BLOCKED"}</strong><small>{spray.reason}</small></div>
                  <div><span>Local alarm</span><strong>{systemHealth.actuator.buzzer_active ? "BUZZER ON" : "STANDBY"}</strong><small>{systemHealth.actuator.buzzer_pattern.replaceAll("_", " ")}</small></div>
                </div>
              </section>

              <section className="judge-scenarios" aria-label="Judge demonstration controls">
                <div><span className="micro-label">JUDGE DEMONSTRATION · SIMULATED SENSOR DATA</span><strong>Choose a field condition to show the complete farmer-alert flow</strong></div>
                <div>{(["normal", "heat", "rain", "wind", "spray-unsafe"] as const).map((scenario) => <button key={scenario} disabled={Boolean(demoBusy)} onClick={() => runJudgeScenario(scenario)}>{demoBusy === scenario ? "Running…" : scenario.replace("-", " ")}</button>)}</div>
              </section>

              <section className={`farmer-alert-demo ${demoScenarioCopy[demoScenario].severity}`} aria-label="Farmer alert delivery demonstration">
                <div className="farmer-alert-summary">
                  <span className="farmer-alert-icon"><Siren size={24} /></span>
                  <div>
                    <span className="micro-label">FARMER ALERT · DEMO MODE</span>
                    <h3>{demoScenarioCopy[demoScenario].title}</h3>
                    <p>{demoScenarioCopy[demoScenario].action}</p>
                  </div>
                </div>
                <div className="farmer-alert-channels">
                  <div><BellRing size={18} /><span>Local buzzer</span><strong>{demoScenario === "normal" ? "Standby" : "Active now"}</strong></div>
                  <button type="button" onClick={speakFarmerAlert}><Volume2 size={18} /><span>Voice alert</span><strong>Play aloud</strong></button>
                  <div><Smartphone size={18} /><span>Phone alert</span><strong>{online ? `Ready · ${maskedMobile}` : "Queued offline"}</strong></div>
                </div>
                <button className={demoAcknowledged ? "alert-acknowledge acknowledged" : "alert-acknowledge"} type="button" onClick={() => setDemoAcknowledged(true)}>
                  <CircleCheckBig size={17} /> {demoAcknowledged ? "Farmer acknowledged" : "I understand — mark as seen"}
                </button>
                <small>Hardware-independent presentation mode uses the same safety thresholds. Real sensors can replace the simulated readings without changing this alert flow.</small>
              </section>

              <div className="sensor-grid">
                <SensorCard
                  icon={Sun}
                  label={t("temperature")}
                  value={sensorReady("temperature_humidity_ok") ? reading.temperature_c : "—"}
                  unit={sensorReady("temperature_humidity_ok") ? "°C" : ""}
                  note={sensorReady("temperature_humidity_ok") ? t("live") : "SENSOR NOT CONNECTED"}
                  risk={sensorReady("temperature_humidity_ok") && reading.temperature_c > 35}
                />
                <SensorCard
                  icon={Activity}
                  label={t("humidity")}
                  value={sensorReady("temperature_humidity_ok") ? reading.humidity_pct : "—"}
                  unit={sensorReady("temperature_humidity_ok") ? "%" : ""}
                  note={sensorReady("temperature_humidity_ok") ? t("live") : "SENSOR NOT CONNECTED"}
                />
                <SensorCard
                  icon={CloudSun}
                  label={reading.rain_gauge_type === "raindrop_detector_not_quantitative" ? "Rain detection" : t("rainfall")}
                  value={!sensorReady("rain_detection_ok") ? "—" : reading.rain_gauge_type === "raindrop_detector_not_quantitative" ? (reading.rain_detected ? "YES" : "NO") : reading.rainfall_mm_h}
                  unit={reading.rain_gauge_type === "raindrop_detector_not_quantitative" ? "" : "mm/h"}
                  note={!sensorReady("rain_detection_ok") ? "SENSOR NOT CONNECTED" : reading.rain_gauge_type === "raindrop_detector_not_quantitative" ? "Detection only · not mm/h" : t("live")}
                  risk={reading.rainfall_mm_h > 8}
                />
                <SensorCard
                  icon={Gauge}
                  label="Wind speed"
                  value={sensorReady("wind_ok") ? reading.wind_speed_kmh : "—"}
                  unit={sensorReady("wind_ok") ? "km/h" : ""}
                  note={sensorReady("wind_ok") ? t("live") : "SENSOR NOT CONNECTED"}
                  risk={sensorReady("wind_ok") && reading.wind_speed_kmh > 15}
                />
                <SensorCard
                  icon={Compass}
                  label="Wind direction"
                  value={sensorReady("wind_ok") ? windDirection.split(" · ")[0] : "—"}
                  unit={sensorReady("wind_ok") ? `${Math.round(reading.wind_direction_deg)}°` : ""}
                  note={sensorReady("wind_ok") ? windDirection.split(" · ")[1] : "SENSOR NOT CONNECTED"}
                />
                <SensorCard
                  icon={Lightbulb}
                  label={t("light")}
                  value={sensorReady("light_ok") ? (reading.light_lux / 1000).toFixed(1) : "—"}
                  unit={sensorReady("light_ok") ? "klux" : ""}
                  note={sensorReady("light_ok") ? t("live") : "SENSOR NOT CONNECTED"}
                />
                <SensorCard
                  icon={Sprout}
                  label={t("soil")}
                  value={reading.soil_moisture_pct}
                  unit="%"
                  note={`${soilLabel} · ${reading.zone_id}`}
                  risk={reading.soil_moisture_pct < 30}
                />
              </div>
              <section className={`early-warning panel ${earlyWarning.status}`} aria-label="Early warning forecast">
                <div className="early-warning-head">
                  <div>
                    <span className="micro-label">EARLY WARNING · NEXT {earlyWarning.horizon_minutes} MIN</span>
                    <h3>{earlyWarning.status === "danger" ? "Act before conditions worsen" : earlyWarning.status === "warning" ? "Conditions need watching" : "No threshold breach projected"}</h3>
                  </div>
                  <strong>{earlyWarning.zone_id}</strong>
                </div>
                <p className="early-warning-summary">{earlyWarning.summary}</p>
                <div className="early-warning-grid">
                  <div><small>Now</small><strong>{earlyWarning.current.wind_speed_kmh?.toFixed?.(1) ?? earlyWarning.current.wind_speed_kmh} km/h</strong><span>wind</span></div>
                  <div><small>Projected</small><strong>{earlyWarning.projected.wind_speed_kmh?.toFixed?.(1) ?? earlyWarning.projected.wind_speed_kmh} km/h</strong><span>wind in 60 min</span></div>
                  <div><small>Rain now</small><strong>{earlyWarning.current.rainfall_mm_h?.toFixed?.(1) ?? earlyWarning.current.rainfall_mm_h} mm/h</strong><span>field gauge</span></div>
                  <div><small>Evidence</small><strong>{earlyWarning.evidence_packets}</strong><span>recent packets</span></div>
                </div>
                {earlyWarning.risks.length ? (
                  <div className="early-warning-risks">
                    {earlyWarning.risks.slice(0, 3).map((risk) => (
                      <div key={risk.type}><b>{risk.label}</b><span>{risk.message}</span></div>
                    ))}
                  </div>
                ) : null}
              </section>
              {false && <>
              <section className="today-board panel">
                <div className="today-heading">
                  <span>
                    <ListChecks size={18} />
                  </span>
                  <div>
                    <small>आज के 3 काम · TODAY&apos;S FIELD LIST</small>
                    <h3>Only what needs attention now</h3>
                  </div>
                  <em>{doneActions.length}/3 done</em>
                </div>
                <div className="today-list">
                  <article
                    className={`today-task urgent ${doneActions.includes("spray") ? "done" : ""}`}
                  >
                    <b>01</b>
                    <div>
                      <small>अभी रोकें · STOP NOW</small>
                      <strong>Do not spray in Z02</strong>
                      <p>
                        Wind {reading.wind_speed_kmh} km/h is carrying droplets
                        beyond the crop.
                      </p>
                    </div>
                    <button
                      aria-label="Mark spray task complete"
                      onClick={() =>
                        setDoneActions((v) =>
                          v.includes("spray")
                            ? v.filter((x) => x !== "spray")
                            : [...v, "spray"],
                        )
                      }
                    >
                      {doneActions.includes("spray") ? (
                        <CircleCheckBig />
                      ) : (
                        <ShieldCheck />
                      )}
                      <span>
                        {doneActions.includes("spray") ? "Noted" : "View lock"}
                      </span>
                    </button>
                  </article>
                  <article
                    className={`today-task ${doneActions.includes("water") ? "done" : ""}`}
                  >
                    <b>02</b>
                    <div>
                      <small>10:30 से पहले · BEFORE 10:30</small>
                      <strong>Run Z02 drip for 12 minutes</strong>
                      <p>
                        Sandy strip is {reading.soil_moisture_pct}%; target band
                        is 48–58%.
                      </p>
                    </div>
                    <button
                      aria-label="Mark irrigation task complete"
                      onClick={() =>
                        setDoneActions((v) =>
                          v.includes("water")
                            ? v.filter((x) => x !== "water")
                            : [...v, "water"],
                        )
                      }
                    >
                      {doneActions.includes("water") ? (
                        <CircleCheckBig />
                      ) : (
                        <Droplets />
                      )}
                      <span>
                        {doneActions.includes("water") ? "Done" : "Mark done"}
                      </span>
                    </button>
                  </article>
                  <article
                    className={`today-task ${doneActions.includes("clean") ? "done" : ""}`}
                  >
                    <b>03</b>
                    <div>
                      <small>2 MIN CHECK · रखरखाव</small>
                      <strong>Wipe the rain plate once</strong>
                      <p>
                        The plate has not reported a cleaning check for seven
                        days.
                      </p>
                    </div>
                    <button
                      aria-label="Mark maintenance task complete"
                      onClick={() =>
                        setDoneActions((v) =>
                          v.includes("clean")
                            ? v.filter((x) => x !== "clean")
                            : [...v, "clean"],
                        )
                      }
                    >
                      {doneActions.includes("clean") ? (
                        <CircleCheckBig />
                      ) : (
                        <Wrench />
                      )}
                      <span>
                        {doneActions.includes("clean") ? "Done" : "Mark done"}
                      </span>
                    </button>
                  </article>
                </div>
              </section>
              <button
                className={`pest-brief ${pest.harmful ? "danger" : "safe"}`}
                onClick={() => setView("pest")}
              >
                <span className="pest-brief-icon">
                  <Bug size={21} />
                  <i />
                </span>
                <span>
                  <small>कीट पहरा · CROP-AWARE PEST GUARD</small>
                  <strong>
                    {pest.harmful
                      ? `${readableLabel(pest.insect, "insect")} detected in ${pest.zone_id ?? "the field"}`
                      : `${readableLabel(pest.insect, "insect")} is beneficial`}
                  </strong>
                  <em>
                    {pest.harmful
                      ? `${pest.count_5min} in 5 min · field alarm and farmer update ready`
                      : "No alarm · preserve this insect"}
                  </em>
                </span>
                <b>{pest.harmful ? "ACT NOW" : "SAFE"}</b>
                <ChevronRight size={18} />
              </button>
              <section className="dashboard-columns">
                <aside className="feature-stack">
                  <button onClick={() => setView("weather")}>
                    <CloudSun />
                    <span>
                      <small>MAUSAM JURY</small>
                      <strong>
                        {weatherJury.verdict === "agree"
                          ? "Forecasts agree"
                          : "Forecasts disagree"}
                      </strong>
                      <em>{weatherJury.confidence}% confidence</em>
                    </span>
                    <ChevronRight />
                  </button>
                  <button onClick={() => setView("schemes")}>
                    <Leaf />
                    <span>
                      <small>{t("schemes").toUpperCase()}</small>
                      <strong>
                        {safeSchemes.length} {t("eligible")}
                      </strong>
                      <em>Using saved farmer profile</em>
                    </span>
                    <ChevronRight />
                  </button>
                  <button onClick={() => setView("market")}>
                    <HandCoins />
                    <span>
                      <small>HAATH MEIN KITNA</small>
                      <strong>₹{netPrice}/quintal</strong>
                      <em>After transport + commission</em>
                    </span>
                    <ChevronRight />
                  </button>
                </aside>
              </section>
              <section className="outcome-card panel">
                <div className="outcome-title">
                  <span>
                    <ScanLine size={19} />
                  </span>
                  <div>
                    <small>काम का असर · ACTION RESULT</small>
                    <h3>Did the field respond?</h3>
                  </div>
                  <em>Recorded at 08:18</em>
                </div>
                <div className="outcome-flow">
                  <div>
                    <small>Before irrigation</small>
                    <strong>37%</strong>
                    <span>soil moisture</span>
                  </div>
                  <i>
                    <span />
                  </i>
                  <div className="outcome-result">
                    <small>12 min drip</small>
                    <strong>+15%</strong>
                    <span>Z02 reached 52%</span>
                  </div>
                  <i>
                    <span />
                  </i>
                  <div>
                    <small>45 min later</small>
                    <strong>52%</strong>
                    <span>response verified</span>
                  </div>
                </div>
                <p>
                  <CircleCheckBig size={15} /> Farm Memory will use this
                  response—not a generic crop average—for the next
                  recommendation.
                </p>
              </section>
              </>}
            </>
          )}

          {view === "farm" && (
            <section className="farm-map-only">
              <article className="panel map-panel">
                <div className="panel-head">
                  <div>
                    <span className="micro-label">FARM DIGITAL TWIN</span>
                    <h2>
                      {t("farm")} · {profile.village}
                    </h2>
                    <p>
                      Your configured farm location. Use the profile page to
                      update it when the farm changes.
                    </p>
                  </div>
                  <span className="tag">{profile.land_acres} acres</span>
                </div>
                <FarmMap
                  latitude={profile.latitude}
                  longitude={profile.longitude}
                  zones={zones}
                  reading={reading}
                />
              </article>
            </section>
          )}

          {view === "pest" && (
            <>
              <section className={`pest-command-hero ${pestAlarmActive ? "danger" : pestLive.connected ? "monitoring" : "idle"}`}>
                <div>
                  <span className="micro-label">PEST GUARD · LIVE FIELD WATCH</span>
                  <h2>{pestLive.detection ? `${readableLabel(pest.insect)} detected in ${pest.zone_id}` : "Field trap is ready for the first verified detection"}</h2>
                  <p>{pestLive.detection ? pest.reason : "When the camera/classifier posts a verified event, this screen updates automatically and the alert controller decides whether the farmer needs a local alarm and WhatsApp message."}</p>
                </div>
                <div className="pest-command-state">
                  <span className={pestLive.connected ? "signal on" : "signal"} />
                  <strong>{pestLive.connected ? "Camera linked" : "Camera not linked"}</strong>
                  <small>{pestLive.last_seen_seconds == null ? "No camera packet received yet" : `Last event ${Math.round(pestLive.last_seen_seconds)} sec ago`}</small>
                </div>
              </section>

              <section className="pest-ops-grid">
                <article className="panel pest-observation-card">
                  <div className="panel-head"><div><span className="micro-label">TRAP T-02 · {pest.zone_id || "Z02"}</span><h3>Live observation</h3></div><span className={`pest-status ${pestLive.detection ? (pest.harmful ? "bad" : "good") : "neutral"}`}>{pestLive.detection ? (pest.harmful ? "Attention" : "Observed") : "No event"}</span></div>
                  <div className="pest-observation-main">
                    <div className={`camera-ring ${pestLive.connected ? "pulse" : ""}`}><Camera size={38} /></div>
                    <div><small>Latest verified observation</small><strong>{pestLive.detection ? readableLabel(pest.insect) : "Waiting for camera event"}</strong><p>{pestLive.detection ? pest.field_action : "Keep the yellow sticky trap in the selected crop zone and point the field camera towards it. No manual test is needed."}</p></div>
                  </div>
                  <div className="pest-facts-grid"><span><small>Count / 5 min</small><b>{pestLive.detection ? pest.count_5min : "—"}</b></span><span><small>Vision confidence</small><b>{pestLive.detection ? `${Math.round(pest.vision_confidence * 100)}%` : "—"}</b></span><span><small>Risk</small><b>{pestLive.detection ? pest.severity : "—"}</b></span><span><small>Crop stage</small><b>{profile.growth_stage}</b></span></div>
                </article>

                <article className="panel pest-action-card">
                  <div className="panel-head"><div><span className="micro-label">FARMER ACTION</span><h3>{pestLive.detection ? "What to do now" : "Next field step"}</h3></div></div>
                  <div className={`pest-action-callout ${pestAlarmActive ? "urgent" : ""}`}><ShieldCheck size={20} /><p>{pestLive.detection ? pest.field_action : "No pest treatment is suggested until a verified insect event is received."}</p></div>
                  <div className="pest-context-row"><span><small>Wind now</small><strong>{reading.wind_speed_kmh} km/h</strong></span><span><small>Spray status</small><strong>{spray.spray_allowed ? "Allowed by weather" : "Locked by weather"}</strong></span></div>
                  <button className="outline-button action-record-button" disabled={actionSaving || !pestLive.detection} onClick={() => recordFarmerAction("inspection", `Inspected ${pest.zone_id || "field"} after ${readableLabel(pest.insect, "pest")} alert`)}><CircleCheckBig size={16} /> {actionSaving ? "Saving…" : "Mark field inspection done"}</button>
                  <small className="pest-safety-note">Treatment is never selected automatically. Wind and rain safety stay active before any spraying decision.</small>
                </article>
              </section>

              <section className="panel dual-alarm-console">
                <div className="panel-head"><div><span className="micro-label">DUAL LOCAL ALARM CONTROLLER</span><h3>Your two buzzers have separate jobs</h3><p>Distinct sound patterns let the farmer know whether the problem is a pest or a weather/spray-safety risk without opening the dashboard.</p></div><span className="alarm-controller-badge"><RadioTower size={16} /> ESP32 alarm controller</span></div>
                <div className="dual-alarm-grid">
                  <article className={pestAlarmActive ? "alarm-channel active danger" : "alarm-channel"}><div className="alarm-channel-icon"><Bug size={21} /></div><div><small>BUZZER A · PEST</small><strong>{pestAlarmActive ? "Pest alarm active" : "Pest alarm armed"}</strong><p>{pestAlarmActive ? `${readableLabel(pest.insect)} · ${pest.count_5min} seen in 5 min` : "Triggers only for a verified high-risk harmful insect event."}</p></div><span><b>Pattern</b><em>3 short beeps</em></span></article>
                  <article className={weatherAlarmActive ? "alarm-channel active weather" : "alarm-channel"}><div className="alarm-channel-icon"><Siren size={21} /></div><div><small>BUZZER B · WEATHER / SPRAY</small><strong>{weatherAlarmActive ? "Field safety alarm active" : "Field safety alarm armed"}</strong><p>{weatherAlarmActive ? weatherAlarmReason : "Triggers for high wind or heavy rainfall that makes field work or spraying unsafe."}</p></div><span><b>Pattern</b><em>1 long + 2 short</em></span></article>
                </div>
              </section>

              <section className="pest-delivery-grid">
                <article className="panel delivery-card"><span className="delivery-icon"><BellRing size={20} /></span><div><small>ON-SCREEN ALERT</small><strong>{pestLive.detection && pest.harmful ? "Farmer warning shown" : "Ready"}</strong><p>Appears immediately on the local dashboard after a verified harmful detection.</p></div></article>
                <article className="panel delivery-card"><span className="delivery-icon"><Volume2 size={20} /></span><div><small>LOCAL SOUND</small><strong>{pestAlarmActive ? "Buzzer A triggered" : weatherAlarmActive ? "Buzzer B triggered" : "Both buzzers armed"}</strong><p>Works on the local ESP32 alarm controller and does not require cloud connectivity.</p></div></article>
                <article className="panel delivery-card"><span className="delivery-icon"><Smartphone size={20} /></span><div><small>WHATSAPP · {maskedMobile}</small><strong>{whatsappDeliveryLabel}</strong><p>Harmful pest alerts are sent automatically when consent and internet/provider connectivity are available.</p></div></article>
              </section>
            </>
          )}

          {view === "sabha" && (
            <>
              <section className="sabha-hero">
                <div>
                  <span className="micro-label">
                    {t("offline")} · {tr("fieldDecision")}
                  </span>
                  <h2>{tr("whatDo")}</h2>
                  <p>{tr("reuse")}</p>
                </div>
                <span className="sabha-mode">
                  <WifiOff size={18} /> {t("workingOffline")}
                </span>
              </section>

              <section className="sabha-layout">
                <article className="panel sabha-chat">
                  <div className="sabha-chat-head">
                    <span>
                      <MessageCircle size={22} />
                    </span>
                    <div>
                      <strong>{tr("fieldDecision")} · {t("farm")}</strong>
                      <small>
                        {t("updated")} {sabhaAskedAt.toLocaleTimeString(currentLocale.speech)}
                      </small>
                    </div>
                    <em>{sabhaAnswer.confidence}% {t("confidence")}</em>
                  </div>

                  <div className="sabha-question">
                    <small>{tr("whatDo")}</small>
                    <p>{sabhaQuestion || sabhaPromptFor(sabhaIntent)}</p>
                  </div>

                  <div className={`sabha-answer ${sabhaIntent}`}>
                    <span>{sabhaAnswer.eyebrow}</span>
                    <h3>{sabhaAnswer.verdict}</h3>
                    <p>{sabhaAnswer.action}</p>
                    <div className="sabha-witnesses">
                      {sabhaAnswer.witnesses.map(([name, value, source], index) => (
                        <article key={name}>
                          <b>0{index + 1}</b>
                          <small>{name}</small>
                          <strong>{value}</strong>
                          <em>{source}</em>
                        </article>
                      ))}
                    </div>
                    <footer>
                      <button
                        className="outline-button"
                        onClick={() =>
                          speak(`${sabhaAnswer.verdict}. ${sabhaAnswer.action}`)
                        }
                      >
                        <Volume2 size={17} /> {t("listen")} · {tr("fieldDecision")}
                      </button>
                      <button
                        className="solid-button"
                        onClick={() => setView(sabhaAnswer.nextView)}
                      >
                        {term("open")} · {t("source")} <ChevronRight size={16} />
                      </button>
                    </footer>
                  </div>

                  <div className="sabha-prompts" aria-label={tr("whatDo")}>
                    {(["spray", "zone", "pest", "market", "scheme"] as SabhaIntent[]).map((intent) => {
                      const question = sabhaPromptFor(intent);
                      return (
                      <button
                        key={intent}
                        className={sabhaIntent === intent ? "active" : ""}
                        onClick={() => {
                          setSabhaIntent(intent);
                          setSabhaQuestion("");
                          setSabhaAskedAt(new Date());
                        }}
                      >
                        {question}
                      </button>
                      );
                    })}
                  </div>

                  <form
                    className="sabha-input"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const question = String(form.get("question") || "").trim();
                      if (!question) return;
                      setSabhaQuestion(question);
                      setSabhaIntent(intentFromQuestion(question));
                      setSabhaAskedAt(new Date());
                      event.currentTarget.reset();
                    }}
                  >
                    <MessageCircle size={19} />
                    <input
                      name="question"
                      aria-label={tr("whatDo")}
                      placeholder={`${tr("whatDo")}…`}
                    />
                    <button aria-label={tr("whatDo")} className="solid-button">
                      <Send size={17} /> {t("continue")}
                    </button>
                  </form>
                </article>

                <aside className="panel sabha-context">
                  <span className="micro-label">{t("source")}</span>
                  <h3>{tr("fieldDecision")}</h3>
                  <p>{tr("savedLocal")}</p>
                  <div>
                    <span>
                      <Activity />
                      <b>{t("weather")} · {t("lastPacket")}</b>
                      <em className={reading.source === "live" || reading.source === "ble" ? "live" : "demo"}>
                        {reading.source === "live" || reading.source === "ble" ? t("live") : t("offline")}
                      </em>
                    </span>
                    <span>
                      <Bug />
                      <b>{t("pest")} · {term("camera")}</b>
                      <em className={pestLive.connected ? "live" : "demo"}>
                        {pestLive.connected ? t("live") : t("offline")}
                      </em>
                    </span>
                    <span>
                      <MapPinned />
                      <b>{zones.length} · {t("zones")}</b>
                      <em>{t("profile")} + {t("source")}</em>
                    </span>
                    <span>
                      <ShoppingBasket />
                      <b>{safePrices.length} · {t("market")}</b>
                      <em>{t("offline")} · {t("source")}</em>
                    </span>
                    <span>
                      <Leaf />
                      <b>{safeSchemes.length} · {t("schemes")}</b>
                      <em>{t("eligible")} · {t("source")}</em>
                    </span>
                  </div>
                  <div className="sabha-guardrail">
                    <ShieldCheck size={19} />
                    <p>
                      <strong>{t("safety")}:</strong> {tr("noPesticide")} {tr("schemeNotice")}
                    </p>
                  </div>
                </aside>
              </section>
            </>
          )}

          {view === "guide" && (
            <>
              <section className="guide-hero enhanced-guide-hero">
                <div>
                  <span className="micro-label">ADAPTIVE FARM LEARNING</span>
                  <h2>{guideLabel(locale).hero}</h2>
                  <p>
                    Guidance now combines the farmer profile, current sensor
                    readings and the actions recorded from the field. It changes
                    as the farmer irrigates, sprays, inspects pests or updates
                    the crop cycle.
                  </p>
                </div>
                <div className="guide-live-badge">
                  <Activity size={18} />
                  <span>
                    <small>Current recommendation</small>
                    <strong>{getGuideContent(locale, recommendedTopic).title.split(" · ")[0]}</strong>
                  </span>
                </div>
              </section>

              <section className="guide-command-grid">
                <article className="panel guide-reason-card">
                  <span className="micro-label">WHY THIS IS RECOMMENDED</span>
                  <h3>Built from your field, not a generic tip</h3>
                  <div className="guide-evidence-grid">
                    <span><small>Crop</small><strong>{profile.crop}{profile.crop_variety ? ` · ${profile.crop_variety}` : ""}</strong></span>
                    <span><small>Stage</small><strong>{profile.growth_stage}</strong></span>
                    <span><small>Soil</small><strong>{profile.soil_type || "Not added"} · {reading.soil_moisture_pct}%</strong></span>
                    <span><small>Wind</small><strong>{reading.wind_speed_kmh} km/h · {Math.round(reading.wind_direction_deg)}°</strong></span>
                    <span><small>Latest farmer action</small><strong>{latestFarmerAction ? readableLabel(latestFarmerAction.action_type) : "No action recorded yet"}</strong></span>
                    <span><small>Pest status</small><strong>{pestLive.detection ? readableLabel(pest.insect) : "No live detection"}</strong></span>
                  </div>
                  <p className="guide-reason-text">
                    {latestFarmerAction?.action_type === "irrigation" && reading.soil_moisture_pct < 30
                      ? "You recently recorded irrigation, but soil moisture is still low. Check emitter flow, wetting depth and the sensor zone before adding more water."
                      : latestFarmerAction?.action_type === "spray" && reading.wind_speed_kmh > 12
                        ? "A spray action is in the recent history and wind is currently elevated. Review wind direction and wait for a safer spray window before any repeat application."
                        : pest.harmful && latestFarmerAction?.action_type !== "inspection"
                          ? "A harmful insect event is present and no recent crop inspection is recorded. Field verification is the next useful action."
                          : `The strongest current signal is ${getGuideContent(locale, recommendedTopic).title.split(" · ")[0].toLowerCase()}, based on the latest field readings and your saved crop profile.`}
                  </p>
                </article>

                <article className="panel farmer-action-recorder">
                  <span className="micro-label">FARMER ACTION LOG</span>
                  <h3>Tell the system what you actually did</h3>
                  <p>
                    Recording field work makes the next recommendation more
                    useful. These entries are stored locally and also sync to
                    the FastAPI action log when the local server is available.
                  </p>
                  <div className="action-button-grid">
                    <button disabled={actionSaving} onClick={() => recordFarmerAction("irrigation", "Farmer recorded irrigation from Learn & Understand")}>
                      <Droplets size={18} /><span><strong>I irrigated</strong><small>Save soil reading now</small></span>
                    </button>
                    <button disabled={actionSaving} onClick={() => recordFarmerAction("inspection", "Farmer inspected crop/pest condition")}>
                      <Bug size={18} /><span><strong>I inspected crop</strong><small>Save pest context now</small></span>
                    </button>
                    <button disabled={actionSaving || !spray.spray_allowed} onClick={() => recordFarmerAction("spray", "Farmer recorded a spray action after checking Spray Safety")}>
                      <ShieldCheck size={18} /><span><strong>I sprayed</strong><small>{spray.spray_allowed ? "Save wind + weather context" : "Locked by Spray Safety"}</small></span>
                    </button>
                    <button disabled={actionSaving} onClick={() => recordFarmerAction("fertilizer", "Farmer recorded fertilizer application")}>
                      <Sprout size={18} /><span><strong>I applied fertilizer</strong><small>Save field context</small></span>
                    </button>
                  </div>
                </article>
              </section>

              <section className="guide-layout enhanced-guide-layout">
                <aside className="panel guide-topics">
                  <div className="panel-head">
                    <div>
                      <span className="micro-label">FIELD TOPICS</span>
                      <h3>Learn one decision at a time</h3>
                    </div>
                  </div>
                  <button className={`guide-recommended ${guideTopic === recommendedTopic ? "active" : ""}`} onClick={() => setGuideTopic(recommendedTopic)}>
                    <span><Lightbulb size={19} /></span>
                    <div>
                      <strong>{getGuideContent(locale, recommendedTopic).title}</strong>
                      <small>Recommended from current sensor + profile + action context</small>
                    </div>
                    <ArrowRight size={16} />
                  </button>
                  <div className="guide-topic-list separated">
                    {(Object.keys(guideContent) as GuideTopic[]).map((topic) => (
                      <button key={topic} className={guideTopic === topic ? "active" : ""} onClick={() => setGuideTopic(topic)}>
                        <span>{getGuideContent(locale, topic).title.split(" · ")[0]}</span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                </aside>

                <article className="panel guide-detail enhanced-guide-detail">
                  <div className="guide-detail-head">
                    <div>
                      <span className="micro-label">{guideLabel(locale).inLanguage}</span>
                      <h2>{activeGuide.title}</h2>
                    </div>
                    <button className="outline-button" onClick={() => speak(`${activeGuide.title}. ${activeGuide.simple}. ${activeGuide.steps.join(". ")}`)}>
                      <Volume2 size={17} /> {guideLabel(locale).listen}
                    </button>
                  </div>

                  <div className="guide-block guide-simple">
                    <strong>{guideLabel(locale).simple}</strong>
                    <p>{activeGuide.simple}</p>
                  </div>

                  <div className="guide-two-col spacious">
                    <div className="guide-block">
                      <span>{guideLabel(locale).why}</span>
                      <p>{activeGuide.why}</p>
                    </div>
                    <div className="guide-block">
                      <span>{guideLabel(locale).now}</span>
                      <ol>{activeGuide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                    </div>
                  </div>

                  <div className="guide-current-reading">
                    <div><Activity size={18} /><span><small>Temperature</small><strong>{reading.temperature_c}°C</strong></span></div>
                    <div><Droplets size={18} /><span><small>Humidity</small><strong>{reading.humidity_pct}%</strong></span></div>
                    <div><RadioTower size={18} /><span><small>Wind</small><strong>{reading.wind_speed_kmh} km/h · {Math.round(reading.wind_direction_deg)}°</strong></span></div>
                    <div><Sprout size={18} /><span><small>Soil moisture</small><strong>{reading.soil_moisture_pct}%</strong></span></div>
                  </div>

                  <div className="guide-avoid">
                    <ShieldCheck size={18} />
                    <div><strong>{guideLabel(locale).keep}</strong><p>{activeGuide.avoid}</p></div>
                  </div>

                  <div className="guide-video">
                    <div>
                      <PlayCircle size={25} />
                      <div>
                        <strong>{locale === "hi" ? "वीडियो से सीखें" : "Learn with a video"}</strong>
                        <p>{locale === "hi" ? "Internet उपलब्ध होने पर इसी विषय पर किसान-अनुकूल वीडियो खोजें।" : "When internet is available, search farmer-friendly learning material for this topic."}</p>
                      </div>
                    </div>
                    <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${activeGuide.search} ${currentLocale.name}`)}`} target="_blank" rel="noreferrer">
                      <PlayCircle size={16} /> {guideLabel(locale).youtube}
                    </a>
                  </div>
                </article>
              </section>

              <section className="panel action-history-panel">
                <div className="panel-head">
                  <div>
                    <span className="micro-label">RECENT FARMER ACTIVITY</span>
                    <h3>What the recommendation engine has seen</h3>
                  </div>
                  <span className="tag">{farmerActions.length} recorded</span>
                </div>
                {farmerActions.length ? (
                  <div className="action-history-list">
                    {farmerActions.slice(0, 6).map((action) => (
                      <div key={action.id}>
                        <span className="action-dot" />
                        <div>
                          <strong>{readableLabel(action.action_type)}</strong>
                          <small>{action.note || `${action.metric}: ${action.before_value}${action.unit}`}</small>
                        </div>
                        <time>{new Date(action.started_at || action.created_at || 0).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-action-history">
                    <ListChecks size={22} />
                    <p>No farmer action has been recorded yet. Use the action buttons above after real field work; the next recommendation will use it.</p>
                  </div>
                )}
              </section>
            </>
          )}

          {view === "heat" && (
            <>
              <section className={`heat-hero ${heatStatus}`}>
                <div>
                  <span className="micro-label">LIVE FIELD HEAT ASSESSMENT</span>
                  <h2>{heatStatusLabel}</h2>
                  <p>
                    {profile.crop} · {profile.growth_stage}. The decision uses the latest field temperature,
                    humidity, soil moisture and wind reading.
                  </p>
                </div>
                <div className="heat-hero-reading">
                  <ThermometerSun size={28} />
                  <strong>{reading.temperature_c.toFixed(1)}°C</strong>
                  <small>measured air temperature</small>
                </div>
              </section>

              <section className="heat-metric-grid">
                <article className="panel heat-metric">
                  <span>Apparent temperature</span>
                  <strong>{heatIndex.toFixed(1)}°C</strong>
                  <small>NOAA/NWS heat-index method using temperature + humidity</small>
                </article>
                <article className="panel heat-metric">
                  <span>Relative humidity</span>
                  <strong>{reading.humidity_pct.toFixed(0)}%</strong>
                  <small>High humidity can reduce evaporative cooling</small>
                </article>
                <article className="panel heat-metric">
                  <span>Root-zone moisture</span>
                  <strong>{reading.soil_moisture_pct.toFixed(0)}%</strong>
                  <small>{reading.soil_moisture_pct < 30 ? "Low—inspect the root zone now" : "Currently above the configured dry limit"}</small>
                </article>
                <article className="panel heat-metric">
                  <span>Wind</span>
                  <strong>{reading.wind_speed_kmh.toFixed(1)} km/h</strong>
                  <small>From {windDirection} · {Math.round(reading.wind_direction_deg)}°</small>
                </article>
              </section>

              <section className="heat-detail-grid">
                <article className="panel heat-actions">
                  <span className="micro-label">RECOMMENDED FIELD ACTION</span>
                  <h3>{heatStatus === "safe" ? "Continue routine observation" : "Inspect the crop during the hottest period"}</h3>
                  <ul>
                    <li>Check leaves for wilting, rolling, scorching or flower drop.</li>
                    <li>{reading.soil_moisture_pct < 30 ? "Verify the soil sensor and irrigate according to crop stage and root-zone need." : "Do not irrigate from temperature alone; verify root-zone moisture and crop condition first."}</li>
                    <li>Avoid spraying and strenuous field work during peak heat.</li>
                    <li>Compare morning and afternoon readings before changing irrigation.</li>
                  </ul>
                  <div className="heat-buttons">
                    <button className="solid-button" onClick={() => setView("guide")}><BookOpen size={16} /> Open crop guidance</button>
                    <button className="outline-button" onClick={() => setView("safety")}><ShieldCheck size={16} /> Check spray safety</button>
                  </div>
                </article>

                <article className="panel heat-method">
                  <span className="micro-label">HOW THE STATUS IS DECIDED</span>
                  <h3>Transparent limits</h3>
                  <div><span>Normal</span><strong>Below {heatWarningC}°C</strong></div>
                  <div><span>Watch</span><strong>{heatWarningC}°C to below {heatDangerC}°C</strong></div>
                  <div><span>Danger</span><strong>{heatDangerC}°C or higher</strong></div>
                  <p>
                    Heat index describes apparent heat for people; it is supporting context, not a direct leaf-temperature measurement.
                    Crop response varies by variety, growth stage, sunlight and water status. Use a calibrated canopy or infrared sensor for direct plant-temperature decisions, and validate configured crop limits with an agronomist before field deployment.
                  </p>
                  <footer>
                    <StatusChip source={reading.source} online={online} t={t} />
                    <span>Updated {new Date(reading.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  </footer>
                </article>
              </section>
            </>
          )}

          {view === "weather" && (
            <>
              <section className={`warning-page-hero ${earlyWarning.status}`}>
                <div><span className="micro-label">LOCALIZED EARLY WARNING · {earlyWarning.horizon_minutes} MINUTES</span><h2>{earlyWarning.status === "danger" ? "Danger projected" : earlyWarning.status === "warning" ? "Conditions need watching" : "No configured limit projected"}</h2><p>{earlyWarning.summary}</p></div>
                <div><strong>{earlyWarning.evidence_packets}</strong><small>local evidence packets</small></div>
              </section>
              <section className="warning-comparison-grid">
                {[
                  ["Temperature", "temperature_c", "°C"],
                  ["Humidity", "humidity_pct", "%"],
                  ["Rainfall", "rainfall_mm_h", "mm/h"],
                  ["Wind speed", "wind_speed_kmh", "km/h"],
                ].map(([label, key, unit]) => (
                  <article className="panel warning-comparison" key={key}>
                    <span>{label}</span><div><small>NOW</small><strong>{Number(earlyWarning.current[key] ?? 0).toFixed(1)} {unit}</strong></div><ArrowRight /><div><small>PROJECTED</small><strong>{Number(earlyWarning.projected[key] ?? 0).toFixed(1)} {unit}</strong></div>
                  </article>
                ))}
              </section>
              <section className="warning-bottom-grid">
                <article className="panel warning-risks"><span className="micro-label">PROJECTED ALERTS</span><h3>What may need action</h3>{earlyWarning.risks.length ? earlyWarning.risks.map((risk) => <div key={risk.type}><span className={`risk-mark ${risk.severity}`} /><p><strong>{risk.label}</strong><small>{risk.message}</small></p></div>) : <p className="no-risk"><CircleCheckBig size={19} /> No heat, heavy rain or high-wind threshold is projected to be crossed.</p>}</article>
                <article className="panel warning-method"><span className="micro-label">EXPLAINABLE METHOD</span><h3>Local trend, not a black box</h3><p>The backend measures the change across the latest local packets, projects that trend for {earlyWarning.horizon_minutes} minutes, and evaluates the projected values against configured thresholds.</p><dl><div><dt>Source</dt><dd>{reading.source.toUpperCase()}</dd></div><div><dt>Zone</dt><dd>{earlyWarning.zone_id}</dd></div><div><dt>Wind direction</dt><dd>{windDirection}</dd></div><div><dt>Action channel</dt><dd>Dashboard + buzzer</dd></div></dl></article>
              </section>
              <section className="forecast-section panel">
                <div className="forecast-heading"><div><span className="micro-label">EXTERNAL FORECAST · NEXT 24 HOURS</span><h3>{forecast.provider} forecast for {profile.village}</h3><p>{forecast.forecast_type}</p></div><span className="tag">{forecast.cached ? "15 min cache" : "fresh request"}</span></div>
                {forecast.hours.length ? (
                  <div className="forecast-hours">
                    {forecast.hours.slice(0, 8).map((hour) => <article key={hour.time}><time>{new Date(hour.time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</time><strong>{hour.temperature_c.toFixed(0)}°C</strong><span>Rain {hour.precipitation_probability_pct.toFixed(0)}% · {hour.precipitation_mm.toFixed(1)} mm</span><span>Wind {hour.wind_speed_kmh.toFixed(0)} km/h · {windDirectionLabel(hour.wind_direction_deg).split(" · ")[0]}</span><small>Gust {hour.wind_gust_kmh.toFixed(0)} km/h · feels {hour.apparent_temperature_c.toFixed(0)}°C</small></article>)}
                  </div>
                ) : <p className="forecast-unavailable">Forecast is unavailable right now. KhetOS continues using local sensor readings and offline trend warnings.</p>}
              </section>
            </>
          )}

          {false && view === "weather" && (
            <>
              <section className={`jury-banner ${weatherJury.verdict}`}>
                <div>
                  <span className="micro-label">
                    MAUSAM JURY · MULTI-MODEL CHECK
                  </span>
                  <h2>
                    {weatherJury.verdict === "agree"
                      ? "All sources agree"
                      : "Forecast disagreement detected"}
                  </h2>
                  <p>{weatherJury.recommendation}</p>
                </div>
                <div>
                  <strong>{weatherJury.confidence}</strong>
                  <small>% {t("confidence")}</small>
                </div>
              </section>
              <div className="model-grid">
                {safeModels.map((m) => (
                  <article className="panel model-card" key={m.name}>
                    <span>
                      {(m.name ?? "WX").slice(0, 2).toLocaleUpperCase()}
                    </span>
                    <small>{m.source}</small>
                    <h3>{m.name}</h3>
                    <dl>
                      <div>
                        <dt>24h rain</dt>
                        <dd>{m.rain_24h_mm} mm</dd>
                      </div>
                      <div>
                        <dt>Max temp</dt>
                        <dd>{m.max_temp_c}°C</dd>
                      </div>
                      <div>
                        <dt>Max wind</dt>
                        <dd>{m.max_wind_kmh} km/h</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <article className="panel memory-card">
                <div>
                  <Database />
                  <div>
                    <span className="micro-label">FARM MEMORY</span>
                    <h3>Local correction grows with every verified day</h3>
                    <p>
                      Forecast error is stored beside sensor readings and
                      becomes an offline farm-specific bias.
                    </p>
                  </div>
                </div>
                <div className="memory-metrics">
                  <span>
                    <small>Days learned</small>
                    <strong>18</strong>
                  </span>
                  <span>
                    <small>Rain bias</small>
                    <strong>-1.8 mm</strong>
                  </span>
                  <span>
                    <small>Temperature bias</small>
                    <strong>+0.7°C</strong>
                  </span>
                  <span>
                    <small>Local accuracy</small>
                    <strong>86%</strong>
                  </span>
                </div>
              </article>
            </>
          )}

          {view === "safety" && (
            <section className="safety-layout">
              <article
                className={`spray-lock ${spray.spray_allowed ? "open" : "locked"}`}
              >
                <div className="lock-icon">
                  <ShieldCheck />
                </div>
                <span className="micro-label">SENSOR-SAFE SPRAY LOCK</span>
                <h2>{spray.spray_allowed ? t("safe") : t("unsafe")}</h2>
                <p>{spray.reason}</p>
                <button
                  onClick={() =>
                    speak(
                      `${spray.spray_allowed ? t("safe") : t("unsafe")}. ${spray.reason}`,
                    )
                  }
                >
                  <Volume2 size={17} />
                  {t("listen")}
                </button>
                <div className="relay-state">
                  <span>RELAY OUTPUT</span>
                  <strong>{spray.spray_allowed ? "ENABLED" : "BLOCKED"}</strong>
                  <small>Final interlock runs locally on ESP32</small>
                </div>
              </article>
              <article className="panel checks-panel">
                <div className="panel-head">
                  <div>
                    <span className="micro-label">RULE ENGINE</span>
                    <h3>Safety checks</h3>
                  </div>
                  <span className="tag">1 sec loop</span>
                </div>
                {safeChecks.map((c) => (
                  <div className="check" key={c.label}>
                    <span className={c.pass ? "pass" : "fail"}>
                      {c.pass ? "✓" : "×"}
                    </span>
                    <strong>{c.label}</strong>
                    <em>{c.value}</em>
                  </div>
                ))}
                <div className="safety-foot">
                  <p>
                    Unsafe weather or a stale critical sensor keeps the relay
                    blocked.
                  </p>
                </div>
              </article>
            </section>
          )}

          {view === "proof" && (
            <article className="panel ledger">
              <div className="panel-head">
                <div>
                  <span className="micro-label">
                    MAUSAM SABOOT · FAIR WORK PROOF
                  </span>
                  <h2>Signed local event ledger</h2>
                  <p>
                    Reading, warning and acknowledgement are stored together.
                  </p>
                </div>
                <button className="outline-button" onClick={exportProof}>
                  Download CSV
                </button>
              </div>
              <div className="proof-summary">
                <span>
                  <small>Records today</small>
                  <strong>1,246</strong>
                </span>
                <span>
                  <small>Warnings</small>
                  <strong>3</strong>
                </span>
                <span>
                  <small>Acknowledged</small>
                  <strong>2</strong>
                </span>
                <span>
                  <small>Pending sync</small>
                  <strong>{online ? 0 : 17}</strong>
                </span>
              </div>
              <div className="ledger-table">
                <div className="table-head">
                  <span>Time</span>
                  <span>Event</span>
                  <span>Zone</span>
                  <span>Evidence</span>
                  <span>Status</span>
                </div>
                {[
                  [
                    "10:42",
                    spray.title,
                    "Z02",
                    `${reading.wind_speed_kmh} km/h wind`,
                    "Recorded",
                  ],
                  [
                    "09:18",
                    "Heat watch",
                    "Z02",
                    "34.1°C · 71% RH",
                    "Acknowledged",
                  ],
                  [
                    "08:06",
                    "Irrigation completed",
                    "Z01",
                    "Soil 53% → 62%",
                    "Recorded",
                  ],
                  [
                    "06:40",
                    "Nodes synchronized",
                    "Farm",
                    "1,118 packets",
                    "Verified",
                  ],
                ].map((row) => (
                  <div className="table-row" key={row[0]}>
                    {row.map((cell, i) => (
                      <span key={i}>{cell}</span>
                    ))}
                  </div>
                ))}
              </div>
            </article>
          )}

          {view === "schemes" && (
            <>
              <section className="scheme-source-banner">
                <span>
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <strong>Official MahaDBT scheme catalog</strong>
                  <p>
                    Real Government of Maharashtra scheme names and official
                    portal links. Matching uses the saved farmer profile; final
                    approval always remains with MahaDBT.
                  </p>
                </div>
                <b>VERIFIED 18 AUG 2026</b>
              </section>
              <section className="profile-summary">
                <div>
                  <span>{profile.name.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <small>SAVED FARMER PROFILE</small>
                    <strong>{profile.name}</strong>
                    <p>
                      {profile.village}, {profile.district} ·{" "}
                      {profile.land_acres} acres · {profile.crop}
                    </p>
                  </div>
                </div>
                <button onClick={editFarmer}>Edit once</button>
              </section>
              <div className="scheme-grid">
                {safeSchemes.map((s) => (
                  <article className="panel scheme-card" key={s.id}>
                    <div className="match-score">
                      <strong>{s.score}</strong>
                      <span>
                        %<small>MATCH</small>
                      </span>
                    </div>
                    <small>
                      {s.authority} · Official source checked {s.verified_on}
                    </small>
                    <h3>{s.title}</h3>
                    <p>{s.benefit}</p>
                    <div className="reason-list">
                      {(Array.isArray(s.reasons) ? s.reasons : []).map((r) => (
                        <span key={r}>✓ {r}</span>
                      ))}
                    </div>
                    <div className="documents">
                      <small>Likely documents</small>
                      <p>
                        {(Array.isArray(s.documents) ? s.documents : []).join(
                          " · ",
                        )}
                      </p>
                    </div>
                    <div className="scheme-actions">
                      <a href={s.official_url} target="_blank" rel="noreferrer">
                        {t("apply")} on MahaDBT <ChevronRight size={15} />
                      </a>
                      <button
                        onClick={() =>
                          shareOnWhatsApp(
                            "scheme",
                            [
                              "KhetOS · SCHEME SUGGESTION",
                              `Farmer: ${profile.name}`,
                              `Scheme: ${s.title}`,
                              `Profile match: ${s.score}%`,
                              `Benefit: ${s.benefit}`,
                              `Documents to check: ${s.documents.join(", ")}`,
                              `Official MahaDBT link: ${s.official_url}`,
                              "This is a pre-screen, not approval. Verify eligibility on the official portal.",
                            ].join("\n"),
                          )
                        }
                      >
                        <MessageCircle size={15} /> WhatsApp farmer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {shareNotice ? (
                <div className="share-notice">
                  <CircleCheckBig size={18} /> {shareNotice}
                </div>
              ) : null}
              <div className="accuracy-note">
                <ShieldCheck />
                <p>
                  <strong>Eligibility is a pre-screen, not approval.</strong>{" "}
                  Final eligibility stays on the official portal. Cached rules
                  show offline with verification date.
                </p>
              </div>
            </>
          )}

          {view === "cluster" && (
            <>
              <section className="cluster-hero">
                <div>
                  <span className="micro-label">
                    KHET CLUSTER · SHARED SENSOR NETWORK
                  </span>
                  <h2>One weather station. Six nearby farms.</h2>
                  <p>
                    Expensive weather instruments are shared; each plot keeps
                    only soil-specific probes. BLE/LoRa reaches the gateway
                    without mobile internet.
                  </p>
                </div>
                <div className="saving-card">
                  <small>Estimated hardware saving</small>
                  <strong>68%</strong>
                  <span>vs one full station per farm</span>
                </div>
              </section>
              <div className="cluster-map panel">
                <div className="cluster-core">
                  <RadioTower />
                  <strong>EDGE-01</strong>
                  <small>Local gateway</small>
                </div>
                {[
                  "Riya Farm",
                  "Patil Farm",
                  "Jadhav Plot",
                  "Nursery 03",
                  "Local FPO Buyer",
                  "Walk Node",
                ].map((name, i) => (
                  <div className={`cluster-node n${i + 1}`} key={name}>
                    <i />
                    <strong>{name}</strong>
                    <small>
                      {120 + i * 85} m · {i % 2 ? "LoRa" : "BLE"}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === "finance" && (
            <>
              <section className="risk-gate">
                <div>
                  <span className="micro-label">KHARCHA RISK GATE</span>
                  <h2>Will today’s operation recover its cost?</h2>
                  <p>
                    Weather risk becomes rupees before spending on labour,
                    spraying or pumping.
                  </p>
                </div>
                <div className="risk-total">
                  <small>{t("cost")}</small>
                  <strong>₹1,460</strong>
                  <span>today’s spray plan</span>
                </div>
              </section>
              <div className="finance-grid">
                <article className="panel cost-builder">
                  <div className="panel-head">
                    <div>
                      <h3>Operation cost</h3>
                      <p>Two-acre tomato spray</p>
                    </div>
                    <span className="tag">HIGH RISK</span>
                  </div>
                  {[
                    ["Chemical", "₹780"],
                    ["Labour", "₹400"],
                    ["Pump + power", "₹160"],
                    ["Water + travel", "₹120"],
                  ].map(([l, v]) => (
                    <div className="cost-row" key={l}>
                      <span>{l}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                  <div className="cost-result">
                    <span>Delay now</span>
                    <strong>Protect ₹1,460 from likely failed spray</strong>
                  </div>
                </article>
                <article className="panel proof-wallet">
                  <span className="micro-label">MAUSAM PROOF WALLET</span>
                  <h3>Evidence for owner, FPO or lender</h3>
                  <p>
                    Local records explain delay and spend. Farmer controls each
                    export.
                  </p>
                  <div>
                    <span>
                      <small>Verified operations</small>
                      <strong>12</strong>
                    </span>
                    <span>
                      <small>Protected spend</small>
                      <strong>₹8,340</strong>
                    </span>
                  </div>
                  <button className="solid-button" onClick={openReportFlow}>
                    Create consent-based report
                  </button>
                </article>
              </div>
            </>
          )}

          {view === "market" && (
            <>
              <section className="market-hero">
                <div>
                  <span className="micro-label">
                    HAATH MEIN KITNA · NET PRICE TRUTH
                  </span>
                  <h2>
                    ₹{netPrice}
                    <small>/quintal</small>
                  </h2>
                  <p>
                    ₹{modalPrice} mandi − ₹{transport} transport − ₹{commission}{" "}
                    commission − ₹{handling} handling
                  </p>
                </div>
                <div className="sell-band">
                  <small>BHAAV BAND · {t("sellWindow")}</small>
                  <strong>
                    ₹{Math.max(0, netPrice - 140)} — ₹{netPrice + 260}
                  </strong>
                  <span>Scenario range, not guaranteed profit</span>
                </div>
              </section>
              <div className="market-layout">
                <article className="panel prices-panel">
                  <div className="panel-head">
                    <div>
                      <h3>Official mandi comparison</h3>
                      <p>
                        {profile.crop} · {profile.state}
                      </p>
                    </div>
                    <span className="tag">data.gov.in</span>
                  </div>
                  {safePrices.map((p) => (
                    <div className="price-row" key={p.market}>
                      <div>
                        <strong>{p.market}</strong>
                        <small>
                          {p.district} · {p.arrival_date}
                        </small>
                      </div>
                      <span>₹{p.min_price}</span>
                      <strong>₹{p.modal_price}</strong>
                      <span>₹{p.max_price}</span>
                    </div>
                  ))}
                </article>
                <aside className="market-actions">
                  <article className="panel action-card">
                    <BadgeIndianRupee />
                    <span className="micro-label">
                      {t("auction").toUpperCase()}
                    </span>
                    <h3>Nearby farm auction</h3>
                    <p>
                      Verified cluster farmers offer produce to registered
                      buyers.
                    </p>
                    <button onClick={() => setAuctionOpen(true)}>
                      Create auction
                    </button>
                  </article>
                  <article className="panel action-card">
                    <Boxes />
                    <span className="micro-label">SAAJHA LOT</span>
                    <h3>{t("sharedLot")}</h3>
                    <p>Combine small harvests and split costs transparently.</p>
                    <button>Join 1 open lot</button>
                  </article>
                </aside>
              </div>
              {auctionMessage ? (
                <div className="auction-message">
                  <CircleCheckBig size={17} /> {auctionMessage}
                </div>
              ) : null}
              <section className="auction-board panel">
                <div className="panel-head">
                  <div>
                    <span className="micro-label">LIVE LOCAL AUCTIONS</span>
                    <h2>Produce auctions near {profile.village}</h2>
                    <p>
                      Reserve price stays visible. Buyers can compare quantity,
                      village and closing time without hidden commission.
                    </p>
                  </div>
                  <button
                    className="solid-button"
                    onClick={() => setAuctionOpen(true)}
                  >
                    + Add my harvest
                  </button>
                </div>
                <div className="auction-grid">
                  {safeAuctions.length ? (
                    safeAuctions.map((auction) => (
                      <article className="auction-lot" key={auction.id}>
                        <div>
                          <span>{auction.status || "open"}</span>
                          <small>{auction.village}</small>
                        </div>
                        <h3>{auction.commodity}</h3>
                        <dl>
                          <div>
                            <dt>Available lot</dt>
                            <dd>{auction.quantity_kg} kg</dd>
                          </div>
                          <div>
                            <dt>Reserve price</dt>
                            <dd>₹{auction.reserve_price_per_kg}/kg</dd>
                          </div>
                        </dl>
                        <footer>
                          <span>Closes {readableDate(auction.closes_at)}</span>
                          <button
                            onClick={() =>
                              setAuctionMessage(
                                "Buyer interest recorded locally for this lot.",
                              )
                            }
                          >
                            View / register interest
                          </button>
                        </footer>
                      </article>
                    ))
                  ) : (
                    <p className="auction-empty">No open lots yet.</p>
                  )}
                </div>
              </section>
            </>
          )}

          {view === "devices" && (
            <>
              <section className="hardware-hero">
                <div><span className="micro-label">IHAT1 HARDWARE EVIDENCE</span><h2>Node, gateway and logger status</h2><p>Every component is labelled connected, offline, demo or not connected. Missing sensors never appear as live measurements.</p></div>
                <div><strong>{systemHealth.connection === "live" ? "ONLINE" : "LOCAL / CACHED"}</strong><small>{systemHealth.data_source.toUpperCase()} source · {systemHealth.packet_age_seconds.toFixed(0)} sec old</small></div>
              </section>
              <section className="hardware-grid">
                {systemHealth.components.map((component) => (
                  <article className={`panel hardware-card ${component.status}`} key={component.id}>
                    <span className="hardware-status-dot" />
                    <div><small>{component.status.replaceAll("_", " ")}</small><h3>{component.label}</h3><p>{component.detail}</p></div>
                  </article>
                ))}
              </section>
              <section className="hardware-bottom-grid">
                <article className="panel logger-proof">
                  <Database size={24} /><div><span className="micro-label">OFFLINE DATA LOGGER</span><h3>{systemHealth.logger.telemetry_records} telemetry packets saved</h3><p>{systemHealth.logger.event_records} decision records · {systemHealth.logger.format} · continues when internet fails</p></div>
                </article>
                <article className="panel actuator-proof">
                  <Siren size={24} /><div><span className="micro-label">PHYSICAL OUTPUT</span><h3>Buzzer {systemHealth.actuator.buzzer_active ? "active" : "standby"}</h3><p>Pattern: {systemHealth.actuator.buzzer_pattern.replaceAll("_", " ")} · spray relay {systemHealth.actuator.spray_relay_locked ? "locked" : "ready"}</p></div>
                </article>
              </section>
            </>
          )}

          {view === "profile" && (
            <section className="panel profile-page">
              <div className="panel-head">
                <div>
                  <span className="micro-label">
                    SINGLE SOURCE OF FARMER DATA
                  </span>
                  <h2>{t("profile")}</h2>
                  <p>
                    Edit the farm location, crop and growth stage used by maps,
                    localized alerts and crop-specific limits.
                  </p>
                </div>
                <div className="profile-account-actions">
                  <button className="outline-button" onClick={editFarmer}>
                    Edit profile
                  </button>
                  <button className="outline-button" onClick={addFarmer}>
                    Add farmer
                  </button>
                  <button className="outline-button" onClick={logoutFarmer}>
                    Switch farmer
                  </button>
                </div>
              </div>
              <div className="profile-detail">
                <span>
                  <small>Name</small>
                  <strong>{profile.name}</strong>
                </span>
                <span>
                  <small>Location</small>
                  <strong>
                    {profile.village}, {profile.district}
                  </strong>
                </span>
                <span>
                  <small>Holding</small>
                  <strong>
                    {profile.land_acres} acres · {profile.ownership}
                  </strong>
                </span>
                <span>
                  <small>Crop</small>
                  <strong>
                    {profile.crop} · {profile.growth_stage}
                  </strong>
                </span>
                <span>
                  <small>Irrigation</small>
                  <strong>{profile.irrigation}</strong>
                </span>
                <span>
                  <small>Internal record ID</small>
                  <strong>{profile.id}</strong>
                </span>
                <span>
                  <small>AgriStack status</small>
                  <strong>
                    {profile.has_farmer_id && profile.agristack_farmer_id
                      ? profile.agristack_farmer_id
                      : "Not supplied"}
                  </strong>
                </span>
              </div>
              <section className="farm-report-card">
                <div className="farm-report-head">
                  <span>
                    <ReceiptIndianRupee size={22} />
                  </span>
                  <div>
                    <small>REGISTERED-NUMBER FARM REPORT</small>
                    <h3>Send today&apos;s complete farm summary</h3>
                    <p>
                      Prepared from the saved profile, latest sensor packet,
                      spray lock, insect watch, scheme match and market costs.
                    </p>
                  </div>
                  <b>{phoneDigits ? maskedMobile : "NUMBER REQUIRED"}</b>
                </div>
                <div className="report-preview">
                  <span>
                    <small>Microclimate</small>
                    <strong>
                      {reading.temperature_c}°C · {reading.humidity_pct}% RH
                    </strong>
                  </span>
                  <span>
                    <small>Soil &amp; wind</small>
                    <strong>
                      {reading.soil_moisture_pct}% · {reading.wind_speed_kmh} km/h
                    </strong>
                  </span>
                  <span>
                    <small>Spray lock</small>
                    <strong>{spray.spray_allowed ? "SAFE" : "LOCKED"}</strong>
                  </span>
                  <span>
                    <small>Insect watch</small>
                    <strong>{readableLabel(pest.insect)}</strong>
                  </span>
                  <span>
                    <small>Top scheme</small>
                    <strong>{topScheme.title}</strong>
                  </span>
                  <span>
                    <small>Net mandi estimate</small>
                    <strong>₹{netPrice}/quintal</strong>
                  </span>
                </div>
                <div className="report-actions">
                  <p>
                    The farmer reviews and confirms the WhatsApp message. No
                    report is sent silently.
                  </p>
                  <button
                    className="solid-button"
                    onClick={openReportFlow}
                  >
                    <MessageCircle size={17} /> Send full report on WhatsApp
                  </button>
                </div>
              </section>
              {shareNotice ? (
                <div className="share-notice">
                  <CircleCheckBig size={18} /> {shareNotice}
                </div>
              ) : null}
              <div className="privacy-card">
                <ShieldCheck />
                <div>
                  <strong>Consent and privacy</strong>
                  <p>
                    Government identity numbers are not requested for this
                    prototype. The local Farmer ID is only an internal project
                    identifier and is not an official government ID.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
      {reportOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            className="auction-modal consent-report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consent-report-title"
          >
            <div className="auction-modal-head">
              <div>
                <span className="micro-label">CONSENT VERIFICATION</span>
                <h2 id="consent-report-title">Create farmer-controlled report</h2>
                <p>
                  {profile.name} · {maskedMobile}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close report dialog"
                onClick={() => setReportOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="consent-summary">
              <span>
                <CircleCheckBig size={16} />
                Latest sensor, spray, pest, scheme and market summary
              </span>
              <span>
                <ShieldCheck size={16} />
                Government identity numbers are not included
              </span>
              <span>
                <Smartphone size={16} />
                WhatsApp opens only after consent verification
              </span>
            </div>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={reportConsent}
                onChange={(event) => {
                  setReportConsent(event.target.checked);
                  setReportStatus("idle");
                }}
              />
              <span>
                I confirm that the farmer has reviewed the report purpose and
                consented to prepare it for {maskedMobile}.
              </span>
            </label>
            {reportStatus === "verifying" ? (
              <p className="consent-status">Verifying consent handshake…</p>
            ) : null}
            {reportStatus === "verified" ? (
              <p className="consent-status success">
                Consent verified. WhatsApp is ready for the farmer&apos;s final
                Send confirmation.
              </p>
            ) : null}
            {reportStatus === "error" ? (
              <p className="consent-status error">
                A valid registered mobile number is required. Update the Farmer
                Profile and try again.
              </p>
            ) : null}
            <button
              className="solid-button"
              type="button"
              disabled={!reportConsent || reportStatus === "verifying"}
              onClick={confirmConsentReport}
            >
              <ShieldCheck size={17} />
              {reportStatus === "verifying"
                ? "Verifying…"
                : "Verify consent and prepare report"}
            </button>
          </section>
        </div>
      ) : null}
      {auctionOpen ? (
        <div className="modal-backdrop" role="presentation">
          <form className="auction-modal" onSubmit={submitAuction}>
            <div className="auction-modal-head">
              <div>
                <span className="micro-label">NEARBY FARM AUCTION</span>
                <h2>Offer your harvest</h2>
                <p>
                  {profile.crop} · {profile.village}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close auction form"
                onClick={() => setAuctionOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <label>
              <span>Quantity available (kg)</span>
              <input
                min="1"
                required
                type="number"
                value={auctionForm.quantity_kg}
                onChange={(event) =>
                  setAuctionForm((form) => ({
                    ...form,
                    quantity_kg: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>Minimum acceptable price (₹/kg)</span>
              <input
                min="1"
                step="0.5"
                required
                type="number"
                value={auctionForm.reserve_price_per_kg}
                onChange={(event) =>
                  setAuctionForm((form) => ({
                    ...form,
                    reserve_price_per_kg: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>Auction closing time</span>
              <input
                required
                type="datetime-local"
                value={auctionForm.closes_at}
                onChange={(event) =>
                  setAuctionForm((form) => ({
                    ...form,
                    closes_at: event.target.value,
                  }))
                }
              />
            </label>
            <div className="auction-summary">
              <span>Estimated minimum lot value</span>
              <strong>
                ₹
                {Math.round(
                  auctionForm.quantity_kg * auctionForm.reserve_price_per_kg,
                ).toLocaleString("en-IN")}
              </strong>
            </div>
            <button className="solid-button" disabled={auctionSaving}>
              {auctionSaving ? "Publishing…" : "Publish auction"}
            </button>
            <small className="offline-note">
              Works offline: the lot is stored on this device and syncs when the
              local gateway or internet returns.
            </small>
          </form>
        </div>
      ) : null}
    </div>
  );
}
