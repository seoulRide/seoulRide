"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NaverMap, type NaverMapHandle, type NaverMapMarker, type NaverMapNamedMarker } from "./NaverMap";
import type { PopularStation } from "@/lib/types";
import type { StationLite } from "@/lib/data";
import type { Lang } from "@/lib/i18n";

const ALL_STATION_ICON_HTML = `<div style="width:8px;height:8px;border-radius:9999px;background:rgba(82,82,91,0.45);border:1px solid rgba(255,255,255,0.85);"></div>`;

export default function MapWrapper({
  stations,
  allStations,
  lang,
}: {
  stations: PopularStation[];
  allStations?: StationLite[];
  lang: Lang;
}) {
  const router = useRouter();
  const mapRef = useRef<NaverMapHandle>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const lngQs = lang === "ko" ? "?lng=ko" : "";

  const max = useMemo(() => Math.max(1, ...stations.map((s) => s.rent_total)), [stations]);
  const markers: NaverMapMarker[] = useMemo(
    () =>
      stations.map((s) => ({
        id: s.station_no,
        lat: s.lat,
        lng: s.lng,
        intensity: s.rent_total / max,
      })),
    [stations, max],
  );

  // All-station background dots — render every station that isn't already a popular
  // marker, so the map shows the broader bike network without double-stacking.
  const popularSet = useMemo(() => new Set(stations.map((s) => s.station_no)), [stations]);
  const stationDots: NaverMapNamedMarker[] = useMemo(
    () =>
      (allStations ?? [])
        .filter((s) => !popularSet.has(s.station_no))
        .map((s) => ({
          id: `bg-${s.station_no}`,
          lat: s.lat,
          lng: s.lng,
          html: ALL_STATION_ICON_HTML,
          anchor: { x: 4, y: 4 },
          zIndex: 50,
        })),
    [allStations, popularSet],
  );

  const onClick = (id: string) => {
    const s = stations.find((x) => x.station_no === id);
    if (!s) return;
    setSelected(id);
    mapRef.current?.panTo(s.lat, s.lng);
    setTimeout(() => router.push(`/station/${encodeURIComponent(id)}${lngQs}`), 320);
  };

  return (
    <NaverMap
      ref={mapRef}
      markers={markers}
      extraMarkers={stationDots}
      selectedId={selected}
      onMarkerClick={onClick}
      zoom={11}
      fitBounds
      className="h-[55vh] sm:h-[60vh] md:h-[68vh] w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm"
    />
  );
}
