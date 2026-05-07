"use client";

import { forwardRef, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { NaverMap, type NaverMapHandle, type NaverMapMarker } from "./NaverMap";
import { haversineKm, formatDistance } from "@/lib/route-geometry";
import { bicycleAppLinks, type MapAppProvider } from "@/lib/map-app-links";
import { getEventStatus } from "@/lib/event-status";
import { t, type Lang } from "@/lib/i18n";
import { GoogleMapsIcon, NaverIcon, KakaoIcon } from "./BrandIcons";

const PROVIDER_ICON: Record<MapAppProvider, ComponentType<{ className?: string }>> = {
  google: GoogleMapsIcon,
  naver: NaverIcon,
  kakao: KakaoIcon,
};

const CATEGORY_LABEL: Record<ExplorerEvent["category"], { en: string; ko: string }> = {
  concert: { en: "Concert", ko: "콘서트" },
  exhibition: { en: "Exhibition", ko: "전시" },
  festival: { en: "Festival", ko: "축제" },
  performance: { en: "Performance", ko: "공연" },
  experience: { en: "Experience", ko: "체험" },
};

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

export interface EventExplorerProps {
  events: ExplorerEvent[];
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
        selectedId={selectedId}
        center={fallbackCenter}
        zoom={14}
        here={originGranted ? origin : null}
        onMarkerClick={onMarkerClick}
        showBicycleLayer
        className="h-[100svh] w-full"
      />

      <div className="absolute top-3 left-3 right-3 flex justify-center pointer-events-none z-10">
        {topBanner}
      </div>

      <div
        ref={scrollerRef}
        className="fixed inset-x-0 bottom-0 z-40 overflow-x-auto overflow-y-hidden pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 [&::-webkit-scrollbar]:hidden"
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
        "shrink-0 w-[80vw] max-w-md rounded-2xl bg-white dark:bg-zinc-950 border shadow-lg p-4 flex flex-col gap-2.5",
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/30"
          : "border-zinc-200 dark:border-zinc-800",
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
      <h3 className="text-base font-semibold leading-tight line-clamp-2">{title}</h3>
      <p className="text-xs text-zinc-500 line-clamp-1">{venue}</p>

      <div className="flex gap-2 pt-1">
        {links.map((l) => {
          const Icon = PROVIDER_ICON[l.provider];
          return (
            <a
              key={l.provider}
              href={l.url}
              target={mobile ? undefined : "_blank"}
              rel="noreferrer noopener"
              aria-label={`${l.label} — ${title}`}
              className="flex flex-1 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Icon className="h-6 w-6" />
              <span className="sr-only">{l.label}</span>
            </a>
          );
        })}
      </div>

      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-xs text-emerald-600 hover:underline pt-0.5"
        >
          {t("route.event_link", lang)} ↗
        </a>
      )}
    </div>
  );
});
