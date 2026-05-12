import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { NearbyClient } from "@/components/NearbyClient";
import type { BikeStation } from "@/components/EventExplorer";
import {
  getEventsByStation,
  getAllStationsLite,
  getPopularStations,
  getAllRecommendations,
} from "@/lib/data";
import { useLangFromSearch, type Lang } from "@/lib/i18n";
import type { EventEntry } from "@/lib/types";

export default async function NearbyPage({
  searchParams,
}: {
  searchParams: Promise<{ lng?: string; focus?: string }>;
}) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const focusId = sp.focus ? decodeURIComponent(sp.focus) : undefined;
  const [eventsAll, allStations, popularStations, recommendations] = await Promise.all([
    getEventsByStation(),
    getAllStationsLite(),
    getPopularStations(),
    getAllRecommendations(),
  ]);
  const stations: BikeStation[] = allStations.map((s) => ({
    station_no: s.station_no,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
  }));
  // Lean anchors list for the client (only fields needed for nearest-anchor matching).
  const popularAnchors = popularStations.map((s) => ({
    station_no: s.station_no,
    lat: s.lat,
    lng: s.lng,
  }));

  // Flatten unique events, prefer the closest occurrence (lowest distance_km from any station)
  const map = new Map<string, EventEntry>();
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      const exist = map.get(e.id);
      if (!exist || e.distance_km < exist.distance_km) map.set(e.id, e);
    }
  }
  const events = [...map.values()].filter((e) => e.lat != null && e.lng != null);

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="relative pb-0">
        <NearbyClient
          events={events}
          stations={stations}
          popularAnchors={popularAnchors}
          recommendations={recommendations}
          focusId={focusId}
          lang={lang}
        />
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
