import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { RouteClient } from "@/components/RouteClient";
import type { ExplorerEvent } from "@/components/EventExplorer";
import { getEventsByStation } from "@/lib/data";
import { haversineKm } from "@/lib/route-geometry";
import { useLangFromSearch, type Lang } from "@/lib/i18n";

const NEARBY_RADIUS_KM = 3;
const NEARBY_CAP = 30;

export default async function RoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ lng?: string }>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const eventsAll = await getEventsByStation();
  const decoded = decodeURIComponent(eventId);

  // Flatten unique events with coords; tie-break duplicates by closest station distance.
  const flat = new Map<string, ExplorerEvent & { _station_distance_km: number }>();
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      if (e.lat == null || e.lng == null) continue;
      const existing = flat.get(e.id);
      if (existing && existing._station_distance_km <= e.distance_km) continue;
      flat.set(e.id, {
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
        _station_distance_km: e.distance_km,
      });
    }
  }

  const anchor = flat.get(decoded);
  if (!anchor) notFound();

  const nearby = [...flat.values()]
    .filter((e) => e.id !== anchor.id)
    .map((e) => ({ e, d: haversineKm({ lat: anchor.lat, lng: anchor.lng }, { lat: e.lat, lng: e.lng }) }))
    .filter((x) => x.d <= NEARBY_RADIUS_KM)
    .sort((a, b) => a.d - b.d)
    .slice(0, NEARBY_CAP)
    .map((x) => x.e);

  const events: ExplorerEvent[] = [anchor, ...nearby].map(stripInternal);

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="relative">
        <RouteClient events={events} lang={lang} />
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}

function stripInternal(
  e: ExplorerEvent & { _station_distance_km?: number },
): ExplorerEvent {
  const { _station_distance_km: _drop, ...rest } = e;
  void _drop;
  return rest;
}
