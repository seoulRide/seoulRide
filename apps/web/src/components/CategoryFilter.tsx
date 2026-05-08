"use client";

import { useMemo, useState, type ReactNode } from "react";
import { EventCard } from "./EventCard";
import { t, type Lang } from "@/lib/i18n";
import type { RecommendedEvent } from "@/lib/recommend";

const CATEGORIES = ["concert", "exhibition", "festival", "performance", "experience"] as const;
type Category = typeof CATEGORIES[number];

const LABELS: Record<Category, { ko: string; en: string }> = {
  concert: { en: "Concert", ko: "콘서트" },
  exhibition: { en: "Exhibition", ko: "전시" },
  festival: { en: "Festival", ko: "축제" },
  performance: { en: "Performance", ko: "공연" },
  experience: { en: "Experience", ko: "체험" },
};

export function CategoryFilter({ events, lang }: { events: RecommendedEvent[]; lang: Lang }) {
  const [active, setActive] = useState<"all" | Category>("all");

  const counts = useMemo(() => {
    const out: Record<"all" | Category, number> = {
      all: events.length,
      concert: 0,
      exhibition: 0,
      festival: 0,
      performance: 0,
      experience: 0,
    };
    for (const e of events) out[e.category as Category]++;
    return out;
  }, [events]);

  const visible = active === "all" ? events : events.filter((e) => e.category === active);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <Chip
          active={active === "all"}
          count={counts.all}
          onClick={() => setActive("all")}
        >
          {t("category.filter_all", lang)}
        </Chip>
        {CATEGORIES.filter((c) => counts[c] > 0).map((c) => (
          <Chip
            key={c}
            active={active === c}
            count={counts[c]}
            onClick={() => setActive(c)}
          >
            {LABELS[c][lang]}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500 py-4">{t("events.empty", lang)}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {visible.map((e) => {
            const anchor = e.anchor_station_name_ko;
            const subtitle = `${t("card.near_station", lang)}: ${anchor} (${e.anchor_rent_total.toLocaleString()})`;
            return <EventCard key={e.id} event={e} lang={lang} subtitle={subtitle} />;
          })}
        </div>
      )}
    </>
  );
}

function Chip({
  children,
  count,
  active,
  onClick,
}: {
  children: ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap",
        active
          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-500"
          : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400",
      ].join(" ")}
    >
      <span>{children}</span>
      <span className={active ? "tabular-nums" : "tabular-nums text-zinc-400"}>{count}</span>
    </button>
  );
}
