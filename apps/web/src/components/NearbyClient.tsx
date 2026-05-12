"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EventExplorer, type BikeStation, type ExplorerEvent } from "./EventExplorer";
import type { EventEntry } from "@/lib/types";
import { haversineKm } from "@/lib/route-geometry";
import { isMobileUA } from "@/lib/map-app-links";
import { useGeolocation } from "@/lib/use-geolocation";
import { getEventStatus } from "@/lib/event-status";
import { t, type Lang } from "@/lib/i18n";

const SEARCH_RADIUS_KM = 3;
const MIN_NEARBY = 8;
const FALLBACK_FILL_CAP = 30;
const HARD_CAP = 60;

export function NearbyClient({
  events: allEvents,
  stations,
  focusId,
  lang,
}: {
  events: EventEntry[];
  stations?: BikeStation[];
  /** When set, anchors the carousel on this event id (events near this event, not near the user). */
  focusId?: string;
  lang: Lang;
}) {
  const { origin, locStatus, lowAccuracy, requestLocation } = useGeolocation();
  const [mobile, setMobile] = useState(false);
  useEffect(() => { setMobile(isMobileUA()); }, []);

  // Drop events that have already ended — only show ongoing + upcoming.
  // (focusId stays in if provided, even if its status is past, so a shared
  // link to a finished event still resolves to its event card.)
  const allWithCoords = useMemo(
    () =>
      allEvents
        .filter((e): e is EventEntry & { lat: number; lng: number } => e.lat != null && e.lng != null)
        .filter((e) => e.id === focusId || getEventStatus(e.start, e.end) !== "past"),
    [allEvents, focusId],
  );

  const focused = useMemo(
    () => (focusId ? allWithCoords.find((e) => e.id === focusId) ?? null : null),
    [allWithCoords, focusId],
  );

  // Events list:
  // - Focus mode: anchored event first, then others within radius sorted by distance from anchor.
  // - GPS mode:   sorted by distance from user; back-fill nearest N when too few are within radius.
  const events: ExplorerEvent[] = useMemo(() => {
    if (focused) {
      const others = allWithCoords
        .filter((e) => e.id !== focused.id)
        .map((e) => ({ e, d: haversineKm({ lat: focused.lat, lng: focused.lng }, { lat: e.lat, lng: e.lng }) }))
        .filter((x) => x.d <= SEARCH_RADIUS_KM)
        .sort((a, b) => a.d - b.d)
        .slice(0, HARD_CAP);
      return [focused, ...others.map((x) => x.e)].map(toExplorer);
    }

    const withDistance = allWithCoords
      .map((e) => ({ e, d: haversineKm(origin, { lat: e.lat, lng: e.lng }) }))
      .sort((a, b) => a.d - b.d);
    const within = withDistance.filter((x) => x.d <= SEARCH_RADIUS_KM);
    const picked =
      within.length >= MIN_NEARBY
        ? within.slice(0, HARD_CAP)
        : withDistance.slice(0, FALLBACK_FILL_CAP);
    return picked.map((x) => toExplorer(x.e));
  }, [allWithCoords, focused, origin]);

  const focusedTitle = focused ? (lang === "ko" ? focused.title_ko : focused.title_en) : null;
  const initialCenter = focused ? { lat: focused.lat, lng: focused.lng } : origin;

  const banner = focused ? (
    <div className="pointer-events-auto rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs flex items-center gap-2 max-w-full">
      <Link
        href={lang === "ko" ? "/?lng=ko" : "/"}
        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-1"
        prefetch={false}
        aria-label="Back"
      >
        ←
      </Link>
      <span className="truncate">{focusedTitle}</span>
      <span className="text-zinc-400">·</span>
      <span className="text-zinc-500">
        {lang === "ko" ? `${events.length}개 행사` : `${events.length} events`}
      </span>
    </div>
  ) : (
    <div className="pointer-events-auto rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs flex items-center gap-2">
      {locStatus === "requesting" && <span>{lang === "ko" ? "위치 확인 중…" : "Locating…"}</span>}
      {locStatus === "granted" && !lowAccuracy && (
        <>
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span>{lang === "ko" ? "내 위치 기준" : "Around you"}</span>
          <span className="text-zinc-400">·</span>
          <span className="text-zinc-500">
            {lang === "ko" ? `${events.length}개 행사` : `${events.length} events`}
          </span>
        </>
      )}
      {locStatus === "granted" && lowAccuracy && (
        <>
          <span className="text-amber-600">⚠</span>
          <span className="truncate">{t("location.low_accuracy", lang)}</span>
          <button
            onClick={requestLocation}
            className="ml-1 text-emerald-600 font-medium underline-offset-2 hover:underline shrink-0"
            type="button"
          >
            {t("location.retry", lang)}
          </button>
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
          {t("route.use_my_location", lang)}
        </button>
      )}
    </div>
  );

  return (
    <EventExplorer
      events={events}
      stations={stations}
      lang={lang}
      origin={origin}
      originGranted={locStatus === "granted"}
      initialCenter={initialCenter}
      topBanner={banner}
      mobile={mobile}
    />
  );
}

function toExplorer(e: EventEntry & { lat: number; lng: number }): ExplorerEvent {
  return {
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
  };
}
