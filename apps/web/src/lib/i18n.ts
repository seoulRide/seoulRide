export type Lang = "en" | "ko";

const dict = {
  en: {
    "site.title": "seoulRide",
    "site.tagline": "Where foreigners ride, what to see, eat, and weather to expect.",
    "nav.home": "Map",
    "nav.nearby": "Nearby",
    "nav.events": "Events",
    "nav.about": "About",
    "home.intro_h1": "Seoul, on a foreigner's bike.",
    "home.intro_sub": "Top stations rented by international visitors, plus events and food within walking distance.",
    "section.popular": "Popular bike stations",
    "section.events_nearby": "Events nearby",
    "section.food_nearby": "What to eat",
    "section.weather": "Weather & ride score",
    "card.rentals": "rentals",
    "card.rank_overall": "Overall rank",
    "card.rank_in_gu": "Rank in district",
    "card.distance": "km away",
    "card.original_korean": "Original Korean name",
    "weather.mocked": "Forecast unavailable — showing seeded sample. Apply for KMA's 단기예보 service to see live data.",
    "actions.view_station": "View station",
    "actions.see_all": "See all events",
    "footer.sources": "Data: Seoul Open Data Plaza, Korea Meteorological Administration",
  },
  ko: {
    "site.title": "seoulRide",
    "site.tagline": "외국인이 자전거로 가는 곳 · 행사 · 먹을거리 · 날씨를 한 화면에.",
    "nav.home": "지도",
    "nav.nearby": "내 주변",
    "nav.events": "행사",
    "nav.about": "소개",
    "home.intro_h1": "외국인의 따릉이 동선.",
    "home.intro_sub": "외국인 대여 데이터 기반 인기 대여소와, 그 주변 행사·먹을거리·날씨.",
    "section.popular": "외국인 인기 대여소",
    "section.events_nearby": "주변 행사",
    "section.food_nearby": "먹을거리",
    "section.weather": "날씨 · 라이딩 점수",
    "card.rentals": "회 대여",
    "card.rank_overall": "전체 순위",
    "card.rank_in_gu": "자치구 순위",
    "card.distance": "km 거리",
    "card.original_korean": "한국어 원어",
    "weather.mocked": "예보를 가져오지 못해 모의값을 표시 중입니다. apihub에서 단기예보 활용신청 후 표시됩니다.",
    "actions.view_station": "대여소 보기",
    "actions.see_all": "모든 행사 보기",
    "footer.sources": "데이터: 서울 열린데이터광장, 기상청",
  },
} as const;

export type DictKey = keyof typeof dict.en;

export function t(key: DictKey, lang: Lang = "en"): string {
  return dict[lang][key] ?? key;
}

export function useLangFromSearch(searchParams?: { lng?: string }): Lang {
  return searchParams?.lng === "ko" ? "ko" : "en";
}
