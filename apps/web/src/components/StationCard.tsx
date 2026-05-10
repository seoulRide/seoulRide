import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PopularStation } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { stationDisplayName } from "@/lib/station-names-en";

export function StationCard({ station, lang, hero = false }: { station: PopularStation; lang: Lang; hero?: boolean }) {
  const lngQs = lang === "ko" ? "?lng=ko" : "";
  const name = stationDisplayName(station.station_no, station.station_name_ko, station.station_name_en, lang);
  const gu = lang === "ko" ? station.gu_ko : station.gu_en ?? station.gu_ko;
  return (
    <Link
      href={`/station/${encodeURIComponent(station.station_no)}${lngQs}`}
      className={[
        "group block rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 p-4 transition",
        "min-h-[140px]",
        hero ? "md:col-span-2 md:row-span-2 md:p-6 hover:border-emerald-500" : "hover:border-zinc-400",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={[
            "inline-flex items-center justify-center rounded-full font-bold tabular-nums bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 h-7 w-7 text-xs",
            hero ? "md:h-10 md:w-10 md:text-base md:bg-emerald-500 md:text-white" : "",
          ].join(" ")}>
            {station.rank_overall}
          </span>
          <Badge variant="secondary" className="text-[11px]">{gu}</Badge>
        </div>
        {station.is_outlier && (
          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 text-[11px]">{t("card.spike", lang)}</Badge>
        )}
      </div>
      <h3 className={[
        "mt-3 font-medium leading-snug",
        hero ? "text-base md:mt-4 md:text-2xl md:font-semibold md:leading-tight" : "text-base",
      ].join(" ")}>
        {name}
      </h3>
      <div className="mt-2 text-xs text-zinc-500 line-clamp-1">{station.address}</div>
    </Link>
  );
}
