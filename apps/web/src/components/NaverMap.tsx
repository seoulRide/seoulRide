"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from "react";
import type {
  NaverMarker,
  NaverMap as NaverMapInstance,
  NaverEventListener,
  NaverPolyline,
  NaverBicycleLayer,
  NaverCircle,
} from "@/lib/naver-types";

export interface NaverMapMarker {
  id: string;
  lat: number;
  lng: number;
  /** 0..1 — used for marker color/size */
  intensity?: number;
  label?: string;
}

/** A simple polyline (e.g. a route segment). */
export interface NaverMapPolyline {
  id: string;
  points: { lat: number; lng: number }[];
  color?: string;
  weight?: number;
  dashed?: boolean;
}

/** Translucent emerald (or other color) circles drawn under markers — used
 *  as a poor-person's heatmap by overlapping many of them. */
export interface NaverMapHeatCircle {
  id: string;
  lat: number;
  lng: number;
  /** Radius in meters. */
  radius: number;
  fillColor?: string;
  /** 0..1. Default 0.15. */
  fillOpacity?: number;
}

/** Distinct named markers (e.g. rental/return/event), rendered separately
 *  from the bulk `markers` array so they don't compete for ids. */
export interface NaverMapNamedMarker {
  id: string;
  lat: number;
  lng: number;
  /** Pre-rendered HTML content for the icon. */
  html: string;
  /** Anchor pixel offset so the marker tip lands on (lat,lng). */
  anchor?: { x: number; y: number };
  zIndex?: number;
  /** Hide the marker when the current map zoom is below this threshold.
   *  Useful for dense low-priority markers that would clutter wide views. */
  minZoom?: number;
  /** When true, the marker is clickable and `onMarkerClick(id)` fires on tap. */
  clickable?: boolean;
}

export interface NaverMapHandle {
  panTo(lat: number, lng: number): void;
  setZoom(level: number): void;
  getInstance(): NaverMapInstance | null;
  getContainer(): HTMLDivElement | null;
}

interface NaverMapProps {
  markers: NaverMapMarker[];
  selectedId?: string | null;
  center?: { lat: number; lng: number };
  /** Naver zoom: 0~21, higher = closer. ~11 fits Seoul */
  zoom?: number;
  className?: string;
  onMarkerClick?: (id: string) => void;
  /** When true, ensure all markers are visible on initial render (auto-fit bounds). */
  fitBounds?: boolean;
  /** Optional separate "current location" marker rendered with a distinct style. */
  here?: { lat: number; lng: number } | null;
  /** Optional polylines (route segments) drawn under markers. */
  polylines?: NaverMapPolyline[];
  /** Optional named markers (rental, return, event venue, ...). */
  extraMarkers?: NaverMapNamedMarker[];
  /** Translucent circles drawn beneath markers — overlap to produce a
   *  blob/heatmap effect. */
  heatCircles?: NaverMapHeatCircle[];
  /** Fired with the current zoom level on init and on every zoom_changed. */
  onZoomChange?: (zoom: number) => void;
  /** Overlay NAVER's bicycle road tile layer on top of the base map. */
  showBicycleLayer?: boolean;
}

const FALLBACK_CENTER = { lat: 37.5665, lng: 126.978 }; // 시청 광장
const SEOUL_FIT_PADDING = 60;

function colorFor(intensity: number): string {
  if (intensity > 0.6) return "#dc2626";
  if (intensity > 0.3) return "#f59e0b";
  return "#10b981";
}

function markerHtml(opts: { intensity: number; selected: boolean; label?: string }): string {
  const { intensity, selected, label } = opts;
  const size = Math.round(14 + intensity * 24);
  const color = colorFor(intensity);
  const ring = selected ? "box-shadow: 0 0 0 4px rgba(16,185,129,0.35);" : "";
  return `
    <div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${color};opacity:0.85;
      border:1.5px solid rgba(255,255,255,0.9);
      ${ring}
      cursor:pointer;
      position:relative;
      font-family:system-ui,sans-serif;
    ">${label ? `<span style="
      position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      color:white;font-weight:700;font-size:10px;line-height:1;
    ">${label}</span>` : ""}</div>`;
}

