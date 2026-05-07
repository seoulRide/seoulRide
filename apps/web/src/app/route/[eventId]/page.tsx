import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { RouteClient } from "@/components/RouteClient";
import { getEventsByStation } from "@/lib/data";
import { useLangFromSearch, type Lang } from "@/lib/i18n";
import type { EventEntry } from "@/lib/types";

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

  // Find event across all stations (deduped: pick closest occurrence)
  let found: EventEntry | null = null;
  let bestDistance = Infinity;
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      if (e.id !== decodeURIComponent(eventId)) continue;
      if (e.distance_km < bestDistance) {
        bestDistance = e.distance_km;
        found = e;
      }
    }
  }
  if (!found || found.lat == null || found.lng == null) notFound();

  const event = {
    id: found.id,
    title_ko: found.title_ko,
    title_en: found.title_en,
    venue_ko: found.venue_ko,
    venue_en: found.venue_en,
    lat: found.lat as number,
    lng: found.lng as number,
    url: found.url,
  };

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="relative">
        <RouteClient event={event} lang={lang} />
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
