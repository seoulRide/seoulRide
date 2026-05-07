import Link from "next/link";
import type { TrendingEntry } from "@/lib/types";
import { type Lang } from "@/lib/i18n";

const SOURCE_LABEL: Record<TrendingEntry["sources"][number]["source"], string> = {
  reddit_seoul: "r/seoul",
  reddit_korea: "r/korea",
  visit_seoul: "Visit Seoul",
  naver_news: "NAVER 뉴스",
  timeout_seoul: "Time Out Seoul",
};

export function TrendingCard({
  entry,
  lang,
}: {
  entry: TrendingEntry;
  lang: Lang;
}) {
  const summary = lang === "ko" ? entry.summary_ko : entry.summary_en;
  const guLabel = lang === "ko" ? entry.gu_ko : (entry.gu_en ?? entry.gu_ko);
  const sentimentBadge = entry.sentiment_avg >= 0.3
    ? { color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900", label: lang === "ko" ? "긍정" : "Positive" }
    : entry.sentiment_avg <= -0.3
      ? { color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900", label: lang === "ko" ? "혼조" : "Mixed" }
      : { color: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800", label: lang === "ko" ? "중립" : "Neutral" };

  // Dedup source providers for the footer chip row.
  const providerSet = new Set(entry.sources.map((s) => s.source));
  const providers = [...providerSet];

  const stationHref = `/station/${encodeURIComponent(entry.station_no)}${lang === "ko" ? "?lng=ko" : ""}`;

  return (
    <article className="group relative flex flex-col gap-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold">
        <span className={`px-1.5 py-0.5 rounded border ${sentimentBadge.color}`}>
          {sentimentBadge.label}
        </span>
        <span className="text-zinc-500 normal-case tracking-normal">{guLabel}</span>
        <span className="text-zinc-300">·</span>
        <span className="text-zinc-500 normal-case tracking-normal">
          {entry.mention_count} {lang === "ko" ? "건 언급" : "mentions / 7d"}
        </span>
      </div>
      <h3 className="text-sm font-semibold leading-tight">
        <Link
          href={stationHref}
          prefetch={false}
          className="absolute inset-0 z-10"
          aria-label={entry.station_name_ko}
        />
        {entry.station_name_ko}
      </h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
        {summary}
      </p>
      <div className="mt-auto pt-1 flex items-center gap-1.5 text-[10px] text-zinc-500">
        {providers.map((p) => (
          <span
            key={p}
            className="rounded-full border border-zinc-200 dark:border-zinc-800 px-1.5 py-0.5"
          >
            {SOURCE_LABEL[p]}
          </span>
        ))}
      </div>
    </article>
  );
}
