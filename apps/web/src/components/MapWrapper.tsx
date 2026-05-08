"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NaverMap, type NaverMapHandle, type NaverMapMarker, type NaverMapNamedMarker, type NaverMapHeatCircle } from "./NaverMap";
import type { PopularStation } from "@/lib/types";
import type { StationLite } from "@/lib/data";
import type { Lang } from "@/lib/i18n";

// Top-3 bike marker — emerald bike icon + medal-colored rank badge.
function bikeMarkerHtml(rank: 1 | 2 | 3): string {
  const medalBg = rank === 1 ? "#fbbf24" : rank === 2 ? "#cbd5e1" : "#b45309"; // gold / silver / bronze
  const medalFg = rank === 2 ? "#1f2937" : "#fff";
  return `
    <div style="position:relative;width:44px;height:44px;">
      <div style="width:44px;height:44px;border-radius:9999px;background:#fff;border:2.5px solid #047857;box-shadow:0 3px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="18.5" cy="17.5" r="3.5"/>
          <circle cx="5.5" cy="17.5" r="3.5"/>
          <circle cx="15" cy="5" r="1"/>
          <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
        </svg>
      </div>
      <div style="position:absolute;top:-4px;right:-4px;width:20px;height:20px;border-radius:9999px;background:${medalBg};color:${medalFg};font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${rank}</div>
    </div>`;
}

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

  // Heatmap circles — radius, color, AND opacity all scale with volume so
  // hot stations punch through. Stacked low-volume green discs no longer
  // drown out red hotspots: low stations contribute tiny + faint discs,
  // top stations contribute big + strong red.
  const heatCircles: NaverMapHeatCircle[] = useMemo(
    () =>
      stations.map((s) => {
        const norm = s.rent_total / max; // 0..1 linear
        const radiusNorm = Math.sqrt(norm); // 0..1 sqrt — gentler radius curve
        // HSL hue: 140 (emerald) at low → 0 (red) at high.
        const hue = Math.round(140 - norm * 140);
        return {
          id: `heat-${s.station_no}`,
          lat: s.lat,
          lng: s.lng,
          radius: 200 + radiusNorm * 1700, // 200m ~ 1900m (smaller floor)
          fillColor: `hsl(${hue}, 80%, 50%)`,
          fillOpacity: 0.1 + norm * 0.25, // 0.10 ~ 0.35
        };
      }),
    [stations, max],
  );

  // Top-3 stations get the bike icon + medal badge.
  const top3 = useMemo(
    () => [...stations].sort((a, b) => a.rank_overall - b.rank_overall).slice(0, 3),
    [stations],
  );
  const top3Markers: NaverMapNamedMarker[] = useMemo(
    () =>
      top3.map((s, i) => ({
        id: `top3-${s.station_no}`,
        lat: s.lat,
        lng: s.lng,
        html: bikeMarkerHtml((i + 1) as 1 | 2 | 3),
        anchor: { x: 22, y: 22 },
        zIndex: 9000,
        clickable: true,
      })),
    [top3],
  );

  // (Future): also keep the broader station network if passed in. Currently
  // unused on home for perf; preserved as a typed prop.
  void allStations;
  void selected;

  const onClick = (id: string) => {
    const stripped = id.startsWith("top3-") ? id.slice(5) : id;
    const s = stations.find((x) => x.station_no === stripped);
    if (!s) return;
    setSelected(stripped);
    mapRef.current?.panTo(s.lat, s.lng);
    setTimeout(() => router.push(`/station/${encodeURIComponent(stripped)}${lngQs}`), 320);
  };

  return (
    <NaverMap
      ref={mapRef}
      markers={[]}
      extraMarkers={top3Markers}
      heatCircles={heatCircles}
      onMarkerClick={onClick}
      zoom={11}
      fitBounds
      className="h-[55vh] sm:h-[60vh] md:h-[68vh] w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm"
    />
  );
}
