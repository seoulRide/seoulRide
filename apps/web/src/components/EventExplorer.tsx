"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const [mapInstReady, setMapInstReady] = useState(false);

  // Wait for the underlying NAVER map instance to finish initializing.
  // mapRef is a stable handle from forwardRef, but `handle.getInstance()`
  // returns null until NaverMap's internal init effect runs — without this
  // probe, the panTo useEffect fires once before init and never again,
  // skipping the offset compensation entirely.
  useEffect(() => {
    if (mapInstReady) return;
    let cancelled = false;
    let raf: number | null = null;
    const check = () => {
      if (cancelled) return;
      if (mapRef.current?.getInstance()) {
        setMapInstReady(true);
        return;
      }
      raf = requestAnimationFrame(check);
    };
    check();
    return () => {
      cancelled = true;
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [mapInstReady]);

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

  // Station markers — pick only the 5 nearest to the user + 5 nearest to the
  // currently focused event. Dedupe overlap. Keeps the map readable instead
  // of dropping 3,335 dots at once.
  const stationMarkers: NaverMapNamedMarker[] = useMemo(() => {
    if (!stations || stations.length === 0) return [];
    const selected = events.find((e) => e.id === selectedId);
    const distSorted = (anchor: { lat: number; lng: number }) =>
      stations
        .map((s) => ({ s, d: haversineKm(anchor, { lat: s.lat, lng: s.lng }) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5)
        .map((x) => x.s);

    const seen = new Set<string>();
    const ordered: BikeStation[] = [];
    if (originGranted) {
      for (const s of distSorted(origin)) {
        if (seen.has(s.station_no)) continue;
        seen.add(s.station_no);
        ordered.push(s);
      }
    }
    if (selected) {
      for (const s of distSorted({ lat: selected.lat, lng: selected.lng })) {
        if (seen.has(s.station_no)) continue;
        seen.add(s.station_no);
        ordered.push(s);
      }
    }
    return ordered.map((s) => ({
      id: `station-${s.station_no}`,
      lat: s.lat,
      lng: s.lng,
      html: STATION_ICON_HTML,
      anchor: { x: 6, y: 6 },
      zIndex: 100,
    }));
  }, [stations, origin, originGranted, selectedId, events]);

  // Pan map when selection changes. Compute the offset directly from the
  // actual viewport rects of the map container and the carousel — survives
  // mobile quirks (URL-bar collapse changing svh, safe-area insets, DPR).
  //
  // Strategy: aim the marker at the geometric mid-point of the *visible*
  // map region (between the SiteHeader/banner above and the carousel below).
  // panBy is in real screen pixels so the result matches what's on screen.
  useEffect(() => {
    if (!mapInstReady) return;
    const e = events.find((x) => x.id === selectedId);
    if (!e) return;
    const handle = mapRef.current;
    const map = handle?.getInstance();
    const container = handle?.getContainer();
    const n = window.naver;
    if (!handle || !map || !n || typeof window === "undefined") return;

    map.setCenter(new n.maps.LatLng(e.lat, e.lng));

    const HEADER_H = 56; // sticky SiteHeader
    const BANNER_H = 36; // floating event title pill on top of the map
    const TAB_H = 56;    // BottomTabNav (md:hidden)

    const mapRect = container?.getBoundingClientRect();
    const scrollerRect = scrollerRef.current?.getBoundingClientRect();
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;

    const visibleTop = HEADER_H + BANNER_H;
    // On mobile carousel sits above BottomTabNav. On desktop tab nav is hidden.
    const visibleBottom = scrollerRect
      ? scrollerRect.top
      : window.innerHeight - (isDesktop ? 0 : TAB_H);
    const desiredScreenY = (visibleTop + visibleBottom) / 2;

    const mapCenterScreenY = mapRect ? mapRect.top + mapRect.height / 2 : window.innerHeight / 2;
    const offsetPx = Math.round(mapCenterScreenY - desiredScreenY);

    if (offsetPx > 0) {
      map.panBy(new n.maps.Point(0, offsetPx));
    } else if (offsetPx < 0) {
      // marker should appear *below* geometric center (rare — narrow carousel
      // + tall header). panBy with a negative y shifts camera north → marker
      // appears down on screen.
      map.panBy(new n.maps.Point(0, offsetPx));
    }
  }, [selectedId, events, mapInstReady]);

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

  // Track the carousel's target index in a ref so advanceBy is exact and
  // doesn't race with the IntersectionObserver. scrollBy + smooth + scroll-
  // snap-mandatory can overshoot and snap two cards forward; scrolling a
  // specific card's ref into center never does.
  const targetIdxRef = useRef(0);
  useEffect(() => {
    const i = events.findIndex((e) => e.id === selectedId);
    if (i >= 0) targetIdxRef.current = i;
  }, [selectedId, events]);

  const advanceBy = useCallback(
    (delta: number) => {
      const next = targetIdxRef.current + delta;
      if (next < 0 || next >= events.length) return;
      targetIdxRef.current = next;
      const targetId = events[next]?.id;
      if (!targetId) return;
      cardRefs.current.get(targetId)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    },
    [events],
  );

  // Card click → advance exactly one event in the direction of the clicked
  // card relative to the currently active one (not directly to the clicked
  // card). Clicking the active card itself is a no-op.
  const onCardClick = useCallback(
    (id: string) => {
      const clickedIdx = events.findIndex((e) => e.id === id);
      const activeIdx = targetIdxRef.current;
      if (clickedIdx < 0) return;
      if (clickedIdx === activeIdx) return;
      advanceBy(clickedIdx > activeIdx ? 1 : -1);
    },
    [events, advanceBy],
  );

  const selectedIndex = useMemo(() => events.findIndex((e) => e.id === selectedId), [events, selectedId]);
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex >= 0 && selectedIndex < events.length - 1;

  // Keyboard ←/→ on the carousel scroller (focusable via tabIndex below).
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        advanceBy(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        advanceBy(1);
      }
    };
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, [advanceBy]);

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
        tabIndex={0}
        role="region"
        aria-label={lang === "ko" ? "행사 카드 캐러셀" : "Event cards carousel"}
        className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 z-30 overflow-x-auto overflow-y-hidden pb-3 pt-2 outline-none [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory" }}
      >
        {/* Inner row uses pl-[10vw] for the start padding and an explicit
            shrink-0 spacer at the end. padding-right on a flex+overflow-x
            scroller doesn't always reserve scroll space in Chromium, so
            without the spacer the last card can't snap to center. */}
        <div className="flex items-stretch gap-3 pl-[10vw]">
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
              onCardClick={onCardClick}
            />
          ))}
          {events.length === 0 && (
            <div className="shrink-0 w-[80vw] max-w-md rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-lg p-6 text-sm text-zinc-500 text-center">
              {lang === "ko" ? "주변 행사가 없습니다." : "No events found nearby."}
            </div>
          )}
          <div className="shrink-0 w-[10vw]" aria-hidden />
        </div>
      </div>

      {/* Desktop-only carousel arrows. Mobile uses touch drag. Each button is
          a standalone fixed element parked at ~vertical mid of the carousel
          row (~5rem from viewport bottom = roughly half of a typical card
          height of ~200 px). */}
      {events.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => advanceBy(-1)}
            disabled={!canPrev}
            aria-label={lang === "ko" ? "이전 행사" : "Previous event"}
            className="hidden md:inline-flex fixed left-4 bottom-[5rem] z-40 h-11 w-11 items-center justify-center rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => advanceBy(1)}
            disabled={!canNext}
            aria-label={lang === "ko" ? "다음 행사" : "Next event"}
            className="hidden md:inline-flex fixed right-4 bottom-[5rem] z-40 h-11 w-11 items-center justify-center rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
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
  onCardClick: (id: string) => void;
}

