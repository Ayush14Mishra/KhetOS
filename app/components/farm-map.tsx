"use client";

import { useMemo } from "react";
export default function FarmMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
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
    </div>
  );
}
