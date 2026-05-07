export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest k stations from a list. Naive O(n) — 3,335 entries is fast enough. */
export function nearestStations<T extends LatLng>(from: LatLng, stations: T[], k = 1): T[] {
  return stations
    .map((s) => ({ s, d: haversineKm(from, s) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((x) => x.s);
}

/** Walking minutes at 4 km/h. */
export function walkingMinutes(km: number): number {
  return (km / 4) * 60;
}

/** Cycling minutes at 15 km/h (Ttareungi default cruising speed). */
export function cyclingMinutes(km: number): number {
  return (km / 15) * 60;
}

/** Format meters → "X.X km" or "Y m" depending on scale. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Format minutes → "X min" or "Y h Z min". */
export function formatMinutes(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}
