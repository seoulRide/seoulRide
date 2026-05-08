"use client";

import { forwardRef, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { NaverMap, type NaverMapHandle, type NaverMapMarker, type NaverMapNamedMarker } from "./NaverMap";
import { haversineKm, formatDistance } from "@/lib/route-geometry";
import { bicycleAppLinks, type MapAppProvider } from "@/lib/map-app-links";
import { getEventStatus } from "@/lib/event-status";
import { t, type Lang } from "@/lib/i18n";
import { GoogleMapsIcon, NaverIcon } from "./BrandIcons";

const PROVIDER_ICON: Record<MapAppProvider, ComponentType<{ className?: string }>> = {
  google: GoogleMapsIcon,
  naver: NaverIcon,
};

const CATEGORY_LABEL: Record<ExplorerEvent["category"], { en: string; ko: string }> = {
  concert: { en: "Concert", ko: "콘서트" },
  exhibition: { en: "Exhibition", ko: "전시" },
  festival: { en: "Festival", ko: "축제" },
  performance: { en: "Performance", ko: "공연" },
  experience: { en: "Experience", ko: "체험" },
};

const STATION_ICON_HTML = `<div style="width:12px;height:12px;border-radius:9999px;background:#fff;border:2.5px solid #047857;box-shadow:0 1px 2px rgba(0,0,0,0.2);"></div>`;

export interface ExplorerEvent {
  id: string;
  title_ko: string;
  title_en: string;
  venue_ko: string;
  venue_en: string;
  category: "concert" | "exhibition" | "festival" | "performance" | "experience";
  lat: number;
  lng: number;
  start: string;
  end: string;
  url: string;
}

export interface BikeStation {
  station_no: string;
  name: string;
  lat: number;
  lng: number;
}

export interface EventExplorerProps {
  events: ExplorerEvent[];
  /** Optional bike stations to draw as small distinct markers underneath the event markers. */
  stations?: BikeStation[];
  lang: Lang;
  origin: { lat: number; lng: number };
  originGranted: boolean;
  /** Initial map center. If omitted, uses the first event. */
  initialCenter?: { lat: number; lng: number };
  /** Floating banner content rendered above the map. */
  topBanner: ReactNode;
  /** UA flag — `true` makes deep links open in-place (Android/iOS), `false` opens new tabs. */
  mobile: boolean;
}

export function EventExplorer({
  events,
  stations,
  lang,
  origin,
  originGranted,
  initialCenter,
  topBanner,
  mobile,
}: EventExplorerProps) {
  const mapRef = useRef<NaverMapHandle>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [selectedId, setSelectedId] = useState<string>(events[0]?.id ?? "");

  // Keep selection valid when the events list shifts (e.g. /nearby recomputes after GPS grant).
  useEffect(() => {
    if (events.length === 0) return;
    if (!events.some((e) => e.id === selectedId)) {
      setSelectedId(events[0].id);
      cardRefs.current.get(events[0].id)?.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [events, selectedId]);

  const markers: NaverMapMarker[] = events.map((e) => ({
    id: e.id,
    lat: e.lat,
    lng: e.lng,
    intensity: e.id === selectedId ? 0.95 : 0.4,
  }));

  // Station markers: only show when zoomed in enough that 3K+ dots aren't
  // visual noise. minZoom 14 = neighborhood-level detail. The popular-50
  // event markers are unaffected (separate `markers` array).
  const stationMarkers: NaverMapNamedMarker[] = useMemo(
    () =>
      (stations ?? []).map((s) => ({
        id: `station-${s.station_no}`,
        lat: s.lat,
        lng: s.lng,
        html: STATION_ICON_HTML,
        anchor: { x: 6, y: 6 },
        zIndex: 100,
        minZoom: 14,
      })),
    [stations],
  );

  // Pan map when selection changes.
  useEffect(() => {
    const e = events.find((x) => x.id === selectedId);
    if (!e) return;
    mapRef.current?.panTo(e.lat, e.lng);
  }, [selectedId, events]);

  // Detect the centered card via IntersectionObserver.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null;
        for (const e of entries) {
          if (e.intersectionRatio === 0) continue;
          if (!best || e.intersectionRatio > best.intersectionRatio) best = e;
        }
        if (best && best.intersectionRatio >= 0.6) {
          const id = (best.target as HTMLElement).dataset.id;
          if (id && id !== selectedId) setSelectedId(id);
        }
      },
      { root, threshold: [0.4, 0.6, 0.8, 1] },
    );
    cardRefs.current.forEach((node) => obs.observe(node));
    return () => obs.disconnect();
  }, [events, selectedId]);

  const onMarkerClick = (id: string) => {
    setSelectedId(id);
    cardRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const fallbackCenter = initialCenter ?? (events[0] ? { lat: events[0].lat, lng: events[0].lng } : origin);

  return (
    <div className="relative">
      <NaverMap
        ref={mapRef}
        markers={markers}
        extraMarkers={stationMarkers}
        selectedId={selectedId}
        center={fallbackCenter}
        zoom={14}
        here={originGranted ? origin : null}
        onMarkerClick={onMarkerClick}
        className="h-[100svh] w-full"
      />

      <div className="absolute top-3 left-3 right-3 flex justify-center pointer-events-none z-10">
        {topBanner}
      </div>

      <div
        ref={scrollerRef}
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 z-30 overflow-x-auto overflow-y-hidden pb-3 pt-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
      >
        <div className="flex items-stretch gap-3 px-[10vw]">
          {events.map((e) => (
            <ExplorerCard
              key={e.id}
              ref={(el: HTMLDivElement | null) => {
                if (el) cardRefs.current.set(e.id, el);
                else cardRefs.current.delete(e.id);
              }}
              event={e}
              origin={origin}
              originGranted={originGranted}
              mobile={mobile}
              selected={e.id === selectedId}
              lang={lang}
            />
          ))}
          {events.length === 0 && (
            <div className="shrink-0 w-[80vw] max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg p-6 text-sm text-zinc-500 text-center">
              {lang === "ko" ? "주변 행사가 없습니다." : "No events found nearby."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ExplorerCardProps {
  event: ExplorerEvent;
  origin: { lat: number; lng: number };
  originGranted: boolean;
  mobile: boolean;
  selected: boolean;
  lang: Lang;
}

const ExplorerCard = forwardRef<HTMLDivElement, ExplorerCardProps>(function ExplorerCard(
  { event, origin, originGranted, mobile, selected, lang },
  ref,
) {
  const title = lang === "ko" ? event.title_ko : event.title_en;
  const venue = lang === "ko" ? event.venue_ko : event.venue_en;
  const status = getEventStatus(event.start, event.end);
  const distanceKm = originGranted
    ? haversineKm(origin, { lat: event.lat, lng: event.lng })
    : null;
  const links = bicycleAppLinks(
    { lat: origin.lat, lng: origin.lng, name: lang === "ko" ? "내 위치" : "My location" },
    { lat: event.lat, lng: event.lng, name: title },
    mobile,
  ).flatMap((l) => (l.url !== null ? [{ ...l, url: l.url }] : []));

  return (
    <div
      ref={ref}
      data-id={event.id}
      className={[
        "relative shrink-0 w-[80vw] max-w-md rounded-2xl bg-white dark:bg-zinc-950 border shadow-lg p-4 flex flex-col gap-2",
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/30"
          : "border-zinc-200 dark:border-zinc-800",
      ].join(" ")}
      style={{ scrollSnapAlign: "center" }}
    >
      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t("route.event_link", lang)}
          title={t("route.event_link", lang)}
          className="absolute top-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-base leading-none"
        >
          🔗
        </a>
      )}
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold pr-9">
        <span
          className={[
            "px-1.5 py-0.5 rounded",
            status === "ongoing"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : status === "upcoming"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
          ].join(" ")}
        >
          {status === "ongoing"
            ? t("status.ongoing", lang)
            : status === "upcoming"
              ? t("status.upcoming", lang)
              : t("status.past", lang)}
        </span>
        <span className="text-zinc-500 font-medium normal-case tracking-normal">
          {lang === "ko" ? CATEGORY_LABEL[event.category].ko : CATEGORY_LABEL[event.category].en}
        </span>
        {distanceKm !== null && (
          <>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-500 font-medium normal-case tracking-normal">
              {formatDistance(distanceKm * 1000)}
            </span>
          </>
        )}
      </div>
      <h3 className="text-base font-semibold leading-tight line-clamp-2 min-h-[2.6em]">{title}</h3>
      <p className="text-xs text-zinc-500 line-clamp-1">{venue}</p>

      {/* Footer pinned to the card bottom — buttons don't shift with title length */}
      <div className="mt-auto flex flex-col gap-2 pt-3">
        <div className="flex justify-center gap-3">
          {links.map((l) => {
            const Icon = PROVIDER_ICON[l.provider];
            return (
              <a
                key={l.provider}
                href={l.url}
                target={mobile ? undefined : "_blank"}
                rel="noreferrer noopener"
                aria-label={`${l.label} — ${title}`}
                className="flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Icon className="h-7 w-7" />
                <span className="sr-only">{l.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
});
