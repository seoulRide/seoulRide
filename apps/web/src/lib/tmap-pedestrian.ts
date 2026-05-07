import "server-only";
import type { RouteResponse } from "./types";

interface TmapFeature {
  type: "Feature";
  geometry:
    | { type: "Point"; coordinates: [number, number] }
    | { type: "LineString"; coordinates: [number, number][] };
  properties: Record<string, unknown> & {
    totalDistance?: number;
    totalTime?: number;
  };
}

interface TmapResponse {
  type: "FeatureCollection";
  features: TmapFeature[];
}

const ENDPOINT = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json";

/**
 * Call TMAP's 보행자 경로 안내 API. Returns null when the API key is
 * absent (caller should fall back to straight line).
 */
export async function tmapPedestrianRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteResponse | null> {
  const key = process.env.TMAP_APP_KEY;
  if (!key) return null;

  const body = {
    startX: String(from.lng),
    startY: String(from.lat),
    startName: "Origin",
    endX: String(to.lng),
    endY: String(to.lat),
    endName: "Destination",
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      appKey: key,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TMAP HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as TmapResponse;
  if (!data?.features?.length) {
    throw new Error("TMAP empty features");
  }

  // Distance/time metadata lives on the first Point feature.
  const summaryFeature = data.features.find((f) => f.geometry.type === "Point");
  const totalDistance = Number(summaryFeature?.properties.totalDistance ?? 0); // metres
  // Concatenate every LineString into a single polyline (in document order).
  const polyline: { lat: number; lng: number }[] = [];
  for (const f of data.features) {
    if (f.geometry.type !== "LineString") continue;
    for (const [lng, lat] of f.geometry.coordinates) {
      const last = polyline[polyline.length - 1];
      if (!last || last.lat !== lat || last.lng !== lng) polyline.push({ lat, lng });
    }
  }

  // Convert pedestrian distance to a cycling duration estimate (15 km/h).
  const cyclingSeconds = Math.round((totalDistance / 1000 / 15) * 3600);

  return {
    polyline,
    distance_m: totalDistance,
    duration_s: cyclingSeconds,
    provider: "tmap_pedestrian",
    fallback: false,
  };
}
