import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { EventCard } from "@/components/EventCard";
import { getEventsByStation, getPopularStations } from "@/lib/data";
import { useLangFromSearch, type Lang, t } from "@/lib/i18n";
import { compareEventsByStartThenEnd, getEventStatus } from "@/lib/event-status";
import type { EventEntry } from "@/lib/types";

type StatusKey = "ongoing" | "upcoming";
type PriceKey = "all" | "free" | "paid";

const STATUS_KEYS: StatusKey[] = ["ongoing", "upcoming"];
const PRICE_KEYS: PriceKey[] = ["all", "free", "paid"];

function isStatusKey(s: string | undefined): s is StatusKey {
  return s === "ongoing" || s === "upcoming";
}
function isPriceKey(s: string | undefined): s is PriceKey {
  return s === "all" || s === "free" || s === "paid";
}

function priceBucket(price: string): "free" | "paid" {
  return price === "Free" ? "free" : "paid";
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ lng?: string; status?: string; price?: string }>;
}) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const activeStatus: StatusKey = isStatusKey(sp.status) ? sp.status : "ongoing";
  const activePrice: PriceKey = isPriceKey(sp.price) ? sp.price : "all";

  const [eventsAll, stations] = await Promise.all([getEventsByStation(), getPopularStations()]);

  // Flatten to unique events; prefer the closest occurrence per id.
  const map = new Map<string, EventEntry>();
  for (const sid in eventsAll) {
    for (const e of eventsAll[sid]) {
      const exist = map.get(e.id);
      if (!exist || e.distance_km < exist.distance_km) map.set(e.id, e);
    }
  }
  // Drop ended events entirely.
  const now = new Date();
  const all = [...map.values()].filter((e) => getEventStatus(e.start, e.end, now) !== "past");

  const statusBuckets: Record<StatusKey, EventEntry[]> = { ongoing: [], upcoming: [] };
  for (const e of all) {
    const s = getEventStatus(e.start, e.end, now);
    if (s === "ongoing" || s === "upcoming") statusBuckets[s].push(e);
  }
  statusBuckets.ongoing.sort(compareEventsByStartThenEnd);
  statusBuckets.upcoming.sort(compareEventsByStartThenEnd);

  const statusCounts: Record<StatusKey, number> = {
    ongoing: statusBuckets.ongoing.length,
    upcoming: statusBuckets.upcoming.length,
  };

  const inStatus = statusBuckets[activeStatus];
  const visibleEvents =
    activePrice === "all" ? inStatus : inStatus.filter((e) => priceBucket(e.price) === activePrice);

  // Price counts derived from the active status bucket so users see live tallies.
  const priceCounts: Record<PriceKey, number> = {
    all: inStatus.length,
    free: inStatus.filter((e) => priceBucket(e.price) === "free").length,
    paid: inStatus.filter((e) => priceBucket(e.price) === "paid").length,
  };

  const TAB_LABEL: Record<StatusKey, string> = {
    ongoing: t("section.events.ongoing", lang),
    upcoming: t("section.events.upcoming", lang),
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
  };
  const PRICE_LABEL: Record<PriceKey, string> = {
    all: t("filter.price.all", lang),
    free: t("filter.price.free", lang),
    paid: t("filter.price.paid", lang),
  };

  const baseQs = (status: StatusKey, price: PriceKey) => {
    const qs = new URLSearchParams();
    qs.set("status", status);
    if (price !== "all") qs.set("price", price);
    if (lang === "ko") qs.set("lng", "ko");
    return `/events?${qs.toString()}`;
  };

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
              ? `외국인 인기 대여소 ${stations.length}곳 주변 ${all.length}개 행사 — 진행 상태와 가격으로 필터하세요`
              : `${all.length} events around the ${stations.length} most foreigner-rented stations — filter by status and price.`}
          </p>
        </header>

        {/* Status tabs */}
        <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 space-y-2">
          <nav className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Event status">
            {STATUS_KEYS.map((key) => {
              const isActive = key === activeStatus;
              const color = TAB_COLOR[key];
              return (
                <Link
                  key={key}
                  href={baseQs(key, activePrice)}
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
                  <span className={isActive ? "tabular-nums" : "tabular-nums text-zinc-400"}>{statusCounts[key]}</span>
                </Link>
              );
            })}
          </nav>
          {/* Price chips */}
          <div className="flex items-center gap-2 overflow-x-auto" role="group" aria-label={t("filter.price.label", lang)}>
            <span className="text-xs uppercase tracking-wide text-zinc-400 shrink-0">
              {t("filter.price.label", lang)}
            </span>
            {PRICE_KEYS.map((key) => {
              const isActive = key === activePrice;
              return (
                <Link
                  key={key}
                  href={baseQs(activeStatus, key)}
                  scroll={false}
                  prefetch={false}
                  aria-pressed={isActive}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-medium border transition whitespace-nowrap",
                    isActive
                      ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                      : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400",
                  ].join(" ")}
                >
                  <span>{PRICE_LABEL[key]}</span>
                  <span className={`ml-1 tabular-nums ${isActive ? "" : "text-zinc-400"}`}>{priceCounts[key]}</span>
                </Link>
              );
            })}
          </div>
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
        </section>

        <footer className="pt-10 pb-4 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          {t("footer.sources", lang)}
        </footer>
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
