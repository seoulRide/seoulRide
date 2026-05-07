import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { EventCard } from "@/components/EventCard";
import { getEventsByStation, getPopularStations } from "@/lib/data";
import { useLangFromSearch, type Lang, t } from "@/lib/i18n";
import { getEventStatus } from "@/lib/event-status";
import type { EventEntry } from "@/lib/types";

const PAST_CAP = 60;

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ lng?: string }> }) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const [eventsAll, stations] = await Promise.all([getEventsByStation(), getPopularStations()]);

  // Flatten unique events, prefer the closest occurrence (lowest distance_km)
  const map = new Map<string, EventEntry>();
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      const exist = map.get(e.id);
      if (!exist || e.distance_km < exist.distance_km) map.set(e.id, e);
    }
  }
  const all = [...map.values()];
  const now = new Date();

  const ongoing: EventEntry[] = [];
  const upcoming: EventEntry[] = [];
  const past: EventEntry[] = [];
  for (const e of all) {
    const s = getEventStatus(e.start, e.end, now);
    if (s === "ongoing") ongoing.push(e);
    else if (s === "upcoming") upcoming.push(e);
    else past.push(e);
  }
  // Sort within each section by relevance
  ongoing.sort((a, b) => (a.end || a.start).localeCompare(b.end || b.start)); // soonest ending
  upcoming.sort((a, b) => a.start.localeCompare(b.start)); // soonest starting
  past.sort((a, b) => (b.end || b.start).localeCompare(a.end || a.start)); // most recently ended
  const pastTrimmed = past.slice(0, PAST_CAP);

  const sections = [
    { key: "ongoing", title: t("section.events.ongoing", lang), color: "text-emerald-600", events: ongoing },
    { key: "upcoming", title: t("section.events.upcoming", lang), color: "text-sky-600", events: upcoming },
    { key: "past", title: t("section.events.past", lang), color: "text-zinc-500", events: pastTrimmed, totalCount: past.length },
  ] as const;

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10 sm:space-y-12 pb-28 md:pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
            {lang === "ko" ? "외국인이 자주 가는 곳, 그 주변 행사" : "All events near popular stations"}
          </h1>
          <p className="text-sm sm:text-base text-zinc-500">
            {lang === "ko"
              ? `외국인 인기 대여소 ${stations.length}곳 주변에서 찾은 ${all.length}개 행사 — 진행 상태별로 정리.`
              : `${all.length} distinct events around the ${stations.length} most foreigner-rented bike stations, grouped by status.`}
          </p>
        </header>

        {sections.map((section) => (
          <section key={section.key} className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h2 className={`text-xs uppercase tracking-widest font-semibold ${section.color}`}>
                {section.title}
              </h2>
              <span className="text-xs text-zinc-400 tabular-nums">{section.events.length}</span>
            </div>
            {section.events.length === 0 ? (
              <p className="text-sm text-zinc-500">{t("events.empty", lang)}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.events.map((e) => (
                  <EventCard key={e.id} event={e} lang={lang} />
                ))}
              </div>
            )}
            {section.key === "past" && "totalCount" in section && section.totalCount > PAST_CAP && (
              <p className="text-xs text-zinc-400">
                {t("events.past_capped", lang).replace("{n}", String(PAST_CAP))} ({section.totalCount} total)
              </p>
            )}
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
