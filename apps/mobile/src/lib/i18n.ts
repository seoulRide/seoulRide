export type Lang = "en" | "ko";

const dict = {
  en: {
    "site.title": "seoulRide",
    "nav.home": "Map",
    "nav.events": "Events",
    "nav.about": "About",
    "home.intro_h1": "Seoul, on a foreigner's bike.",
    "home.intro_sub": "Top stations rented by international visitors, plus events and food within walking distance.",
    "section.popular": "Popular bike stations",
    "section.events_nearby": "Events nearby",
    "section.weather": "Weather & ride score",
    "card.distance": "km away",
    "card.original_korean": "Original Korean name",
    "weather.mocked": "Forecast unavailable — showing seeded sample.",
    "footer.sources": "Data: Seoul Open Data Plaza, KMA",
    "empty.no_events": "No upcoming events found within walking distance.",
  },
  ko: {
    "site.title": "seoulRide",
    "nav.home": "지도",
    "nav.events": "행사",
    "nav.about": "소개",
    "home.intro_h1": "외국인의 따릉이 동선.",
    "home.intro_sub": "외국인 대여 데이터 기반 인기 대여소와 그 주변 행사·먹을거리·날씨.",
    "section.popular": "외국인 인기 대여소",
    "section.events_nearby": "주변 행사",
    "section.weather": "날씨 · 라이딩 점수",
    "card.distance": "km 거리",
    "card.original_korean": "한국어 원어",
    "weather.mocked": "예보를 가져오지 못해 모의값을 표시 중입니다.",
    "footer.sources": "데이터: 서울 열린데이터광장, 기상청",
    "empty.no_events": "도보 거리 내 임박 행사가 없습니다.",
  },
} as const;

export type DictKey = keyof typeof dict.en;

export function t(key: DictKey, lang: Lang = "en"): string {
  return dict[lang][key] ?? key;
}
