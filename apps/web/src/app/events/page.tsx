import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { EventsClient } from "@/components/EventsClient";
import { getEventsByStation, getPopularStations } from "@/lib/data";
import { useLangFromSearch, type Lang, t } from "@/lib/i18n";
import { getEventStatus } from "@/lib/event-status";
import type { EventEntry } from "@/lib/types";

/**
 * Server entry: fetch + dedupe + drop past events ONCE, then hand the full
 * list off to the client component. All status/price/lang toggling happens
 * client-side from there, so URL changes don't re-trigger fs reads or
 * 300-card HTML generation — the slow path the user reported.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ lng?: string; status?: string; price?: string }>;
}) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);

  const [eventsAll, stations] = await Promise.all([getEventsByStation(), getPopularStations()]);

  // Flatten to unique events; prefer the closest occurrence per id.
  const map = new Map<string, EventEntry>();
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      const exist = map.get(e.id);
      if (!exist || e.distance_km < exist.distance_km) map.set(e.id, e);
    }
  }
  const now = new Date();
  const live = [...map.values()].filter((e) => getEventStatus(e.start, e.end, now) !== "past");

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 pb-28 md:pb-12">
        {/* Suspense boundary required by Next.js 16 because EventsClient
            calls useSearchParams — without it, the whole client tree is
            kicked out of prerendering and the cards never show up in SSR
            HTML. */}
        <Suspense fallback={<div className="py-12 text-center text-sm text-zinc-400">Loading…</div>}>
          <EventsClient events={live} stationsCount={stations.length} />
        </Suspense>

        <footer className="pt-10 pb-4 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          {t("footer.sources", lang)}
        </footer>
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
