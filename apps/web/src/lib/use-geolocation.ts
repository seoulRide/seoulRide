"use client";

import { useCallback, useEffect, useState } from "react";

export type LocStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

export interface GeolocationState {
  origin: { lat: number; lng: number };
  locStatus: LocStatus;
  requestLocation: () => void;
}

export function useGeolocation(
  fallback: { lat: number; lng: number } = { lat: 37.5665, lng: 126.978 },
): GeolocationState {
  const [origin, setOrigin] = useState(fallback);
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocStatus("unsupported");
      return;
    }
    setLocStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("granted");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  return { origin, locStatus, requestLocation };
}
