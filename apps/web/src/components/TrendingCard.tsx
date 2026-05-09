import Link from "next/link";
import type { TrendingEntry } from "@/lib/types";
import { type Lang } from "@/lib/i18n";
import { stationDisplayName } from "@/lib/station-names-en";

export function TrendingCard({
  entry,
  lang,
}: {
  entry: TrendingEntry;
  lang: Lang;
}) {
  const summary = lang === "ko" ? entry.summary_ko : entry.summary_en;
  const guLabel = lang === "ko" ? entry.gu_ko : (entry.gu_en ?? entry.gu_ko);

  const stationHref = `/station/${encodeURIComponent(entry.station_no)}${lang === "ko" ? "?lng=ko" : ""}`;
  const stationName = stationDisplayName(entry.station_no, entry.station_name_ko, null, lang);

  return (
    <article className="group relative flex flex-col gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
        {guLabel}
      </div>
      <h3 className="text-sm font-semibold leading-tight">
        <Link
          href={stationHref}
          prefetch={false}
          className="absolute inset-0 z-10"
          aria-label={stationName}
        />
        {stationName}
      </h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
        {summary}
      </p>
    </article>
  );
}
