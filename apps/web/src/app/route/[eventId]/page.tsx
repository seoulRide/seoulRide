import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { RouteClient, type ExplorerEvent } from "@/components/RouteClient";
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

  // Flatten all events with coords, dedupe by id (keep the closest occurrence by station distance).
  const seen = new Map<string, ExplorerEvent>();
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      if (e.lat == null || e.lng == null) continue;
      const existing = seen.get(e.id);
      if (existing && existing._station_distance_km <= e.distance_km) continue;
      seen.set(e.id, {
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

  const anchor = seen.get(decoded);
  if (!anchor) notFound();

  // Nearby = events within radius, sorted by distance from anchor, capped.
  const nearby: ExplorerEvent[] = [];
  for (const e of seen.values()) {
    if (e.id === anchor.id) continue;
    const d = haversineKm({ lat: anchor.lat, lng: anchor.lng }, { lat: e.lat, lng: e.lng });
    if (d <= NEARBY_RADIUS_KM) nearby.push({ ...e, _from_anchor_km: d });
  }
  nearby.sort((a, b) => (a._from_anchor_km ?? 0) - (b._from_anchor_km ?? 0));
  const events: ExplorerEvent[] = [
    { ...anchor, _from_anchor_km: 0 },
    ...nearby.slice(0, NEARBY_CAP),
  ];

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
