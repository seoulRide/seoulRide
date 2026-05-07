"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NaverMap, type NaverMapHandle, type NaverMapMarker, type NaverMapNamedMarker, type NaverMapPolyline } from "./NaverMap";
import { haversineKm, walkingMinutes, formatDistance, formatMinutes } from "@/lib/route-geometry";
import type { RouteResponse } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { Drawer } from "vaul";

const FALLBACK_CENTER = { lat: 37.5665, lng: 126.978 }; // 시청
type LocStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

interface NearStation {
  station_no: string;
  station_name_ko: string;
  lat: number;
  lng: number;
  gu_ko: string;
  gu_en: string | null;
  address: string;
}

interface EventInfo {
  id: string;
  title_ko: string;
  title_en: string;
  venue_ko: string;
  venue_en: string;
  lat: number;
  lng: number;
  url: string;
}

const ICON_HERE = `
  <div style="width:18px;height:18px;border-radius:9999px;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 6px rgba(59,130,246,0.18);"></div>`;
const ICON_RENTAL = `
  <div style="width:32px;height:32px;border-radius:9999px;background:#10b981;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">A</div>`;
const ICON_RETURN = `
  <div style="width:32px;height:32px;border-radius:9999px;background:#0e7c66;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">B</div>`;
const ICON_EVENT = `
  <div style="width:36px;height:36px;border-radius:9999px;background:#f59e0b;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">★</div>`;

