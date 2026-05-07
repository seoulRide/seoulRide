# seoulRide

외국인 따릉이 인기 대여소 + 주변 문화행사·먹을거리·기상예보를 통합 시각화하는 Next.js 16 (App Router) 앱.

## 데이터 소스

- 서울 OpenAPI: `cycleForeignerRentMonthInfo`, `cycleForeignerRentDayInfo`, `culturalEventInfo`, `ListPublicReservationCulture`, `ListPublicReservationEnglish`, `SJWPerform`, `trdarNcmCnsmp`
- 따릉이 대여소 마스터 CSV (위경도, CP949)
- 기상청 apihub `https://apihub.kma.go.kr` (예특보)

원본 명세는 `data/raw/`, 정규화 산출물은 `_workspace/01_ingest/`.

## 환경변수 (`.env.local`)

```
SEOUL_OPEN_API_KEY=...                # 서울 열린데이터광장 인증키 (없으면 sample 사용)
KMA_API_KEY=...                       # apihub.kma.go.kr 인증키 (없으면 모의 날씨)
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=...   # NAVER Maps Client ID (지도 표시 필수)
```

**NAVER Maps:** NCP 콘솔(console.ncloud.com) → AI·Application Service → Maps → Application 등록 후 발급. SDK URL 파라미터에서는 `ncpKeyId=`로 전달됨. Web Service URL 등록 필수 (`localhost:3000`, `localhost:3030`, 배포 도메인). 미등록 도메인 호출 시 401.

**자전거 길찾기 (외부 앱 위임):** 자체 자전거 라우팅 API를 호출하지 않는다. `/route/[id]` 페이지는 NAVER `BicycleLayer`로 자전거도로 망을 시각화하고, 거리/시간은 직선(Haversine) + 15km/h로 단순 추정한 뒤, Google Maps / NAVER 지도 / 카카오맵의 자전거 길찾기로 보내는 딥링크 버튼을 노출한다 (`lib/map-app-links.ts`). 모바일=앱 딥링크, 데스크톱=웹 URL. 카카오는 PC 웹이 자전거 모드를 지원하지 않아 데스크톱에서는 버튼을 숨긴다. 따라서 **자전거 라우팅용 환경변수/제휴 불필요**.

LLM/AI Gateway는 사용하지 않는다. 영문 카피는 두 경로로만 채운다:
- 행사: `ListPublicReservationEnglish` 데이터셋 매칭, 미매칭 시 한국어 원어 유지
- 음식: `.claude/skills/food-hotspot-analysis/references/food-blurbs.json` 정적 dict

## 하네스: seoulRide 앱 빌드/운영

**목표:** 외국인 따릉이 데이터 → 인기 대여소 도출 → 주변 행사·음식·날씨 큐레이션 → Next.js UI를 일관된 워크플로우로 빌드/유지.

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
