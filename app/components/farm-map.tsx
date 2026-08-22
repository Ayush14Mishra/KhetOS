"use client";

import { useMemo } from "react";
import type { Telemetry, Zone } from "../lib/types";
export default function FarmMap({
  latitude,
  longitude,
  zones,
  reading,
}: {
  latitude: number;
  longitude: number;
  zones: Zone[];
  reading: Telemetry;
}) {
  const mapUrl = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const coordinates = `${latitude},${longitude}`;
    // Maps Embed API is used when a key is configured; the public query embed
    // remains as an offline/demo-safe fallback so the farm page never breaks.
    if (key) {
      return `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(key)}&center=${latitude},${longitude}&zoom=17&maptype=satellite`;
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(coordinates)}&z=17&t=k&output=embed`;
  }, [latitude, longitude]);
  const externalMapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <div className="farm-map-frame">
      <iframe
        key={`${latitude}-${longitude}`}
        className="google-farm-map"
        title="Google Maps · Farm location"
        src={mapUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <div className="map-caption">
        <span>
          <strong>Configured farm location</strong>
          <small>
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
            {" · "}Dynamic Google Maps
          </small>
        </span>
        <a href={externalMapUrl} target="_blank" rel="noreferrer">
          Open in Google Maps
        </a>
      </div>
      <section className="campus-zone-panel" aria-label="Acropolis campus monitoring zones">
        <div className="campus-zone-heading">
          <div><span className="micro-label">ACROPOLIS CAMPUS · 3 MONITORING ZONES</span><strong>Each packet is tagged to the ESP32&apos;s physical zone ID</strong></div>
          <small>Only a zone with an ESP32 packet is marked live.</small>
        </div>
        <div className="campus-zone-grid">
          {zones.map((zone, index) => {
            const active = zone.id === reading.zone_id;
            return <article className={`campus-zone ${active ? "active" : ""}`} key={zone.id}>
              <span>Zone {index + 1}</span>
              <strong>{zone.name}</strong>
              <small>{zone.id} · {active ? "LIVE SENSOR PACKET" : "NODE NOT REPORTING"}</small>
              {active ? <p>{reading.temperature_c}°C · {reading.humidity_pct}% RH · soil {reading.soil_moisture_pct}%</p> : <p>Place an ESP32 here and set its <code>ZONE_ID</code> to {zone.id}.</p>}
            </article>;
          })}
        </div>
      </section>
    </div>
  );
}
