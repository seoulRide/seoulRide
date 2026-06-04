"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EventCard } from "./EventCard";
import { compareEventsByStartThenEnd, getEventStatus } from "@/lib/event-status";
import { t, useLangFromSearch, type Lang } from "@/lib/i18n";
import type { EventEntry } from "@/lib/types";

type StatusKey = "ongoing" | "upcoming";
type PriceKey = "all" | "free" | "paid";

const STATUS_KEYS: StatusKey[] = ["ongoing", "upcoming"];
const PRICE_KEYS: PriceKey[] = ["all", "free", "paid"];
const PAGE_SIZE = 30;

function isStatusKey(s: string | null | undefined): s is StatusKey {
  return s === "ongoing" || s === "upcoming";
}
function isPriceKey(s: string | null | undefined): s is PriceKey {
  return s === "all" || s === "free" || s === "paid";
}
function priceBucket(price: string): "free" | "paid" {
  return price === "Free" ? "free" : "paid";
}

export function EventsClient({
  events,
  stationsCount,
}: {
  events: EventEntry[];
  stationsCount: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const lang: Lang = useLangFromSearch({ lng: sp.get("lng") ?? undefined });
  const activeStatus: StatusKey = isStatusKey(sp.get("status")) ? (sp.get("status") as StatusKey) : "ongoing";
  const activePrice: PriceKey = isPriceKey(sp.get("price")) ? (sp.get("price") as PriceKey) : "all";

  // Search state — seeded from URL once, then local. A debounced effect
  // writes back to ?q= so the URL stays shareable without history thrash
  // on every keystroke.
  const initialQuery = sp.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const trimmedQuery = query.trim().toLowerCase();

  // Status buckets are derived from the search-filtered list so that the
  // tab counts reflect what matches the query. getEventStatus is cheap
  // (date math) and the includes() pass is O(n) over a few hundred items.
  const statusBuckets = useMemo(() => {
    const now = new Date();
    const ongoing: EventEntry[] = [];
    const upcoming: EventEntry[] = [];
    for (const e of events) {
      if (trimmedQuery) {
        const hay = `${e.title_ko}\n${e.title_en}\n${e.venue_ko}\n${e.venue_en}`.toLowerCase();
        if (!hay.includes(trimmedQuery)) continue;
      }
      const s = getEventStatus(e.start, e.end, now);
      if (s === "ongoing") ongoing.push(e);
      else if (s === "upcoming") upcoming.push(e);
    }
    ongoing.sort(compareEventsByStartThenEnd);
    upcoming.sort(compareEventsByStartThenEnd);
    return { ongoing, upcoming } as Record<StatusKey, EventEntry[]>;
  }, [events, trimmedQuery]);

  const inStatus = statusBuckets[activeStatus];
  const filtered = useMemo(
    () =>
      activePrice === "all" ? inStatus : inStatus.filter((e) => priceBucket(e.price) === activePrice),
    [inStatus, activePrice],
  );

  const statusCounts: Record<StatusKey, number> = {
    ongoing: statusBuckets.ongoing.length,
    upcoming: statusBuckets.upcoming.length,
  };
  const priceCounts: Record<PriceKey, number> = useMemo(
    () => ({
      all: inStatus.length,
      free: inStatus.filter((e) => priceBucket(e.price) === "free").length,
      paid: inStatus.filter((e) => priceBucket(e.price) === "paid").length,
    }),
    [inStatus],
  );

  // Infinite scroll — slice the filtered list down to visibleCount cards.
  // Reset whenever filters change so the user starts at the top of the new
  // bucket instead of inheriting an unrelated scroll depth.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeStatus, activePrice, trimmedQuery]);

  // Debounced URL sync for ?q=. 250ms is short enough to feel live in the
  // address bar but long enough to coalesce a burst of typing into one
  // history-less replace.
  useEffect(() => {
    const id = setTimeout(() => {
      const qs = new URLSearchParams(sp.toString());
      if (trimmedQuery) qs.set("q", query.trim());
      else qs.delete("q");
      const next = qs.toString();
      if (next === sp.toString()) return;
      router.replace(`/events${next ? `?${next}` : ""}`, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
    // sp/router are reactive but we only want this firing on query edits;
    // status/price changes already replace() themselves via setParam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery]);

  const visibleEvents = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === "undefined") return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((x) => x.isIntersecting)) {
          setVisibleCount((c) => c + PAGE_SIZE);
        }
      },
      { rootMargin: "400px 0px" }, // start loading well before sentinel enters viewport
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, filtered.length]);

  // URL syncing — push status/price into the URL so back/forward and shared
  // links work. Scroll preserved (scroll: false) and shallow so the server
  // tree doesn't tear down.
  const setParam = useCallback(
    (next: { status?: StatusKey; price?: PriceKey }) => {
      const qs = new URLSearchParams(sp.toString());
      const s = next.status ?? activeStatus;
      const p = next.price ?? activePrice;
      qs.set("status", s);
      if (p === "all") qs.delete("price");
      else qs.set("price", p);
      router.replace(`/events?${qs.toString()}`, { scroll: false });
    },
    [router, sp, activeStatus, activePrice],
  );

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

  return (
    <>
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
          {lang === "ko" ? "외국인이 자주 가는 곳, 그 주변 행사" : "All events near popular stations"}
        </h1>
        <p className="text-sm sm:text-base text-zinc-500">
          {lang === "ko"
            ? `외국인 인기 대여소 ${stationsCount}곳 주변 ${events.length}개 행사 — 진행 상태와 가격으로 필터하세요`
            : `${events.length} events around the ${stationsCount} most foreigner-rented stations — filter by status and price.`}
        </p>
      </header>

      {/* Search + status tabs + price chips */}
      <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 space-y-2">
        <div className="relative">
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m17 17-3.2-3.2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("events.search.placeholder", lang)}
            aria-label={t("events.search.placeholder", lang)}
            className="w-full pl-9 pr-9 py-2 rounded-full text-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("events.search.clear", lang)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <nav className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Event status">
          {STATUS_KEYS.map((key) => {
            const isActive = key === activeStatus;
            const color = TAB_COLOR[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setParam({ status: key })}
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
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 overflow-x-auto" role="group" aria-label={t("filter.price.label", lang)}>
          <span className="text-xs uppercase tracking-wide text-zinc-400 shrink-0">
            {t("filter.price.label", lang)}
          </span>
          {PRICE_KEYS.map((key) => {
            const isActive = key === activePrice;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setParam({ price: key })}
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
              </button>
            );
          })}
        </div>
      </div>

      <section className="space-y-3">
        {visibleEvents.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center">
            {trimmedQuery
              ? t("events.search.no_match", lang).replace("{q}", query.trim())
              : t("events.empty", lang)}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleEvents.map((e) => (
              <EventCard key={e.id} event={e} lang={lang} />
            ))}
          </div>
        )}
        {hasMore && (
          <div ref={sentinelRef} className="py-6 text-center text-xs text-zinc-400">
            {lang === "ko" ? "더 불러오는 중…" : "Loading more…"}
          </div>
        )}
        {!hasMore && filtered.length > PAGE_SIZE && (
          <div className="py-6 text-center text-xs text-zinc-400">
            {lang === "ko" ? `총 ${filtered.length}개 — 끝` : `${filtered.length} total — end`}
          </div>
        )}
      </section>
    </>
  );
}
