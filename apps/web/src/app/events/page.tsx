import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { EventCard } from "@/components/EventCard";
import { getEventsByStation, getPopularStations } from "@/lib/data";
import { useLangFromSearch, type Lang, t } from "@/lib/i18n";

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ lng?: string }> }) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const [eventsAll, stations] = await Promise.all([getEventsByStation(), getPopularStations()]);

  // Flatten unique events, prefer the closest occurrence
  const map = new Map<string, any>();
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      const exist = map.get(e.id);
      if (!exist || e.distance_km < exist.distance_km) map.set(e.id, e);
    }
  }
  const all = [...map.values()].sort((a, b) => a.start.localeCompare(b.start));

  // Group by category
  const byCat: Record<string, any[]> = {};
  for (const e of all) (byCat[e.category] ??= []).push(e);
  const order = ["festival", "concert", "exhibition", "performance", "experience"];

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10 sm:space-y-12 pb-28 md:pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">All events near popular stations</h1>
          <p className="text-sm sm:text-base text-zinc-500">{all.length} distinct events found near the {stations.length} most foreigner-rented bike stations.</p>
        </header>
        {order.map((cat) => byCat[cat] && (
          <section key={cat} className="space-y-3">
            <h2 className="text-xs uppercase tracking-widest text-zinc-500">{cat} · {byCat[cat].length}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byCat[cat].slice(0, 24).map((e) => <EventCard key={e.id} event={e} lang={lang} />)}
            </div>
          </section>
        ))}
        <footer className="pt-10 pb-4 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          {t("footer.sources", lang)}
        </footer>
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
