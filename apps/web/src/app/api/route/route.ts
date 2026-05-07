import { NextResponse } from "next/server";
import { tmapPedestrianRoute } from "@/lib/tmap-pedestrian";
import { haversineKm } from "@/lib/route-geometry";
import type { RouteResponse } from "@/lib/types";

function straightFallback(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  reason?: string,
): RouteResponse {
  const km = haversineKm(from, to);
  const meters = Math.round(km * 1000);
  // 15 km/h cycling estimate
  const seconds = Math.round((km / 15) * 3600);
  return {
    polyline: [from, to],
    distance_m: meters,
    duration_s: seconds,
    provider: "straight",
    fallback: true,
    message: reason,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = {
    lat: parseFloat(url.searchParams.get("fromLat") ?? ""),
    lng: parseFloat(url.searchParams.get("fromLng") ?? ""),
  };
  const to = {
    lat: parseFloat(url.searchParams.get("toLat") ?? ""),
    lng: parseFloat(url.searchParams.get("toLng") ?? ""),
  };
  if (!isFinite(from.lat) || !isFinite(from.lng) || !isFinite(to.lat) || !isFinite(to.lng)) {
    return NextResponse.json({ error: "fromLat/fromLng/toLat/toLng required" }, { status: 400 });
  }
  // If origin == destination, return a degenerate response.
  if (haversineKm(from, to) < 0.01) {
    return NextResponse.json(straightFallback(from, to, "origin equals destination"), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const tmap = await tmapPedestrianRoute(from, to);
    if (tmap && tmap.polyline.length >= 2) {
      return NextResponse.json(tmap, {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }
    return NextResponse.json(straightFallback(from, to, tmap ? "empty polyline" : "no api key"), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(straightFallback(from, to, `tmap failed: ${msg}`), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
