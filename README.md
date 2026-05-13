# seoulRide

외국인 따릉이 인기 대여소 + 주변 문화행사·기상예보를 통합 시각화하는 Next.js 16 (App Router) 앱.

## AI 기능

LLM은 정적 데이터로는 만들 수 없는 결과(외부 동적 buzz와의 합성, 위치·시간 컨텍스트 기반 추천, 한국어 ↔ 영어 의역)에만 사용합니다. 모델은 모두 **Solar Pro 2 (Upstage)** — 한국어 NER/번역에 학습되어 있고 Anthropic 대비 10–25× 저렴하므로 한국어 콘텐츠가 주축인 본 서비스에 적합합니다.

| # | 기능 | 입력 → 출력 | 스크립트 | 갱신 주기 | UI 진입점 |
|---|---|---|---|---|---|
| 1 | 위치 기반 행사 추천 (AI Pick) | 인기 대여소(50) × 1주 행사 → anchor별 5픽 + ko/en 추천 사유 | `scripts/curation/recommendations-pick.ts` | 매일 07:00 KST | `/nearby` (보라색 ✨ 배지) |
| 2 | 트렌딩 핫플레이스 합성 | Reddit·Visit Seoul·NAVER 뉴스 → 자치구 NER → 인기 대여소 매칭 → ko/en 요약 | `scripts/trending/{extract,synthesize}.ts` | 매일 06:00 KST | 홈 hero `TrendingHero` |
| 3 | 행사 영문 번역 | 한국어 행사명/장소 → strict JSON schema로 영문 번역 (영문 데이터셋 미매칭분만) | `scripts/curation/translate-events.ts` | 매일 (events-daily 후속) | 행사 카드 `?lng=en` |
| 4 | 대여소 영문 번역 | 한국어 대여소명 50개 → 영문 (인기 대여소 한정) | `scripts/curation/translate-stations.ts` | 1회성 정적 dict 생성 | 대여소 카드 `?lng=en` |

**비용:** 합산 ≈ $2.5/월 (모두 Solar Pro 2 호출).

### 1. 위치 기반 행사 추천 (AI Pick)

- **무엇:** 사용자의 현재 위치(geolocation) → 가장 가까운 따릉이 인기 대여소(50개 중 1) → 그 대여소 기준 3km 이내 행사 중 Solar Pro 2가 선정한 5개 + 추천 사유.
- **왜 LLM:** 거리·날짜만으로는 "외국인 관광객에게 매력적인지" 판단 불가. 행사 카테고리·장소 성격·시즌성을 종합 평가 필요.
- **데이터 흐름:**
  ```
  popular_stations (50) ─┐
                          ├→ recommendations-pick.ts ─→ daily_recommendations (Supabase) ─→ /nearby
  events_by_station ─────┘     (Solar Pro 2,
                                strict JSON schema)
  ```
- **저장:** `daily_recommendations` 테이블 (PK: `anchor_station_no + rank`). RLS public read.
- **UI:** `apps/web/src/components/NearbyClient.tsx` 가 사용자 위치 → 최근접 anchor → 해당 picks를 카루셀 상단에 보라색 배지로 노출. geolocation 미허용 시 `ST-181`(서울숲) 폴백.
- **워크플로:** `.github/workflows/recommendations-daily.yml`

### 2. 트렌딩 핫플레이스 합성

- **무엇:** "이번 주 외국인 관점에서 어디가 뜨고 있나"를 매일 1회 합성. 한국어 buzz(NAVER 뉴스) + 영어권 커뮤니티(r/seoul, r/korea, Visit Seoul) → Solar로 NER → 자치구 기반 인기 대여소 매칭 → ko/en 요약.
- **왜 LLM:** 외부 RSS·Reddit JSON에서 "어떤 동네가 언급됐는지"(지명 NER)와 "왜 사람들이 가고 있는지"(요약)는 LLM 외엔 대안 없음.
- **파이프라인:**
  ```
  fetch_reddit.ts ────────┐
  fetch_visit_seoul.ts ───┼→ extract.ts ─→ aggregate.ts ─→ synthesize.ts ─→ trending.json
  fetch_naver_news.ts ────┘   (NER, JSON     (gu 매칭)      (ko/en 요약)
                               schema)
  ```