export function RouteClient({ event, lang }: { event: EventInfo; lang: Lang }) {
  const mapRef = useRef<NaverMapHandle>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number }>(FALLBACK_CENTER);
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [rental, setRental] = useState<NearStation | null>(null);
  const [returnSt, setReturnSt] = useState<NearStation | null>(null);
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [snap, setSnap] = useState<number | string | null>(0.45);

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
      () => setLocStatus("denied"),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  };

  useEffect(() => { requestLocation(); }, []);

  // Resolve nearest stations whenever origin or event changes
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [aRes, bRes] = await Promise.all([
          fetch(`/api/stations-near?lat=${origin.lat}&lng=${origin.lng}&k=1`).then((r) => r.json()),
          fetch(`/api/stations-near?lat=${event.lat}&lng=${event.lng}&k=1`).then((r) => r.json()),
        ]);
        if (!active) return;
        setRental(aRes.stations?.[0] ?? null);
        setReturnSt(bRes.stations?.[0] ?? null);
      } catch (e) {
        if (active) setRouteError(e instanceof Error ? e.message : "stations lookup failed");
      }
    })();
    return () => { active = false; };
  }, [origin, event.lat, event.lng]);

  // Fetch route between rental and return stations
  useEffect(() => {
    if (!rental || !returnSt) return;
    let active = true;
    (async () => {
      try {
        const r = await fetch(
          `/api/route?fromLat=${rental.lat}&fromLng=${rental.lng}&toLat=${returnSt.lat}&toLng=${returnSt.lng}`,
        );
        const data = (await r.json()) as RouteResponse | { error: string };
        if (!active) return;
        if ("polyline" in data) {
          setRoute(data);
          setRouteError(null);
        } else {
          setRouteError(data.error);
        }
      } catch (e) {
        if (active) setRouteError(e instanceof Error ? e.message : "route fetch failed");
      }
    })();
    return () => { active = false; };
  }, [rental, returnSt]);

  // Build map polylines and markers
  const polylines: NaverMapPolyline[] = [];
  const extras: NaverMapNamedMarker[] = [];
  if (rental) {
    polylines.push({
      id: "walk-here-rental",
      points: [origin, { lat: rental.lat, lng: rental.lng }],
      color: "#71717a",
      weight: 3,
      dashed: true,
    });
    extras.push({ id: "rental", lat: rental.lat, lng: rental.lng, html: ICON_RENTAL, anchor: { x: 16, y: 16 }, zIndex: 7000 });
  }
  if (route && route.polyline.length >= 2) {
    polylines.push({
      id: "bike",
      points: route.polyline,
      color: route.fallback ? "#34d399" : "#10b981",
      weight: 5,
      dashed: route.fallback,
    });
  }
  if (returnSt) {
    polylines.push({
      id: "walk-return-event",
      points: [{ lat: returnSt.lat, lng: returnSt.lng }, { lat: event.lat, lng: event.lng }],
      color: "#71717a",
      weight: 3,
      dashed: true,
    });
    extras.push({ id: "return", lat: returnSt.lat, lng: returnSt.lng, html: ICON_RETURN, anchor: { x: 16, y: 16 }, zIndex: 7000 });
  }
  extras.push({ id: "event", lat: event.lat, lng: event.lng, html: ICON_EVENT, anchor: { x: 18, y: 18 }, zIndex: 9000 });

  const dummyMarkers: NaverMapMarker[] = [];

  // Distances/times for the steps
  const walkA = rental ? haversineKm(origin, { lat: rental.lat, lng: rental.lng }) : 0;
  const walkB = returnSt ? haversineKm({ lat: returnSt.lat, lng: returnSt.lng }, { lat: event.lat, lng: event.lng }) : 0;
  const bikeKm = route ? route.distance_m / 1000 : (rental && returnSt ? haversineKm({ lat: rental.lat, lng: rental.lng }, { lat: returnSt.lat, lng: returnSt.lng }) : 0);
  const bikeMin = route ? route.duration_s / 60 : (bikeKm / 15) * 60;
  const totalKm = walkA + bikeKm + walkB;
  const totalMin = walkingMinutes(walkA) + bikeMin + walkingMinutes(walkB);

  const eventTitle = lang === "ko" ? event.title_ko : event.title_en;
  const eventVenue = lang === "ko" ? event.venue_ko : event.venue_en;

  return (
    <div className="relative">
      <NaverMap
        ref={mapRef}
        markers={dummyMarkers}
        center={origin}
        zoom={14}
        here={locStatus === "granted" ? origin : null}
        polylines={polylines}
        extraMarkers={extras}
        fitBounds
        className="h-[100svh] w-full"
      />

      {/* Top floating banner */}
      <div className="absolute top-3 left-3 right-3 flex justify-center pointer-events-none">
        <div className="pointer-events-auto rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur shadow-sm border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs flex items-center gap-2 max-w-full">
          <Link href={lang === "ko" ? "/?lng=ko" : "/"} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 px-1" prefetch={false} aria-label="Back">
            ←
          </Link>
          {locStatus === "requesting" && <span>{t("route.locating", lang)}</span>}
          {locStatus === "granted" && (
            <>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="truncate">{eventTitle}</span>
            </>
          )}
          {(locStatus === "denied" || locStatus === "unsupported") && (
            <>
              <span className="text-amber-600">⚠</span>
              <span>{t("route.no_location_fallback", lang)}</span>
              <button onClick={requestLocation} className="ml-1 text-emerald-600 font-medium underline-offset-2 hover:underline">
                {lang === "ko" ? "다시" : "Retry"}
              </button>
            </>
          )}
          {locStatus === "idle" && (
            <button onClick={requestLocation} className="text-emerald-600 font-medium">
              {t("route.use_my_location", lang)}
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
            <Drawer.Title className="sr-only">{t("route.h1", lang)}</Drawer.Title>
            <Drawer.Description className="sr-only">{eventTitle}</Drawer.Description>
            <div className="mx-auto mt-2 mb-1 h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            <div className="px-4 pb-2 pt-1">
              <h2 className="text-base font-semibold leading-tight line-clamp-2">{eventTitle}</h2>
              <p className="text-xs text-zinc-500 line-clamp-1">{eventVenue}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-1 space-y-3">
              {/* Disclaimer */}
              <p className="text-[11px] text-zinc-500 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2 leading-relaxed">
                {route?.fallback ? t("route.fallback_straight", lang) : t("route.disclaimer_pedestrian", lang)}
              </p>

              {/* Total summary */}
              <div className="flex items-baseline justify-between rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-white dark:bg-zinc-950">
                <span className="text-xs uppercase tracking-widest text-zinc-500 font-semibold">{t("route.total", lang)}</span>
                <span className="text-2xl font-bold tabular-nums">
                  {formatMinutes(totalMin)} <span className="text-zinc-400 text-sm font-medium">· {formatDistance(totalKm * 1000)}</span>
                </span>
              </div>

              {/* Steps */}
              <ol className="space-y-2">
                <Step
                  iconBg="bg-blue-500"
                  iconLetter="●"
                  title={t("route.from_here", lang)}
                  meta={locStatus === "granted" ? "" : t("route.no_location_fallback", lang)}
                />
                <Step
                  iconBg="bg-emerald-500"
                  iconLetter="A"
                  title={t("route.walk_to_rental", lang)}
                  meta={rental ? `${rental.station_name_ko} · ${formatDistance(walkA * 1000)} · ${formatMinutes(walkingMinutes(walkA))}` : "…"}
                />
                <Step
                  iconBg="bg-emerald-700"
                  iconLetter="B"
                  title={t("route.bike_to_return", lang)}
                  meta={returnSt ? `${returnSt.station_name_ko} · ${formatDistance(bikeKm * 1000)} · ${formatMinutes(bikeMin)}` : "…"}
                  active
                />
                <Step
                  iconBg="bg-amber-500"
                  iconLetter="★"
                  title={t("route.walk_to_venue", lang)}
                  meta={`${eventVenue} · ${formatDistance(walkB * 1000)} · ${formatMinutes(walkingMinutes(walkB))}`}
                />
              </ol>

              {/* External event link */}
              {event.url && (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm text-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                >
                  {t("route.event_link", lang)} ↗
                </a>
              )}

              {routeError && (
                <p className="text-xs text-red-500">{routeError}</p>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function Step({
  iconLetter,
  iconBg,
  title,
  meta,
  active,
}: {
  iconLetter: string;
  iconBg: string;
  title: string;
  meta: string;
  active?: boolean;
}) {
  return (
    <li
      className={[
        "flex gap-3 items-start rounded-xl border px-4 py-3",
        active
          ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
          : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950",
      ].join(" ")}
    >
      <span
        className={[
          "shrink-0 inline-flex items-center justify-center rounded-full text-white font-bold text-xs h-6 w-6",
          iconBg,
        ].join(" ")}
        aria-hidden
      >
        {iconLetter}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug">{title}</div>
        {meta && <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{meta}</div>}
      </div>
    </li>
  );
}
