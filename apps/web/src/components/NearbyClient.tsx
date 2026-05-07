"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import { NaverMap, type NaverMapHandle, type NaverMapMarker } from "./NaverMap";
import type { EventEntry } from "@/lib/types";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

const FALLBACK_CENTER = { lat: 37.5665, lng: 126.978 }; // 시청
const SEARCH_RADIUS_KM = 3;

const CATEGORY_LABEL: Record<EventEntry["category"], { en: string; ko: string }> = {
  concert: { en: "Concert", ko: "콘서트" },
  exhibition: { en: "Exhibition", ko: "전시" },
  festival: { en: "Festival", ko: "축제" },
  performance: { en: "Performance", ko: "공연" },
  experience: { en: "Experience", ko: "체험" },
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type LocStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported" | "fallback";

export function NearbyClient({ events, lang }: { events: EventEntry[]; lang: Lang }) {
  const mapRef = useRef<NaverMapHandle>(null);
  const cardListRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [origin, setOrigin] = useState<{ lat: number; lng: number }>(FALLBACK_CENTER);
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<number | string | null>(0.45);
  /** When true, the map is in "focused" mode (zoomed in on a single event). */
  const [focused, setFocused] = useState(false);

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocStatus("unsupported");
      return;
    }
    setLocStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("granted");
      },
      () => {
        setLocStatus("denied");
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  };

  // Try once on mount
  useEffect(() => {
    requestLocation();
  }, []);

  // Compute nearby events sorted by distance
  const nearby = useMemo(() => {
    const withDistance = events
      .filter((e) => e.lat != null && e.lng != null)
      .map((e) => ({
        ...e,
        from_me_km: haversineKm(origin, { lat: e.lat as number, lng: e.lng as number }),
      }))
      .sort((a, b) => a.from_me_km - b.from_me_km);
    const radius = SEARCH_RADIUS_KM;
    const within = withDistance.filter((e) => e.from_me_km <= radius);
    // If too few within radius, fall back to top-30 nearest regardless of radius
    return within.length >= 8 ? within.slice(0, 60) : withDistance.slice(0, 30);
  }, [events, origin]);

  // Markers: scale intensity by closeness (closer = bigger/red)
  const markers: NaverMapMarker[] = useMemo(() => {
    if (nearby.length === 0) return [];
    const maxKm = Math.max(...nearby.map((e) => e.from_me_km), 0.01);
    return nearby.map((e) => ({
      id: e.id,
      lat: e.lat as number,
      lng: e.lng as number,
      intensity: 1 - Math.min(1, e.from_me_km / maxKm) * 0.85, // closer → higher
    }));
  }, [nearby]);

  // When selectedId changes, scroll the matching card into view (always).
  // Map pan/zoom is handled separately based on `focused` so initial auto-select
  // doesn't yank the camera.
  useEffect(() => {
    if (!selectedId) return;
    const node = cardRefs.current.get(selectedId);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!focused) {
      // Subtle pan only — keep the bird's-eye view.
      const e = nearby.find((x) => x.id === selectedId);
      if (e) mapRef.current?.panTo(e.lat as number, e.lng as number);
    }
  }, [selectedId, nearby, focused]);

  // When entering or moving within focused mode, zoom in + pan + collapse the sheet.
  useEffect(() => {
    if (!focused || !selectedId) return;
    const e = nearby.find((x) => x.id === selectedId);
    if (!e) return;
    mapRef.current?.panTo(e.lat as number, e.lng as number);
    mapRef.current?.setZoom(16);
    setSnap(0.18);
  }, [focused, selectedId, nearby]);

  // Default-select the closest event when nearby list changes
  useEffect(() => {
    if (nearby.length > 0 && !selectedId) setSelectedId(nearby[0].id);
  }, [nearby, selectedId]);

  const focusOn = (id: string) => {
    setSelectedId(id);
    setFocused(true);
  };

  const resetView = () => {
    setFocused(false);
    mapRef.current?.setZoom(13);
    mapRef.current?.panTo(origin.lat, origin.lng);
    setSnap(0.45);
  };

  return (
    <div className="relative">
      <NaverMap
        ref={mapRef}
        markers={markers}
        selectedId={selectedId}
        center={origin}
        zoom={13}
        here={locStatus === "granted" ? origin : null}
        onMarkerClick={focusOn}
        className="h-[100svh] w-full"
      />

      {focused && (
        <div className="absolute top-14 right-3 z-40">
          <button
            onClick={resetView}
            className="pointer-events-auto rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-xs font-medium flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            aria-label={lang === "ko" ? "전체 보기" : "Show all events"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12h7M21 12h-7M12 3v7M12 21v-7" />
            </svg>
            {lang === "ko" ? "전체 보기" : "Show all"}
          </button>
        </div>
      )}

      {/* Top floating banner: location status */}
      <div className="absolute top-3 left-3 right-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs flex items-center gap-2">
          {locStatus === "requesting" && <span>{lang === "ko" ? "위치 확인 중…" : "Locating…"}</span>}
          {locStatus === "granted" && (
            <>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span>{lang === "ko" ? "내 위치 기준" : "Around you"}</span>
              <span className="text-zinc-400">·</span>
              <span className="text-zinc-500">{nearby.length} events</span>
            </>
          )}
          {(locStatus === "denied" || locStatus === "unsupported" || locStatus === "fallback") && (
            <>
              <span className="text-amber-600">⚠</span>
              <span>{lang === "ko" ? "위치 미허용 — 시청 기준" : "No location — using City Hall"}</span>
              <button
                onClick={requestLocation}
                className="ml-1 text-emerald-600 font-medium underline-offset-2 hover:underline"
              >
                {lang === "ko" ? "다시" : "Retry"}
              </button>
            </>
          )}
          {locStatus === "idle" && (
            <button onClick={requestLocation} className="text-emerald-600 font-medium">
              {lang === "ko" ? "내 위치 사용" : "Use my location"}
            </button>
          )}
        </div>
      </div>

      <Drawer.Root
        open
        modal={false}
        snapPoints={[0.18, 0.45, 0.92]}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        dismissible={false}
      >
        <Drawer.Portal>
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-screen-md rounded-t-2xl bg-white dark:bg-zinc-950 border-t border-x border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
            style={{ height: "100svh" }}
          >
            <Drawer.Title className="sr-only">{lang === "ko" ? "주변 행사" : "Nearby events"}</Drawer.Title>
            <Drawer.Description className="sr-only">
              {lang === "ko" ? "주변 문화행사 목록" : "List of nearby cultural events"}
            </Drawer.Description>
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="px-4 pb-2 pt-1 flex items-baseline justify-between">
              <h2 className="text-base font-semibold">
                {lang === "ko" ? "주변 행사" : "Nearby events"}{" "}
                <span className="text-zinc-400 font-normal text-sm">({nearby.length})</span>
              </h2>
              <span className="text-xs text-zinc-500">
                {lang === "ko" ? `반경 ${SEARCH_RADIUS_KM} km` : `Within ${SEARCH_RADIUS_KM} km`}
              </span>
            </div>
            <div ref={cardListRef} className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-1 space-y-2">
              {nearby.map((e) => (
                <NearbyCard
                  key={e.id}
                  ref={(el: HTMLButtonElement | null) => {
                    if (el) cardRefs.current.set(e.id, el);
                    else cardRefs.current.delete(e.id);
                  }}
                  event={e}
                  selected={selectedId === e.id}
                  lang={lang}
                  onTap={() => focusOn(e.id)}
                />
              ))}
              {nearby.length === 0 && (
                <p className="text-sm text-zinc-500 px-1 py-6">
                  {lang === "ko" ? "주변 행사가 없습니다." : "No events found nearby."}
                </p>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

interface NearbyCardProps {
  event: EventEntry & { from_me_km: number };
  selected: boolean;
  lang: Lang;
  onTap: () => void;
}

const NearbyCard = forwardRef<HTMLButtonElement, NearbyCardProps>(function NearbyCard(
  { event, selected, lang, onTap },
  ref,
) {
  const title = lang === "ko" ? event.title_ko : event.title_en;
  const venue = lang === "ko" ? event.venue_ko : event.venue_en;
  const fallback = event.en_fallback === "ko_original" && lang === "en";
  const isFree = event.price === "Free";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onTap}
      className={[
        "w-full text-left rounded-xl border p-3.5 transition flex flex-col gap-1",
        selected
          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
        <Badge variant="outline" className="text-[11px]">
          {CATEGORY_LABEL[event.category][lang]}
        </Badge>
        <span className="text-emerald-600 font-medium">
          {event.from_me_km < 1
            ? `${Math.round(event.from_me_km * 1000)} m`
            : `${event.from_me_km.toFixed(1)} km`}
        </span>
        {fallback && (
          <span title={t("card.original_korean", lang)} className="text-zinc-400">
            ⓘ
          </span>
        )}
      </div>
      <h4 className="text-[15px] font-medium leading-snug line-clamp-2">{title}</h4>
      <div className="text-xs text-zinc-500 line-clamp-1">{venue}</div>
      <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
        <span>
          {event.start.slice(0, 10)}
          {event.end && event.end !== event.start ? ` ~ ${event.end.slice(0, 10)}` : ""}
        </span>
        <span className={isFree ? "text-emerald-600 font-medium" : ""}>{event.price}</span>
      </div>
    </button>
  );
});