- **저장:** `_workspace/05_trending/trending.json` (commit됨) + Supabase `trending` 테이블. 폴백 `trending.sample.json`.
- **UI:** `apps/web/src/components/TrendingHero.tsx` (홈 hero).
- **워크플로:** `.github/workflows/trending-daily.yml`

### 3. 행사 영문 번역

- **무엇:** 서울 OpenAPI 행사 데이터(한국어 only) 중 `ListPublicReservationEnglish` 데이터셋과 매칭 안 되는 항목만 LLM으로 영문 변환.
- **왜 LLM:** 외국인 사용자 다국어 지원. 영문 데이터셋 매칭이 1차이고 LLM은 폴백.
- **출력 필드:** `title_en`, `venue_en`, `price_en` + `en_fallback: "translated"` 마크.
- **워크플로:** `events-daily.yml` 내 후속 단계.

### 4. 대여소 영문 번역

- **무엇:** 한국어 대여소명(예: "뚝섬유원지역 1번출구") → 영문 ("Ttukseom Resort Stn. Exit 1"). 인기 대여소 50개 한정.
- **왜 LLM:** 행정동/지하철역 약어 번역. 1회성 빌드 → `apps/web/src/lib/station-names-en.ts` 정적 dict로 commit.

### 환경변수

```
SOLAR_API_KEY=...   # Upstage Solar Pro 2 (위 4개 모두 공통)
```

### LLM 미사용 영역 (의도적)

- 자전거 길찾기 → Google Maps / NAVER / 카카오맵 딥링크 위임
- 음식 추천 → 외부 지도 앱 위임 (사진·평점·실시간 정보 우위)
- 행사 카테고리 분류 → 서울 OpenAPI 원본 필드 그대로
- 따릉이 인기도 산출 → 통계 (월별 대여 횟수 합산 + z-score)

데이터 분석/시각화 자체에는 LLM을 끼워 넣지 않습니다. 정적 데이터로 만들 수 있는 결과는 정적으로 만듭니다.

## 데이터 소스

- 서울 OpenAPI: `cycleForeignerRentMonthInfo`, `culturalEventInfo`, `ListPublicReservationCulture`, `ListPublicReservationEnglish`, `SJWPerform`
- 따릉이 대여소 마스터 CSV (위경도, CP949)
- 기상청 apihub `https://apihub.kma.go.kr` (`getVilageFcst` 단기예보, 1시간 슬롯)
- Reddit r/seoul · r/korea (anonymous JSON), Visit Seoul (cheerio), NAVER 뉴스 — 트렌딩 파이프라인 전용

## 환경변수 (`.env.local`)

```
SEOUL_OPEN_API_KEY=...                # 서울 열린데이터광장 (없으면 sample)
KMA_API_KEY=...                       # 기상청 apihub (없으면 mock 날씨)
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=...   # NAVER Maps Client ID (지도 표시 필수)
SOLAR_API_KEY=...                     # AI 기능 전체 공통 (Solar Pro 2)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

## 데이터 갱신 스케줄

| 워크플로 | 시각 (KST) | 산출물 |
|---|---|---|
| `bike-daily.yml` | 06:00 | 따릉이 인기 대여소 50개 → Supabase `popular_stations` |
| `events-daily.yml` | 06:00 | 문화행사 + 영문 번역 → Supabase `events_by_station` |
| `trending-daily.yml` | 06:00 | 외부 buzz 합성 → Supabase `trending` |
| `recommendations-daily.yml` | 07:00 | AI Pick 5/anchor → Supabase `daily_recommendations` |
| (런타임) 기상예보 | 1시간 ISR | `unstable_cache` 안에서 KMA 호출 후 현재 시각 슬롯 픽 |

## 아키텍처 요약

- **Web:** Next.js 16 App Router, ISR(`unstable_cache` revalidate 3600s).
- **Data backend:** Supabase (Postgres) — 4개 테이블 + RLS public read.
- **Cron:** GitHub Actions (서버 푸시 없이 ETL → Supabase 업서트).
- **Deploy:** Docker Compose (web + nginx + certbot) 자체 호스팅.
