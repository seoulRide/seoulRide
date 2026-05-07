import { NextResponse } from "next/server";
import { getStationMaster } from "@/lib/data";
import { nearestStations } from "@/lib/route-geometry";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lng = parseFloat(url.searchParams.get("lng") ?? "");
  const k = Math.max(1, Math.min(10, parseInt(url.searchParams.get("k") ?? "1", 10)));
  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }
  const master = await getStationMaster();
  const result = nearestStations({ lat, lng }, master, k).map((s) => ({
    station_no: s.station_no,
    station_name_ko: s.station_name_ko,
    lat: s.lat,
    lng: s.lng,
    gu_ko: s.gu_ko,
    gu_en: s.gu_en,
    address: s.address,
  }));
  return NextResponse.json({ stations: result }, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
