import { SiteHeader } from "@/components/SiteHeader";
import { BottomTabNav } from "@/components/BottomTabNav";
import { useLangFromSearch, type Lang } from "@/lib/i18n";

export default async function AboutPage({ searchParams }: { searchParams: Promise<{ lng?: string }> }) {
  const sp = await searchParams;
  const lang: Lang = useLangFromSearch(sp);
  const ko = lang === "ko";
  return (
    <>
      <SiteHeader lang={lang} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 pb-28 md:pb-12">
        <header>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
            {ko ? "seoulRide 소개" : "About seoulRide"}
          </h1>
          <p className="text-zinc-500 mt-2">
            {ko
              ? "외국인 방문객이 따릉이로 서울을 둘러볼 때를 위한 작고 의도된 가이드입니다."
              : "A small, opinionated guide for foreign visitors who want to explore Seoul on a Ttareungi (public bike)."}
          </p>
        </header>

        <section>
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">
            {ko ? "데이터 출처" : "Data sources"}
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            <li>• <strong>{ko ? "외국인 따릉이 대여 데이터" : "Bike rentals by foreigners"}</strong> — {ko ? "서울 열린데이터광장" : "Seoul Open Data Plaza"} (cycleForeignerRentMonthInfo, cycleForeignerRentDayInfo)</li>
            <li>• <strong>{ko ? "문화행사" : "Cultural events"}</strong> — {ko ? "서울 열린데이터광장" : "Seoul Open Data Plaza"} (culturalEventInfo, ListPublicReservationCulture/English)</li>
            <li>• <strong>{ko ? "세종문화회관 공연" : "Sejong Center performances"}</strong> — {ko ? "서울 열린데이터광장" : "Seoul Open Data Plaza"} (SJWPerform)</li>
            <li>• <strong>{ko ? "소비/음식 활동" : "Consumption / food activity"}</strong> — {ko ? "서울 열린데이터광장 (trdarNcmCnsmp). 추정치 기반." : "Seoul Open Data Plaza (trdarNcmCnsmp). Estimate-based."}</li>
            <li>• <strong>{ko ? "기상예보" : "Weather forecast"}</strong> — {ko ? "기상청 apihub (단기예보)" : "Korea Meteorological Administration apihub (단기예보)"}</li>
            <li>• <strong>{ko ? "지도 타일" : "Map tiles"}</strong> — © OpenStreetMap contributors</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">
            {ko ? "참고" : "Notes"}
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            <li>• {ko
              ? "음식 추천은 방향성 정보입니다. 자치구 단위 소비 신호와 큐레이션된 카테고리 라벨을 보여드리며, 특정 식당 추천은 아닙니다."
              : "Food recommendations are directional — they reflect district-level consumption signals plus curated category labels, not specific restaurants."}</li>
            <li>• {ko
              ? "영문이 매칭되지 않은 행사는 한국어 원어로 표시됩니다. 제목 옆 작은 ⓘ를 누르면 원어 검색이 가능합니다."
              : "Korean event titles without an English match are shown in their original Korean form. Look for the small ⓘ next to the title — searching for the original name often returns better results on local maps."}</li>
            <li>• {ko
              ? "거리는 직선 기준입니다. 서울 길은 강·언덕을 따라 휘어지므로 시간을 여유있게 잡으세요."
              : "Distance is straight-line. Seoul streets often follow rivers and hills, so plan a few extra minutes."}</li>
          </ul>
        </section>

        <footer className="pt-8 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          {ko
            ? "공공 데이터 기반. 서울특별시와 무관한 비공식 프로젝트입니다."
            : "Built with public data. Not affiliated with the City of Seoul."}
        </footer>
      </main>
      <BottomTabNav lang={lang} />
    </>
  );
}
