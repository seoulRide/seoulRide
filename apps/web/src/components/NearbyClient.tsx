"use client";

import { useEffect, useMemo, useState } from "react";
import { EventExplorer, type ExplorerEvent } from "./EventExplorer";
import type { EventEntry } from "@/lib/types";
import { haversineKm } from "@/lib/route-geometry";
import { isMobileUA } from "@/lib/map-app-links";
import { useGeolocation } from "@/lib/use-geolocation";
import type { Lang } from "@/lib/i18n";

const SEARCH_RADIUS_KM = 3;
const MIN_NEARBY = 8;
const FALLBACK_FILL_CAP = 30;
const HARD_CAP = 60;

export function NearbyClient({ events: allEvents, lang }: { events: EventEntry[]; lang: Lang }) {
  const { origin, locStatus, requestLocation } = useGeolocation();
  const [mobile, setMobile] = useState(false);
  useEffect(() => { setMobile(isMobileUA()); }, []);

  // Sort events by distance from user; if too few fall within the radius, back-fill
  // with the nearest N regardless of radius so the carousel never feels empty.
  const events: ExplorerEvent[] = useMemo(() => {
    const withDistance = allEvents
      .filter((e): e is EventEntry & { lat: number; lng: number } => e.lat != null && e.lng != null)
      .map((e) => ({ e, d: haversineKm(origin, { lat: e.lat, lng: e.lng }) }))
      .sort((a, b) => a.d - b.d);
    const within = withDistance.filter((x) => x.d <= SEARCH_RADIUS_KM);
    const picked =
      within.length >= MIN_NEARBY
        ? within.slice(0, HARD_CAP)
        : withDistance.slice(0, FALLBACK_FILL_CAP);
    return picked.map(({ e }) => ({
      id: e.id,
      title_ko: e.title_ko,
      title_en: e.title_en,
      venue_ko: e.venue_ko,
      venue_en: e.venue_en,
      category: e.category,
      lat: e.lat,
      lng: e.lng,
      start: e.start,
      end: e.end,
      url: e.url,
    }));
  }, [allEvents, origin]);

  const banner = (
    <div className="pointer-events-auto rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs flex items-center gap-2">
      {locStatus === "requesting" && <span>{lang === "ko" ? "위치 확인 중…" : "Locating…"}</span>}
      {locStatus === "granted" && (
        <>
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span>{lang === "ko" ? "내 위치 기준" : "Around you"}</span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500">
            {lang === "ko" ? `${events.length}개 행사` : `${events.length} events`}
          </span>
        </>
      )}
      {(locStatus === "denied" || locStatus === "unsupported") && (
        <>
          <span className="text-amber-600">⚠</span>
          <span>{lang === "ko" ? "위치 미허용 — 시청 기준" : "No location — using City Hall"}</span>
          <button
            onClick={requestLocation}
            className="ml-1 text-emerald-600 font-medium underline-offset-2 hover:underline"
            type="button"
          >
            {lang === "ko" ? "다시" : "Retry"}
          </button>
        </>
      )}
      {locStatus === "idle" && (
        <button
          onClick={requestLocation}
          className="text-emerald-600 font-medium"
          type="button"
        >
          {lang === "ko" ? "내 위치 사용" : "Use my location"}
        </button>
      )}
    </div>
  );

  return (
    <EventExplorer
      events={events}
      lang={lang}
      origin={origin}
      originGranted={locStatus === "granted"}
      initialCenter={origin}
      topBanner={banner}
      mobile={mobile}
    />
  );
}