function hereMarkerHtml(): string {
  return `
    <div style="position:relative;pointer-events:none;">
      <div style="
        width:18px;height:18px;border-radius:9999px;background:#3b82f6;
        border:3px solid white;box-shadow:0 0 0 6px rgba(59,130,246,0.18);
      "></div>
    </div>`;
}

function MissingKey() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/40 dark:bg-zinc-900/40 h-[55vh] sm:h-[60vh] md:h-[68vh] flex items-center justify-center p-6">
      <div className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
        Map key missing.<br />
        Set <code className="font-mono">NEXT_PUBLIC_NAVER_MAP_CLIENT_ID</code> in <code className="font-mono">.env.local</code> and register your domain in the NCP console (Web Service URL).
      </div>
    </div>
  );
}

export const NaverMap = forwardRef<NaverMapHandle, NaverMapProps>(function NaverMap(
  {
    markers,
    selectedId,
    center,
    zoom = 11,
    className,
    onMarkerClick,
    fitBounds = false,
    here = null,
    polylines,
    extraMarkers,
    heatCircles,
    showBicycleLayer = false,
    onZoomChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const markersRef = useRef<Map<string, { marker: NaverMarker; listener: NaverEventListener | null }>>(new Map());
  const namedMarkersRef = useRef<Map<string, { marker: NaverMarker; minZoom?: number; listener: NaverEventListener | null }>>(new Map());
  const polylinesRef = useRef<Map<string, NaverPolyline>>(new Map());
  const hereMarkerRef = useRef<NaverMarker | null>(null);
  const bicycleLayerRef = useRef<NaverBicycleLayer | null>(null);
  const heatCirclesRef = useRef<Map<string, NaverCircle>>(new Map());
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  const key = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;

  useImperativeHandle(ref, () => ({
    panTo(lat, lng) {
      const m = mapRef.current;
      const n = window.naver;
      if (!m || !n) return;
      m.panTo(new n.maps.LatLng(lat, lng), { duration: 320, easing: "easeOutCubic" });
    },
    setZoom(z) {
      const m = mapRef.current;
      if (!m) return;
      m.setZoom(z, true);
    },
    getContainer() {
      return containerRef.current;
    },
    getInstance() {
      return mapRef.current;
    },
  }), []);

  // Initialize map once SDK ready
  const initMap = useCallback(() => {
    const n = window.naver;
    if (!n || !containerRef.current || mapRef.current) return;
    const c = center ?? FALLBACK_CENTER;
    const map = new n.maps.Map(containerRef.current, {
      center: new n.maps.LatLng(c.lat, c.lng),
      zoom,
      logoControl: true,
      mapDataControl: false,
      mapTypeControl: false,
      scaleControl: false,
      zoomControl: false,
    });
    mapRef.current = map;
    setMapReady(true);
  }, [center, zoom]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let raf: number | null = null;
    const tryInit = () => {
      const n = window.naver;
      if (cancelled) return;
      if (n && n.maps && typeof n.maps.Map === "function") {
        initMap();
      } else {
        raf = window.requestAnimationFrame(tryInit);
      }
    };
    tryInit();
    return () => {
      cancelled = true;
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [key, initMap]);

  // Sync markers
  useEffect(() => {
    const n = window.naver;
    const map = mapRef.current;
    if (!n || !map) return;

    const present = new Set(markers.map((m) => m.id));
    // remove gone markers
    for (const [id, entry] of markersRef.current) {
      if (!present.has(id)) {
        if (entry.listener) n.maps.Event.removeListener(entry.listener);
        entry.marker.setMap(null);
        markersRef.current.delete(id);
      }
    }

    for (const m of markers) {
      const html = markerHtml({
        intensity: m.intensity ?? 0.5,
        selected: selectedId === m.id,
        label: m.label,
      });
      const size = Math.round(14 + (m.intensity ?? 0.5) * 24);
      const anchor = new n.maps.Point(size / 2, size / 2);
      const existing = markersRef.current.get(m.id);
      if (existing) {
        existing.marker.setPosition(new n.maps.LatLng(m.lat, m.lng));
        existing.marker.setIcon({ content: html, anchor });
        if (selectedId === m.id) existing.marker.setZIndex(9999);
        else existing.marker.setZIndex(1);
      } else {
        const marker = new n.maps.Marker({
          position: new n.maps.LatLng(m.lat, m.lng),
          map,
          icon: { content: html, anchor },
          zIndex: selectedId === m.id ? 9999 : 1,
          clickable: true,
        });
        const listener = n.maps.Event.addListener(marker, "click", () => onClickRef.current?.(m.id));
        markersRef.current.set(m.id, { marker, listener });
      }
    }

    if (fitBounds && (markers.length > 0 || (extraMarkers?.length ?? 0) > 0 || (polylines?.length ?? 0) > 0)) {
      const bounds = new n.maps.LatLngBounds();
      for (const m of markers) bounds.extend(new n.maps.LatLng(m.lat, m.lng));
      for (const m of extraMarkers ?? []) bounds.extend(new n.maps.LatLng(m.lat, m.lng));
      for (const pl of polylines ?? []) for (const p of pl.points) bounds.extend(new n.maps.LatLng(p.lat, p.lng));
      if (here) bounds.extend(new n.maps.LatLng(here.lat, here.lng));
      map.fitBounds(bounds, SEOUL_FIT_PADDING);
    }
  }, [markers, selectedId, fitBounds, here, mapReady, extraMarkers, polylines]);

  // Sync polylines
  useEffect(() => {
    const n = window.naver;
    const map = mapRef.current;
    if (!n || !map) return;
    const present = new Set((polylines ?? []).map((p) => p.id));
    for (const [id, line] of polylinesRef.current) {
      if (!present.has(id)) {
        line.setMap(null);
        polylinesRef.current.delete(id);
      }
    }
    for (const pl of polylines ?? []) {
      const path = pl.points.map((p) => new n.maps.LatLng(p.lat, p.lng));
      const opts = {
        path,
        map,
        strokeColor: pl.color ?? "#10b981",
        strokeWeight: pl.weight ?? 4,
        strokeOpacity: 0.85,
        strokeStyle: pl.dashed ? ("shortdash" as const) : ("solid" as const),
        strokeLineCap: "round" as const,
        strokeLineJoin: "round" as const,
        clickable: false,
      };
      const existing = polylinesRef.current.get(pl.id);
      if (existing) {
        existing.setPath(path);
        existing.setOptions(opts);
      } else {
        polylinesRef.current.set(pl.id, new n.maps.Polyline(opts));
      }
    }
  }, [polylines, mapReady]);

  // Sync extra markers (named)
  useEffect(() => {
    const n = window.naver;
    const map = mapRef.current;
    if (!n || !map) return;
    const present = new Set((extraMarkers ?? []).map((m) => m.id));
    for (const [id, entry] of namedMarkersRef.current) {
      if (!present.has(id)) {
        if (entry.listener) n.maps.Event.removeListener(entry.listener);
        entry.marker.setMap(null);
        namedMarkersRef.current.delete(id);
      }
    }
    const currentZoom = map.getZoom();
    for (const m of extraMarkers ?? []) {
      const node = document.createElement("div");
      node.innerHTML = m.html;
      const anchor = m.anchor ? new n.maps.Point(m.anchor.x, m.anchor.y) : new n.maps.Point(12, 12);
      const visible = m.minZoom == null || currentZoom >= m.minZoom;
      const clickable = m.clickable === true;
      const existing = namedMarkersRef.current.get(m.id);
      if (existing) {
        existing.marker.setPosition(new n.maps.LatLng(m.lat, m.lng));
        existing.marker.setIcon({ content: node, anchor });
        existing.marker.setZIndex(m.zIndex ?? 5000);
        existing.marker.setVisible(visible);
        existing.minZoom = m.minZoom;
      } else {
        const marker = new n.maps.Marker({
          position: new n.maps.LatLng(m.lat, m.lng),
          map,
          icon: { content: node, anchor },
          zIndex: m.zIndex ?? 5000,
          clickable,
          visible,
        });
        const listener = clickable
          ? n.maps.Event.addListener(marker, "click", () => onClickRef.current?.(m.id))
          : null;
        namedMarkersRef.current.set(m.id, { marker, minZoom: m.minZoom, listener });
      }
    }
  }, [extraMarkers, mapReady]);

  // Heat circles — translucent emerald discs that overlap to suggest density.
  useEffect(() => {
    const n = window.naver;
    const map = mapRef.current;
    if (!n || !map) return;
    const present = new Set((heatCircles ?? []).map((c) => c.id));
    for (const [id, circle] of heatCirclesRef.current) {
      if (!present.has(id)) {
        circle.setMap(null);
        heatCirclesRef.current.delete(id);
      }
    }
    for (const c of heatCircles ?? []) {
      const opts = {
        center: new n.maps.LatLng(c.lat, c.lng),
        radius: c.radius,
        map,
        strokeWeight: 0,
        fillColor: c.fillColor ?? "#10b981",
        fillOpacity: c.fillOpacity ?? 0.15,
        clickable: false,
        zIndex: 10,
      };
      const existing = heatCirclesRef.current.get(c.id);
      if (existing) {
        existing.setCenter(new n.maps.LatLng(c.lat, c.lng));
        existing.setRadius(c.radius);
        existing.setOptions({
          fillColor: opts.fillColor,
          fillOpacity: opts.fillOpacity,
        });
      } else {
        heatCirclesRef.current.set(c.id, new n.maps.Circle(opts));
      }
    }
  }, [heatCircles, mapReady]);

  // Bicycle road layer (toggle on/off)
  useEffect(() => {
    const n = window.naver;
    const map = mapRef.current;
    if (!n || !map) return;
    if (showBicycleLayer) {
      if (!bicycleLayerRef.current) {
        bicycleLayerRef.current = new n.maps.BicycleLayer();
      }
      bicycleLayerRef.current.setMap(map);
    } else if (bicycleLayerRef.current) {
      bicycleLayerRef.current.setMap(null);
    }
  }, [showBicycleLayer, mapReady]);

  // Zoom listener: gated visibility for named markers with `minZoom`,
  // and a callback to consumers that want to react to zoom (e.g. shrink
  // heatmap circles on zoom-in).
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;
  useEffect(() => {
    const n = window.naver;
    const map = mapRef.current;
    if (!n || !map) return;
    const apply = () => {
      const z = map.getZoom();
      for (const entry of namedMarkersRef.current.values()) {
        if (entry.minZoom == null) continue;
        entry.marker.setVisible(z >= entry.minZoom);
      }
      onZoomChangeRef.current?.(z);
    };
    apply(); // emit initial zoom
    const listener = n.maps.Event.addListener(map, "zoom_changed", apply);
    return () => { n.maps.Event.removeListener(listener); };
  }, [mapReady]);

  // "here" (current location) overlay
  useEffect(() => {
    const n = window.naver;
    const map = mapRef.current;
    if (!n || !map) return;
    if (here) {
      const icon = { content: hereMarkerHtml(), anchor: new n.maps.Point(12, 12) };
      if (!hereMarkerRef.current) {
        hereMarkerRef.current = new n.maps.Marker({
          position: new n.maps.LatLng(here.lat, here.lng),
          map,
          icon,
          zIndex: 10000,
          clickable: false,
        });
      } else {
        hereMarkerRef.current.setPosition(new n.maps.LatLng(here.lat, here.lng));
        hereMarkerRef.current.setIcon(icon);
      }
    } else if (hereMarkerRef.current) {
      hereMarkerRef.current.setMap(null);
      hereMarkerRef.current = null;
    }
  }, [here, mapReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const n = window.naver;
      for (const entry of markersRef.current.values()) {
        if (entry.listener && n) n.maps.Event.removeListener(entry.listener);
        entry.marker.setMap(null);
      }
      markersRef.current.clear();
      for (const entry of namedMarkersRef.current.values()) {
        if (entry.listener && n) n.maps.Event.removeListener(entry.listener);
        entry.marker.setMap(null);
      }
      namedMarkersRef.current.clear();
      for (const p of polylinesRef.current.values()) p.setMap(null);
      polylinesRef.current.clear();
      for (const c of heatCirclesRef.current.values()) c.setMap(null);
      heatCirclesRef.current.clear();
      if (hereMarkerRef.current) {
        hereMarkerRef.current.setMap(null);
        hereMarkerRef.current = null;
      }
      if (bicycleLayerRef.current) {
        bicycleLayerRef.current.setMap(null);
        bicycleLayerRef.current = null;
      }
      if (mapRef.current) {
        try { mapRef.current.destroy(); } catch { /* noop */ }
        mapRef.current = null;
      }
    };
  }, []);

  if (!key) return <MissingKey />;

  return (
    <div
      ref={containerRef}
      className={className ?? "h-[55vh] sm:h-[60vh] md:h-[68vh] w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"}
    />
  );
});
