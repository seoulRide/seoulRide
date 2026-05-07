import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { EventCard } from "@/components/EventCard";
import { FoodCard } from "@/components/FoodCard";
import { WeatherWidget } from "@/components/WeatherWidget";
import {
  getStationById,
  getEventsByStation,
  getFoodByStation,
  getWeatherByGu,
} from "@/lib/data";
import { t, useLangFromSearch, type Lang } from "@/lib/i18n";

export default async function StationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lng?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const decoded = decodeURIComponent(id);
  const station = await getStationById(decoded);
  if (!station) notFound();

  const [eventsAll, foodAll, weatherAll] = await Promise.all([
    getEventsByStation(),
    getFoodByStation(),
    getWeatherByGu(),
  ]);
  const events = eventsAll[station.station_no] ?? [];
  const food = foodAll[station.station_no] ?? null;
  const weather = station.gu_en ? weatherAll[station.gu_en] : null;
  const name = station.station_name_ko;
  const gu = lang === "ko" ? station.gu_ko : station.gu_en ?? station.gu_ko;

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-12 pb-28 md:pb-12">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
            <span>#{station.rank_overall} · {gu}</span>
            {station.is_outlier && <span className="text-amber-600">· spike</span>}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">{name}</h1>
          <p className="text-sm sm:text-base text-zinc-500">{station.address}</p>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="text-4xl sm:text-5xl font-bold tabular-nums">{station.rent_total.toLocaleString()}</span>
            <span className="text-sm text-zinc-500">{t("card.rentals", lang)}</span>
          </div>
        </header>

        {/* Mobile: weather/food before events. md+: aside layout. */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <aside className="md:col-span-1 md:order-2 space-y-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 sm:gap-4 md:gap-6">
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-zinc-500">{t("section.weather", lang)}</h2>
              {weather && <WeatherWidget w={weather} lang={lang} />}
            </div>
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-zinc-500">{t("section.food_nearby", lang)}</h2>
              {food && <FoodCard food={food} lang={lang} />}
            </div>
          </aside>
          <div className="md:col-span-2 md:order-1 space-y-4">
            <h2 className="text-xs uppercase tracking-widest text-zinc-500">{t("section.events_nearby", lang)} ({events.length})</h2>
            {events.length === 0 ? (
              <p className="text-sm text-zinc-500">No upcoming events found within walking distance.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {events.slice(0, 12).map((e) => <EventCard key={e.id} event={e} lang={lang} />)}
              </div>
            )}
          </div>
        </section>

        <footer className="pt-10 pb-4 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          {t("footer.sources", lang)}
        </footer>
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
