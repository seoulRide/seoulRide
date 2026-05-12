import { TrendingCard } from "./TrendingCard";
import type { TrendingByStation } from "@/lib/types";
import { type Lang } from "@/lib/i18n";

export function TrendingHero({
  trending,
  lang,
}: {
  trending: TrendingByStation;
  lang: Lang;
}) {
  if (!trending || trending.length === 0) return null;
  const top = trending.slice(0, 4);

  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">
          {lang === "ko" ? "이번 주 뜨는 동네" : "Hot this week"}{" "}
          <span className="text-zinc-400 font-normal text-sm">({top.length})</span>
        </h2>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {top.map((entry) => (
          <TrendingCard key={entry.station_no} entry={entry} lang={lang} />
        ))}
      </div>
    </section>
  );
}
