"use client";

import { useCallback, useEffect, useState } from "react";

export type LocStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

export interface GeolocationState {
  origin: { lat: number; lng: number };
  locStatus: LocStatus;
  /** Reported accuracy radius in meters; null while we don't have a real fix. */
  accuracyM: number | null;
  /** True when accuracyM > 1 km — WiFi-only fixes on laptops routinely land
   *  here and the map shouldn't pretend it's the user's exact position. */
  lowAccuracy: boolean;
  requestLocation: () => void;
}

const LOW_ACCURACY_THRESHOLD_M = 1000;

export function useGeolocation(
  fallback: { lat: number; lng: number } = { lat: 37.5665, lng: 126.978 },
): GeolocationState {
  const [origin, setOrigin] = useState(fallback);
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [accuracyM, setAccuracyM] = useState<number | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocStatus("unsupported");
      return;
    }
    setLocStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracyM(pos.coords.accuracy ?? null);
        setLocStatus("granted");
      },
      () => setLocStatus("denied"),
      // enableHighAccuracy: true so Chrome prefers GPS/wifi-positioning over
      // its cached IP-derived guess. maximumAge: 0 disables the stale-cache
      // return path that was sending laptop users to Seoul Forest after their
      // first session at a different network. 12 s timeout gives Android GPS
      // a beat to converge.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  const lowAccuracy = locStatus === "granted" && accuracyM !== null && accuracyM > LOW_ACCURACY_THRESHOLD_M;

  return { origin, locStatus, accuracyM, lowAccuracy, requestLocation };
}
