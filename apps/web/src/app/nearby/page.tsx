import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { NearbyClient } from "@/components/NearbyClient";
import type { BikeStation } from "@/components/EventExplorer";
import { getEventsByStation, getPopularStations } from "@/lib/data";
import { useLangFromSearch, type Lang } from "@/lib/i18n";
import type { EventEntry } from "@/lib/types";

export default async function NearbyPage({ searchParams }: { searchParams: Promise<{ lng?: string }> }) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const [eventsAll, popularStations] = await Promise.all([
    getEventsByStation(),
    getPopularStations(),
  ]);
  const stations: BikeStation[] = popularStations.map((s) => ({
    station_no: s.station_no,
    name: s.station_name_ko,
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
        <NearbyClient events={events} stations={stations} lang={lang} />
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
