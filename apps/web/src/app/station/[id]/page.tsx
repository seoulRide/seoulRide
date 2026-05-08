import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { EventCard } from "@/components/EventCard";
import { FoodCard } from "@/components/FoodCard";
import { WeatherWidget } from "@/components/WeatherWidget";
import {
  getStationById,
  getEventsByStation,
  getFoodByStation,
  getWeatherByGu,
} from "@/lib/data";
import { t, useLangFromSearch, type Lang } from "@/lib/i18n";
import {
  compareEventsByStartThenEnd,
  getEventStatus,
  type EventStatus,
} from "@/lib/event-status";
import type { EventEntry } from "@/lib/types";

const STATUS_KEYS: EventStatus[] = ["ongoing", "upcoming", "past"];

function isStatusKey(s: string | undefined): s is EventStatus {
  return s === "ongoing" || s === "upcoming" || s === "past";
}

export default async function StationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lng?: string; status?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const decoded = decodeURIComponent(id);
  const station = await getStationById(decoded);
  if (!station) notFound();

  const [eventsAll, foodAll, weatherAll] = await Promise.all([
    getEventsByStation(),
    getFoodByStation(),
    getWeatherByGu(),
  ]);
  const events = (eventsAll[station.station_no] ?? []).slice().sort(compareEventsByStartThenEnd);
  const food = foodAll[station.station_no] ?? null;
  const weather = station.gu_en ? weatherAll[station.gu_en] : null;
  const name = station.station_name_ko;
  const gu = lang === "ko" ? station.gu_ko : station.gu_en ?? station.gu_ko;

  // Bucket events by status
  const now = new Date();
  const buckets: Record<EventStatus, EventEntry[]> = { ongoing: [], upcoming: [], past: [] };
  for (const e of events) buckets[getEventStatus(e.start, e.end, now)].push(e);
  const counts: Record<EventStatus, number> = {
    ongoing: buckets.ongoing.length,
    upcoming: buckets.upcoming.length,
    past: buckets.past.length,
  };
  // Smart default: explicit override > first non-empty > ongoing
  const explicit = isStatusKey(sp.status) ? sp.status : null;
  const fallback = STATUS_KEYS.find((k) => counts[k] > 0) ?? "ongoing";
  const active: EventStatus = explicit ?? fallback;
  const visibleEvents = buckets[active];

  const TAB_LABEL: Record<EventStatus, string> = {
    ongoing: t("section.events.ongoing", lang),
    upcoming: t("section.events.upcoming", lang),
    past: t("section.events.past", lang),
  };
  const TAB_COLOR: Record<EventStatus, { dot: string; activeBg: string; activeText: string; activeBorder: string }> = {
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
  const tabHref = (status: EventStatus) =>
    `/station/${encodeURIComponent(station.station_no)}?status=${status}${lngQs}`;

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-12 pb-28 md:pb-12">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
            <span>#{station.rank_overall} · {gu}</span>
            {station.is_outlier && <span className="text-amber-600">· {t("card.spike", lang).toLowerCase()}</span>}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">{name}</h1>
          <p className="text-sm sm:text-base text-zinc-500">{station.address}</p>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-4xl sm:text-5xl font-bold tabular-nums">{station.rent_total.toLocaleString()}</span>
            <span className="text-sm text-zinc-500">{t("card.rentals", lang)}</span>
          </div>
        </header>

        {/* Mobile: weather/food before events. md+: aside layout. */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <aside className="md:col-span-1 md:order-2 space-y-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 sm:gap-4 md:gap-6">
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-zinc-500">{t("section.weather", lang)}</h2>
              {weather && <WeatherWidget w={weather} lang={lang} />}
            </div>
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-zinc-500">{t("section.food_nearby", lang)}</h2>
              {food && <FoodCard food={food} lang={lang} />}
            </div>
          </aside>
          <div className="md:col-span-2 md:order-1 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs uppercase tracking-widest text-zinc-500">
                {t("section.events_nearby", lang)} ({events.length})
              </h2>
            </div>

            {/* Status tabs */}
            <nav className="flex gap-2 overflow-x-auto -mx-1 px-1" role="tablist" aria-label="Event status">
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
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap",
                      isActive
                        ? `${color.activeBg} ${color.activeText} ${color.activeBorder}`
                        : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400",
                    ].join(" ")}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} aria-hidden />
                    <span>{TAB_LABEL[key]}</span>
                    <span className={isActive ? "tabular-nums" : "tabular-nums text-zinc-400"}>{counts[key]}</span>
                  </Link>
                );
              })}
            </nav>

            {visibleEvents.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4">{t("events.empty", lang)}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleEvents.map((e) => (
                  <EventCard key={e.id} event={e} lang={lang} />
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="pt-10 pb-4 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          {t("footer.sources", lang)}
        </footer>
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
