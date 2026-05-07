import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { EventCard } from "@/components/EventCard";
import { WeatherWidget } from "@/components/WeatherWidget";
import MapWrapper from "@/components/MapWrapper";
import { getPopularStations, getWeatherByGu, getEventsByStation } from "@/lib/data";
import { t, useLangFromSearch, type Lang } from "@/lib/i18n";
import { recommendTopEvents } from "@/lib/recommend";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ lng?: string }> }) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const [stations, weather, eventsByStation] = await Promise.all([
    getPopularStations(),
    getWeatherByGu(),
    getEventsByStation(),
  ]);

  const top = stations[0];
  const featuredWeather = top?.gu_en ? weather[top.gu_en] : Object.values(weather)[0];

  const recommended = recommendTopEvents(eventsByStation, stations, { perStationCap: 3, total: 12 });

  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10 sm:space-y-12 pb-28 md:pb-12">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          <div className="md:col-span-2 space-y-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
              {t("home.intro_h1", lang)}
            </h1>
            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-prose">
              {t("home.intro_sub", lang)}
            </p>
          </div>
          {featuredWeather && <WeatherWidget w={featuredWeather} lang={lang} />}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">{t("section.popular", lang)}</h2>
          <MapWrapper stations={stations} lang={lang} />
        </section>

        <section className="space-y-4">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">
            {t("home.section.recommended", lang)} · {recommended.length}
          </h2>
          <p className="text-sm text-zinc-500 max-w-prose">{t("home.section.recommended_sub", lang)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {recommended.map((e) => {
              const anchor = lang === "ko" ? e.anchor_station_name_ko : e.anchor_station_name_ko;
              const subtitle = `${t("card.near_station", lang)}: ${anchor} (${e.anchor_rent_total.toLocaleString()})`;
              return <EventCard key={e.id} event={e} lang={lang} subtitle={subtitle} />;
            })}
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
