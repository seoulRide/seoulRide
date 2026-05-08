import { Badge } from "@/components/ui/badge";
import type { FoodEntry } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";

export function FoodCard({ food, lang }: { food: FoodEntry; lang: Lang }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-500">
        <Badge variant="outline" className="text-[10px]">{lang === "ko" ? food.gu_ko : food.gu_en ?? food.gu_ko}</Badge>
        <span title={food.data_source} className="text-zinc-400">{t("food.estimated", lang)}</span>
      </div>
      <ul className="mt-3 space-y-3">
        {food.top_categories.slice(0, 2).map((c) => (
          <li key={c.category}>
            <div className="font-medium">{lang === "ko" ? c.label_ko : c.label_en}</div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{c.blurb_en}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
