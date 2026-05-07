import { Badge } from "@/components/ui/badge";
import type { EventEntry } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";

const CATEGORY_LABEL: Record<EventEntry["category"], { en: string; ko: string }> = {
  concert: { en: "Concert", ko: "콘서트" },
  exhibition: { en: "Exhibition", ko: "전시" },
  festival: { en: "Festival", ko: "축제" },
  performance: { en: "Performance", ko: "공연" },
  experience: { en: "Experience", ko: "체험" },
};

export function EventCard({ event, lang }: { event: EventEntry; lang: Lang }) {
  const title = lang === "ko" ? event.title_ko : event.title_en;
  const venue = lang === "ko" ? event.venue_ko : event.venue_en;
  const fallback = event.en_fallback === "ko_original" && lang === "en";
  return (
    <a
      href={event.url || "#"}
      target={event.url ? "_blank" : undefined}
      rel="noreferrer"
      className="group flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 p-3.5 min-h-[112px] hover:bg-zinc-50 dark:hover:bg-zinc-900 active:bg-zinc-100 dark:active:bg-zinc-800 transition"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
        <Badge variant="outline" className="text-[11px]">{CATEGORY_LABEL[event.category][lang]}</Badge>
        <span>{event.distance_km.toFixed(2)} {t("card.distance", lang)}</span>
        {fallback && (
          <span title={t("card.original_korean", lang)} className="text-zinc-400">ⓘ</span>
        )}
      </div>
      <h4 className="mt-2 text-[15px] font-medium leading-snug line-clamp-2">{title}</h4>
      <div className="mt-1 text-xs text-zinc-500 line-clamp-1">{venue}</div>
      <div className="mt-auto pt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>{event.start.slice(0, 10)}{event.end && event.end !== event.start ? ` ~ ${event.end.slice(0, 10)}` : ""}</span>
        <span className={event.price === "Free" ? "text-emerald-600 font-medium" : ""}>{event.price}</span>
      </div>
    </a>
  );
}
