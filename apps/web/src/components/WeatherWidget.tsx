import type { WeatherForecast } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";

function scoreColor(s: number) {
  if (s >= 80) return "bg-emerald-500";
  if (s >= 60) return "bg-emerald-400";
  if (s >= 40) return "bg-amber-400";
  if (s >= 20) return "bg-orange-500";
  return "bg-red-500";
}

const RIDE_LABEL_KO: Record<string, string> = {
  "Great for cycling": "라이딩 최적",
  "Good — bring sunscreen/jacket": "괜찮음 — 자외선/외투 챙기기",
  "Mild conditions, ride with care": "가능 — 주의 운행",
  "Not recommended": "비추천",
  "Skip cycling today": "오늘은 라이딩 건너뛰기",
};

export function WeatherWidget({ w, lang }: { w: WeatherForecast; lang: Lang }) {
  const label = lang === "ko" ? RIDE_LABEL_KO[w.now.label_en] ?? w.now.label_en : w.now.label_en;
  const c = scoreColor(w.now.ride_score);
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {lang === "ko" ? w.gu_ko : w.gu_en}
        </div>
        <div className={`h-2 w-2 rounded-full ${c}`} aria-hidden />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{w.now.ride_score}</span>
        <span className="text-xs text-zinc-500">/ 100</span>
      </div>
      <div className="mt-1 text-sm">{label}</div>
      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 tabular-nums">
        <span>{w.now.temp_c ?? "?"}°C</span>
        <span>💧 {w.now.rain_prob ?? 0}%</span>
        <span>🌬 {w.now.wind_ms ?? 0} m/s</span>
      </div>
      {w.mocked && (
        <p className="mt-3 text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
          {t("weather.mocked", lang)}
        </p>
      )}
    </div>
  );
}
