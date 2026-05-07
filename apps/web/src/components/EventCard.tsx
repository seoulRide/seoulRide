import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { EventEntry } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { getEventStatus, type EventStatus } from "@/lib/event-status";

const CATEGORY_LABEL: Record<EventEntry["category"], { en: string; ko: string }> = {
  concert: { en: "Concert", ko: "콘서트" },
  exhibition: { en: "Exhibition", ko: "전시" },
  festival: { en: "Festival", ko: "축제" },
  performance: { en: "Performance", ko: "공연" },
  experience: { en: "Experience", ko: "체험" },
};

const STATUS_STYLE: Record<EventStatus, string> = {
  ongoing:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  upcoming:
    "bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  past:
    "bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800",
};

const STATUS_KEY = {
  ongoing: "status.ongoing",
  upcoming: "status.upcoming",
  past: "status.past",
} as const;

/**
 * Card uses a "stretched link" pattern: a wrapping <div> hosts the visual,
 * the route Link is absolutely positioned over the card to capture primary
 * clicks, and the secondary external-link anchor sits above with z-20 so
 * it wins click events without nested-anchor HTML.
 */
export function EventCard({
  event,
  lang,
  subtitle,
}: {
  event: EventEntry;
  lang: Lang;
  /** Optional small line under the venue (e.g. "Near 서울숲 관리사무소"). */
  subtitle?: string | null;
}) {
  const title = lang === "ko" ? event.title_ko : event.title_en;
  const venue = lang === "ko" ? event.venue_ko : event.venue_en;
  const fallback = event.en_fallback === "ko_original" && lang === "en";
  const status = getEventStatus(event.start, event.end);
  const dimmed = status === "past";
  const routeHref = `/nearby?focus=${encodeURIComponent(event.id)}${lang === "ko" ? "&lng=ko" : ""}`;

  return (
    <div
      className={[
        "group relative flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 min-h-[112px] transition",
        "hover:bg-zinc-50 dark:hover:bg-zinc-900",
        dimmed ? "opacity-70" : "",
      ].join(" ")}
    >
      {/* Stretched link — primary click target */}
      <Link
        href={routeHref}
        prefetch={false}
        aria-label={title}
        className="absolute inset-0 z-10 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      />

      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
        <Badge variant="outline" className="text-[11px]">
          {CATEGORY_LABEL[event.category][lang]}
        </Badge>
        <span
          className={[
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-normal normal-case",
            STATUS_STYLE[status],
          ].join(" ")}
        >
          {status === "ongoing" && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 align-middle" aria-hidden />
          )}
          {t(STATUS_KEY[status], lang)}
        </span>
        <span>
          {event.distance_km.toFixed(2)} {t("card.distance", lang)}
        </span>
        {fallback && (
          <span title={t("card.original_korean", lang)} className="text-zinc-400">
            ⓘ
          </span>
        )}
      </div>
      <h4 className="mt-2 text-[15px] font-medium leading-snug line-clamp-2">{title}</h4>
      <div className="mt-1 text-xs text-zinc-500 line-clamp-1">{venue}</div>
      {subtitle && (
        <div className="mt-0.5 text-[11px] text-emerald-700 dark:text-emerald-400 line-clamp-1">{subtitle}</div>
      )}
      <div className="mt-auto pt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {event.start.slice(0, 10)}
          {event.end && event.end !== event.start ? ` ~ ${event.end.slice(0, 10)}` : ""}
        </span>
        <span className={event.price === "Free" ? "text-emerald-600 font-medium" : ""}>{event.price}</span>
      </div>

      {/* Secondary action: open external event page (above the stretched link) */}
      {event.url && (
        <a
          href={event.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={t("route.event_link", lang)}
          title={t("route.event_link", lang)}
          className="absolute top-2 right-2 z-20 p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M14 4h6v6M20 4 10 14M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
          </svg>
        </a>
      )}
    </div>
  );
}
