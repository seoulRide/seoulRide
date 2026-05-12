"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EventExplorer, type BikeStation, type ExplorerEvent } from "./EventExplorer";
import type { EventEntry, RecommendationPicks } from "@/lib/types";
import { haversineKm } from "@/lib/route-geometry";
import { isMobileUA } from "@/lib/map-app-links";
import { useGeolocation } from "@/lib/use-geolocation";
import { getEventStatus } from "@/lib/event-status";
import { t, type Lang } from "@/lib/i18n";

const SEARCH_RADIUS_KM = 3;
const MIN_NEARBY = 8;
const FALLBACK_FILL_CAP = 30;
const HARD_CAP = 60;
/** Fallback anchor when geolocation is unavailable — Seoul Forest (popular #1). */
const FALLBACK_ANCHOR_NO = "ST-181";

interface PopularAnchor {
  station_no: string;
  lat: number;
  lng: number;
}

export function NearbyClient({
  events: allEvents,
  stations,
  popularAnchors = [],
  recommendations = [],
  focusId,
  lang,
}: {
  events: EventEntry[];
  stations?: BikeStation[];
  popularAnchors?: PopularAnchor[];
  recommendations?: RecommendationPicks;
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

  // Find nearest popular bike station to user's origin — that anchor's
  // AI picks become the highlighted recommendations.
  const anchorPicks = useMemo(() => {
    if (focused || popularAnchors.length === 0 || recommendations.length === 0) return [];
    // Geolocation pending → use fallback anchor (Seoul Forest).
    const usingFallback = locStatus !== "granted";
    let anchorNo: string;
    if (usingFallback) {
      anchorNo = FALLBACK_ANCHOR_NO;
    } else {
      let bestAnchor = popularAnchors[0];
      let bestDist = haversineKm(origin, { lat: bestAnchor.lat, lng: bestAnchor.lng });
      for (const a of popularAnchors.slice(1)) {
        const d = haversineKm(origin, { lat: a.lat, lng: a.lng });
        if (d < bestDist) { bestDist = d; bestAnchor = a; }
      }
      anchorNo = bestAnchor.station_no;
    }
    return recommendations
      .filter((r) => r.anchor_station_no === anchorNo)
      .sort((a, b) => a.rank - b.rank);
  }, [focused, popularAnchors, recommendations, origin, locStatus]);

  // Build a map: event_id → AI pick reason (if any)
  const pickReasonById = useMemo(() => {
    const m = new Map<string, { reason_ko: string; reason_en: string; rank: number }>();
    for (const p of anchorPicks) {
      m.set(p.event_id, { reason_ko: p.reason_ko, reason_en: p.reason_en, rank: p.rank });
    }
    return m;
  }, [anchorPicks]);

  // Events list:
  // - Focus mode: anchored event first, then others within radius sorted by distance from anchor.
  // - GPS mode:   AI picks first (in rank order), then events sorted by distance.
  const events: ExplorerEvent[] = useMemo(() => {
    if (focused) {
      const others = allWithCoords
        .filter((e) => e.id !== focused.id)
        .map((e) => ({ e, d: haversineKm({ lat: focused.lat, lng: focused.lng }, { lat: e.lat, lng: e.lng }) }))
        .filter((x) => x.d <= SEARCH_RADIUS_KM)
        .sort((a, b) => a.d - b.d)
        .slice(0, HARD_CAP);
      return [focused, ...others.map((x) => x.e)].map((e) => toExplorer(e));
    }

    const withDistance = allWithCoords
      .map((e) => ({ e, d: haversineKm(origin, { lat: e.lat, lng: e.lng }) }))
      .sort((a, b) => a.d - b.d);
    const within = withDistance.filter((x) => x.d <= SEARCH_RADIUS_KM);
    const picked =
      within.length >= MIN_NEARBY
        ? within.slice(0, HARD_CAP)
        : withDistance.slice(0, FALLBACK_FILL_CAP);

    // Build pick events (in rank order) — pulled from event pool if present.
    const eventById = new Map(allWithCoords.map((e) => [e.id, e]));
    const pickEvents = anchorPicks
      .map((p) => eventById.get(p.event_id))
      .filter((e): e is typeof allWithCoords[number] => e != null);
    const pickIds = new Set(pickEvents.map((e) => e.id));

    // Prepend AI picks; filter them out of the regular list to avoid duplicates.
    const regular = picked.filter((x) => !pickIds.has(x.e.id));
    return [...pickEvents.map((e) => toExplorer(e, pickReasonById)), ...regular.map((x) => toExplorer(x.e, pickReasonById))];
  }, [allWithCoords, focused, origin, anchorPicks, pickReasonById]);

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

function toExplorer(
  e: EventEntry & { lat: number; lng: number },
  pickReasonById?: Map<string, { reason_ko: string; reason_en: string; rank: number }>,
): ExplorerEvent {
  const pick = pickReasonById?.get(e.id);
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
    pick: pick ? { reason_ko: pick.reason_ko, reason_en: pick.reason_en, rank: pick.rank } : undefined,
  };
}