const ExplorerCard = forwardRef<HTMLDivElement, ExplorerCardProps>(function ExplorerCard(
  { event, origin, originGranted, mobile, selected, lang, onCardClick },
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
      onClick={() => onCardClick(event.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick(event.id);
        }
      }}
      className={[
        "relative shrink-0 w-[80vw] max-w-md rounded-2xl bg-white dark:bg-zinc-950 border shadow-lg p-4 flex flex-col gap-2 cursor-pointer outline-none",
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/30"
          : "border-zinc-200 dark:border-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400",
      ].join(" ")}
      style={{ scrollSnapAlign: "center" }}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold">
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

      {/* Footer pinned to card bottom — single row: external link on the left,
          route label + provider icons on the right */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
        {event.url ? (
          <a
            href={event.url}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:underline"
          >
            <span aria-hidden>🔗</span>
            <span>{t("route.visit_homepage", lang)}</span>
          </a>
        ) : <span />}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {t("route.section_title", lang)}
          </span>
          {links.map((l) => {
            const Icon = PROVIDER_ICON[l.provider];
            return (
              <a
                key={l.provider}
                href={l.url}
                target={mobile ? undefined : "_blank"}
                rel="noreferrer noopener"
                onClick={(e) => e.stopPropagation()}
                aria-label={`${l.label} — ${title}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Icon className="h-5 w-5" />
                <span className="sr-only">{l.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
});
