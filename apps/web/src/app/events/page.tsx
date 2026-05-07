import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { EventCard } from "@/components/EventCard";
import { getEventsByStation, getPopularStations } from "@/lib/data";
import { useLangFromSearch, type Lang, t } from "@/lib/i18n";
import { compareEventsByStartThenEnd, getEventStatus, type EventStatus } from "@/lib/event-status";
import type { EventEntry } from "@/lib/types";

const PAST_CAP = 60;

type StatusKey = EventStatus;
const STATUS_KEYS: StatusKey[] = ["ongoing", "upcoming", "past"];

function isStatusKey(s: string | undefined): s is StatusKey {
  return s === "ongoing" || s === "upcoming" || s === "past";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ lng?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const active: StatusKey = isStatusKey(sp.status) ? sp.status : "ongoing";

  const [eventsAll, stations] = await Promise.all([getEventsByStation(), getPopularStations()]);

  // Flatten to unique events, prefer the closest occurrence
  const map = new Map<string, EventEntry>();
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      const exist = map.get(e.id);
      if (!exist || e.distance_km < exist.distance_km) map.set(e.id, e);
    }
  }
  const all = [...map.values()];
  const now = new Date();

  const buckets: Record<StatusKey, EventEntry[]> = { ongoing: [], upcoming: [], past: [] };
  for (const e of all) buckets[getEventStatus(e.start, e.end, now)].push(e);

  // Unified sort: start ASC, ties broken by end ASC (soonest ending first).
  buckets.ongoing.sort(compareEventsByStartThenEnd);
  buckets.upcoming.sort(compareEventsByStartThenEnd);
  buckets.past.sort(compareEventsByStartThenEnd);

  const counts: Record<StatusKey, number> = {
    ongoing: buckets.ongoing.length,
    upcoming: buckets.upcoming.length,
    past: buckets.past.length,
  };
  const visibleEvents = active === "past" ? buckets.past.slice(0, PAST_CAP) : buckets[active];

  const TAB_LABEL: Record<StatusKey, string> = {
    ongoing: t("section.events.ongoing", lang),
    upcoming: t("section.events.upcoming", lang),
    past: t("section.events.past", lang),
  };
  const TAB_COLOR: Record<StatusKey, { dot: string; activeBg: string; activeText: string; activeBorder: string }> = {
    ongoing: {
      dot: "bg-emerald-500",
      activeBg: "bg-emerald-50 dark:bg-emerald-950/40",
      activeText: "text-emerald-700 dark:text-emerald-300",
      activeBorder: "border-emerald-500",
    },
    upcoming: {
      dot: "bg-sky-500",
      activeBg: "bg-sky-50 dark:bg-sky-950/40",
      activeText: "text-sky-700 dark:text-sky-300",
      activeBorder: "border-sky-500",
    },
    past: {
      dot: "bg-zinc-400",
      activeBg: "bg-zinc-100 dark:bg-zinc-900",
      activeText: "text-zinc-700 dark:text-zinc-200",
      activeBorder: "border-zinc-500",
    },
  };

  const lngQs = lang === "ko" ? "&lng=ko" : "";
  const tabHref = (status: StatusKey) => `/events?status=${status}${lngQs}`;

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 pb-28 md:pb-12">
        <header className="space-y-2">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
            {lang === "ko" ? "외국인이 자주 가는 곳, 그 주변 행사" : "All events near popular stations"}
          </h1>
          <p className="text-sm sm:text-base text-zinc-500">
            {lang === "ko"
              ? `외국인 인기 대여소 ${stations.length}곳 주변 ${all.length}개 행사 — 진행 상태별로 보기`
              : `${all.length} distinct events around the ${stations.length} most foreigner-rented bike stations.`}
          </p>
        </header>

        {/* Status tabs */}
        <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
          <nav className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Event status">
            {STATUS_KEYS.map((key) => {
              const isActive = key === active;
              const color = TAB_COLOR[key];
              return (
                <Link
                  key={key}
                  href={tabHref(key)}
                  scroll={false}
                  prefetch={false}
                  role="tab"
                  aria-selected={isActive}
                  className={[
                    "flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium border transition whitespace-nowrap",
                    isActive
                      ? `${color.activeBg} ${color.activeText} ${color.activeBorder}`
                      : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400",
                  ].join(" ")}
                >
                  <span className={`h-2 w-2 rounded-full ${color.dot}`} aria-hidden />
                  <span>{TAB_LABEL[key]}</span>
                  <span className={isActive ? "tabular-nums" : "tabular-nums text-zinc-400"}>{counts[key]}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <section className="space-y-3">
          {visibleEvents.length === 0 ? (
            <p className="text-sm text-zinc-500 py-8 text-center">{t("events.empty", lang)}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleEvents.map((e) => (
                <EventCard key={e.id} event={e} lang={lang} />
              ))}
            </div>
          )}
          {active === "past" && counts.past > PAST_CAP && (
            <p className="text-xs text-zinc-400 pt-2">
              {t("events.past_capped", lang).replace("{n}", String(PAST_CAP))} ({counts.past} total)
            </p>
          )}
        </section>

        <footer className="pt-10 pb-4 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          {t("footer.sources", lang)}
        </footer>
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
