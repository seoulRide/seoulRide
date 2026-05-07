import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { useLangFromSearch, type Lang } from "@/lib/i18n";

export default async function AboutPage({ searchParams }: { searchParams: Promise<{ lng?: string }> }) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 pb-28 md:pb-12">
        <header>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">About seoulRide</h1>
          <p className="text-zinc-500 mt-2">A small, opinionated guide for foreign visitors who want to explore Seoul on a Ttareungi (public bike).</p>
        </header>

        <section>
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">Data sources</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            <li>• <strong>Bike rentals by foreigners</strong> — Seoul Open Data Plaza (cycleForeignerRentMonthInfo, cycleForeignerRentDayInfo)</li>
            <li>• <strong>Cultural events</strong> — Seoul Open Data Plaza (culturalEventInfo, ListPublicReservationCulture/English)</li>
            <li>• <strong>Sejong Center performances</strong> — Seoul Open Data Plaza (SJWPerform)</li>
            <li>• <strong>Consumption / food activity</strong> — Seoul Open Data Plaza (trdarNcmCnsmp). Estimate-based.</li>
            <li>• <strong>Weather forecast</strong> — Korea Meteorological Administration apihub (단기예보)</li>
            <li>• <strong>Map tiles</strong> — © OpenStreetMap contributors</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">Notes</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            <li>• Food recommendations are <em>directional</em> — they reflect district-level consumption signals plus curated category labels, not specific restaurants.</li>
            <li>• Korean event titles without an English match are shown in their original Korean form. Look for the small ⓘ next to the title — searching for the original name often returns better results on local maps.</li>
            <li>• Distance is straight-line. Seoul streets often follow rivers and hills, so plan a few extra minutes.</li>
          </ul>
        </section>

        <footer className="pt-8 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          Built with public data. Not affiliated with the City of Seoul.
        </footer>
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
