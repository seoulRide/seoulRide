"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NaverMap, type NaverMapHandle, type NaverMapMarker } from "./NaverMap";
import type { PopularStation } from "@/lib/types";
import type { Lang } from "@/lib/i18n";

export default function MapWrapper({ stations, lang }: { stations: PopularStation[]; lang: Lang }) {
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
      selectedId={selected}
      onMarkerClick={onClick}
      zoom={11}
      fitBounds
      className="h-[55vh] sm:h-[60vh] md:h-[68vh] w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm"
    />
  );
}
