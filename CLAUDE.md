# seoulRide

외국인 따릉이 인기 대여소 + 주변 문화행사·먹을거리·기상예보를 통합 시각화하는 Next.js 16 (App Router) 앱.

## 데이터 소스

- 서울 OpenAPI: `cycleForeignerRentMonthInfo`, `cycleForeignerRentDayInfo`, `culturalEventInfo`, `ListPublicReservationCulture`, `ListPublicReservationEnglish`, `SJWPerform`
- 따릉이 대여소 마스터 CSV (위경도, CP949)
- 기상청 apihub `https://apihub.kma.go.kr` (예특보)

원본 명세는 `data/raw/`, 정규화 산출물은 `_workspace/01_ingest/`.

## 환경변수 (`.env.local`)

```
SEOUL_OPEN_API_KEY=...                # 서울 열린데이터광장 인증키 (없으면 sample 사용)
KMA_API_KEY=...                       # apihub.kma.go.kr 인증키 (없으면 모의 날씨)
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=...   # NAVER Maps Client ID (지도 표시 필수)
SOLAR_API_KEY=...                     # Upstage Solar API (트렌딩 핫플레이스 파이프라인 — solar-pro2)
```

**NAVER Maps:** NCP 콘솔(console.ncloud.com) → AI·Application Service → Maps → Application 등록 후 발급. SDK URL 파라미터에서는 `ncpKeyId=`로 전달됨. Web Service URL 등록 필수 (`localhost:3000`, `localhost:3030`, 배포 도메인). 미등록 도메인 호출 시 401.

**자전거 길찾기 (외부 앱 위임):** 자체 자전거 라우팅 API를 호출하지 않는다. `/route/[id]` 페이지는 NAVER `BicycleLayer`로 자전거도로 망을 시각화하고, 거리/시간은 직선(Haversine) + 15km/h로 단순 추정한 뒤, Google Maps / NAVER 지도 / 카카오맵의 자전거 길찾기로 보내는 딥링크 버튼을 노출한다 (`lib/map-app-links.ts`). 모바일=앱 딥링크, 데스크톱=웹 URL. 카카오는 PC 웹이 자전거 모드를 지원하지 않아 데스크톱에서는 버튼을 숨긴다. 따라서 **자전거 라우팅용 환경변수/제휴 불필요**.

**정적 카피 정책 — LLM 미사용 (변함 없음):**
- 행사 영문: `ListPublicReservationEnglish` 데이터셋 매칭, 미매칭 시 한국어 원어 유지
- 대여소 영문: 50개 인기 대여소만 `apps/web/src/lib/station-names-en.ts` 정적 dict로 override
- 음식 추천: 자체 큐레이션 폐기. 외부 지도 앱 위임 (자전거 라우팅과 동일 패턴)

**예외 — `_workspace/05_trending/` (multi-stage AI 파이프라인 산출물):**
외부 동적 신호(영어권 뉴스·여행 커뮤니티 + 한국어 buzz)를 우리 정적 데이터(50개 인기 대여소·행사·날씨)와 매일 1회 합성. 정적 데이터로 못 만드는 결과 — "이번 주 외국인 관점에서 어디가 뜨고 있나" — 을 만들기 때문에 LLM 사용이 정당. 클리셰(번역·요약·챗봇)와는 다름.

- 소스: Reddit r/seoul · r/korea (anonymous JSON), Visit Seoul (cheerio), NAVER 뉴스 (`k-skill-proxy.nomadamas.org`)
- 파이프라인: fetchers → `extract.ts` (Solar Pro 2 strict json_schema) → `aggregate.ts` (gu 기반 인기 대여소 매칭) → `synthesize.ts` (Solar Pro 2 한 번 호출로 ko/en 요약)
- 산출물: `_workspace/05_trending/trending.json` (commit됨, 홈 hero에 노출)
- 비용: 약 $0.08/일 ≈ $2.4/월 (Solar Pro 2)
- 스케줄: GitHub Actions cron 매일 06:00 KST (`.github/workflows/trending-daily.yml`)
- 폴백: cron 실패 시 `trending.sample.json`이 UI를 채움

## 하네스: seoulRide 앱 빌드/운영

**목표:** 외국인 따릉이 데이터 → 인기 대여소 도출 → 주변 행사·날씨 큐레이션 → Next.js UI를 일관된 워크플로우로 빌드/유지.

**트리거:** seoulRide, 따릉이, 외국인 자전거, 서울 문화행사, 라이딩 추천, 데이터 갱신, 재실행 등 본 도메인 작업 요청 시 `seoulride-orchestrator` 스킬을 사용. 단순 질문(예: "이 컬럼 의미가 뭐야?")은 직접 응답.

**실행 모드:** 하이브리드 (Phase 2=서브 에이전트 병렬, Phase 3~5=에이전트 팀)

**모델 정책:** 모든 에이전트 `model: "opus"` 고정.

**변경 이력:**

| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-05-07 | 초기 구성 (에이전트 7, 스킬 7, 오케스트레이터 1) | 전체 | seoulRide 신규 프로젝트 |
| 2026-05-07 | AI Gateway 의존성 제거 — 영문 데이터셋 매칭 + 정적 blurb dict로 대체 | cultural-events·food-recommender 에이전트, events-geo-join·food-hotspot-analysis·nextjs-app-build·orchestrator 스킬, CLAUDE.md (총 7파일 + food-blurbs.json 신규) | 사용자 피드백: 데이터 분석 프로젝트에 LLM 클리셰는 불필요 |
| 2026-05-07 | Leaflet→Kakao Maps 교체 + `/nearby` (geolocation + vaul 바텀시트) 추가 | apps/web 컴포넌트·라우트·env | 한국 특화 맵 + 당근식 위치 기반 행사 탐색 UX |
| 2026-05-07 | Kakao→NAVER Maps 교체 (전면) | KakaoSdkScript/Map/types 삭제, NaverSdkScript/Map/types 신규, MapWrapper·NearbyClient·layout import 교체, env rename | NCP 한국 라벨 일관성 + 결제수단 등록 마찰 수용 결정 |
| 2026-05-07 | 행사 추천(/) + 따릉이 경로 안내(/route/[id]) 추가 | recommend.ts, route-geometry.ts, tmap-pedestrian.ts, /api/route, /api/stations-near, RouteClient, RouteSegmentList; EventCard 주 액션 → /route, NaverMap polyline/extraMarkers props | 외국인 인기 대여소 = 외국인 추천 동네 가정 + 행사 클릭 → 자전거 동선 |
| 2026-05-07 | TMAP 보행자 폴백 제거 → 외부 지도 앱(Google/NAVER/Kakao) 자전거 길찾기 딥링크 위임 + NAVER `BicycleLayer` 오버레이 | map-app-links.ts 신규, NaverMap `showBicycleLayer` prop, naver-types `BicycleLayer`, RouteClient 재작성, types.ts `RouteResponse` 삭제, `/api/route` + tmap-pedestrian.ts 삭제, i18n 카피 교체, `TMAP_APP_KEY` env 제거 | 자전거 라우팅을 직접 호출하면 제휴(TMAP) 또는 외부 키(ORS)가 필요한데, 외국인 사용자는 어차피 턴바이턴 안내용으로 지도 앱을 열기 때문에 라우팅을 외부 앱에 위임하는 게 운영·비용·정확도 모두 우위 |
| 2026-05-08 | `/route/[id]` 페이지 삭제 → `/nearby?focus={eventId}`로 병합. EventExplorer/NearbyClient 공유, 행사 카드 클릭 시 `/nearby?focus=`로 이동. 따릉이 인기 대여소 50개 마커, BicycleLayer 오버레이 제거, 행사 사이트 링크는 카드 우상단 🔗 이모지로 이동, 카루셀 하단 BottomTabNav만큼 띄움 | EventExplorer.tsx (footer pin + emoji + bottom offset + station markers), NearbyClient.tsx (focusId prop), nearby/page.tsx (?focus 처리), route/[eventId]/page.tsx (redirect로 단축), RouteClient.tsx 삭제, EventCard 링크 변경 | 외부 지도 앱 위임 후 `/route`와 `/nearby`가 사실상 동일 화면이 되어 중복. focus 쿼리 한 줄로 두 진입점이 자연스럽게 합쳐짐 |
| 2026-05-08 | 트렌딩 핫플레이스 AI 파이프라인 추가 (Reddit + Visit Seoul + NAVER → Solar Pro 2 추출/합성) | `scripts/trending/` (fetchers + extract + aggregate + synthesize + run.ts), `_workspace/05_trending/`, `apps/web/src/lib/types.ts` (TrendingEntry), `apps/web/src/lib/data.ts` (getTrending), `apps/web/src/components/TrendingHero.tsx` + `TrendingCard.tsx`, `apps/web/src/app/page.tsx` 임베드, `.github/workflows/trending-daily.yml`, `SOLAR_API_KEY` env, `openai`+`cheerio` deps | 외부 동적 buzz와 우리 정적 데이터를 매일 합성해서 정적 데이터만으론 못 만드는 결과("이번 주 외국인 관점 뜨는 곳")를 추가. Solar는 Korean 학습 + Anthropic 대비 10-25배 저렴해 한국어 NER에 적합 |
| 2026-05-09 | FoodCard 전면 폐기 — 상권(`trdarNcmCnsmp`) API 호출 + 정적 음식 큐레이션 dict + activity_score 모두 제거 | apps/web FoodCard·getFoodByStation·FoodEntry/FoodByStation·food i18n 키, apps/mobile FoodCard·FoodEntry, scripts/curation/food-by-station.ts, scripts/ingest/run-all.ts(trdarNcmCnsmp), scripts/qa(food cross-coverage), scripts/lib/env.ts mapping, package.json `curate:food`+pipeline, `_workspace/{01_ingest/trdarNcmCnsmp.*,03_curation/food_*}`, `apps/mobile/assets/data/food_by_station.json`, about 페이지 데이터 출처, CLAUDE.md 데이터 소스/정책 | 음식은 외국인 사용자가 NAVER 지도/Google Maps에서 직접 찾는 게 사진·평점·실시간 정보로 우위. 우리 자체 큐레이션은 정적 dict + 자치구 평균 → activity_score=0.7 상수, UI에 노출도 안 됨. 데드코드 정리하고 외부 지도 위임 정책(자전거 라우팅과 동일)으로 일관 |
