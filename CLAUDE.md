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
TMAP_APP_KEY=...                      # 자전거 경로 안내 — TMAP 보행자 API (없으면 직선 폴백)
```

**NAVER Maps:** NCP 콘솔(console.ncloud.com) → AI·Application Service → Maps → Application 등록 후 발급. SDK URL 파라미터에서는 `ncpKeyId=`로 전달됨. Web Service URL 등록 필수 (`localhost:3000`, `localhost:3030`, 배포 도메인). 미등록 도메인 호출 시 401.

**TMAP (자전거 경로 폴백):** SK Open API(openapi.sk.com)에서 가입 → 앱 등록 → appKey 발급. **자기 신청형**(제휴 불필요). `/api/route` 서버 라우트가 보행자 경로 API를 자전거 경로 근사로 호출하며, 응답의 `totalDistance`(m)을 자전거 평균 15km/h로 환산해 시간 추정. 키 없으면 자동으로 직선 폴백.

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
