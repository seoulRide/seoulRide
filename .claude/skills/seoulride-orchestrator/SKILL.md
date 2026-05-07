---
name: seoulride-orchestrator
description: seoulRide 앱(외국인 따릉이 인기 대여소 + 주변 문화행사 + 먹을거리 + 기상예보) 작업 시 반드시 사용하는 오케스트레이터. 데이터 수집부터 Next.js 빌드, QA, 재실행, 부분 재실행, 데이터/UI/날씨/행사/음식 추가나 수정 요청 모두 이 스킬로 처리. 키워드 — seoulRide, 따릉이, 외국인 자전거, 서울 문화행사, 라이딩 추천, 다시 실행, 재실행, 업데이트, 수정, 보완, 데이터 갱신, 행사 더 추가, 음식 다시, 날씨 새로고침.
---

# seoulRide Orchestrator

외국인 따릉이 데이터 + 서울 문화행사·예약 + 상권(음식) + 기상 예보를 통합한 Next.js 앱을 구축·반복 개선하는 마스터 워크플로우.

**실행 모드:** 하이브리드
- Phase 2 (데이터 수집): **서브 에이전트** 병렬 실행 — 5개 데이터셋 독립적
- Phase 3~5 (분석·빌드·QA): **에이전트 팀** — 산출물 shape을 서로 참조하며 자체 조율

모든 Agent 호출에 `model: "opus"` 필수.

## Phase 0: 컨텍스트 확인 (필수)

작업 시작 전 항상 실행:

1. `_workspace/` 존재 여부 확인
2. 사용자 요청 분류:
   - **초기 실행** (`_workspace/` 없음): Phase 1부터 전체 실행
   - **부분 재실행** (`_workspace/` 있음 + "행사만 다시" 같은 부분 요청): 해당 에이전트만 호출
   - **새 실행** (`_workspace/` 있음 + 새 데이터/완전 재구축 요청): 기존 `_workspace`를 `_workspace_prev_{timestamp}/`로 백업 후 Phase 1
   - **데이터 갱신** ("최신 따릉이 데이터로 다시"): data-ingestion-agent에 `--refresh`로만 호출 → 의존하는 다운스트림 자동 재실행
3. 사용자에게 어떤 모드로 진행할지 1줄 보고 후 진행

## Phase 1: 환경 확인

- `data/raw/` 데이터 파일 존재 확인
- `.env.local`에 키 확인:
  - `SEOUL_OPEN_API_KEY` (없으면 `sample` 키로 진행하되 사용자에게 발급 안내)
  - `KMA_API_KEY` (없으면 모의 날씨 데이터)
- 의존성: `pnpm`, Node.js 20+, Python 3 (HTML xls 파싱 시)
- LLM/AI Gateway 키는 사용하지 않는다 (영문 카피는 데이터셋 매칭 + 정적 dict)

## Phase 2: 데이터 수집 (서브 에이전트, 병렬)

7개 서비스를 병렬 호출. 각각 `Agent` 도구로 `data-ingestion-agent`에 위임:

```
Agent(data-ingestion-agent, model=opus, run_in_background=true) × 7
  - cycleForeignerRentMonthInfo
  - cycleForeignerRentDayInfo
  - culturalEventInfo
  - ListPublicReservationCulture
  - ListPublicReservationEnglish
  - SJWPerform
  - trdarNcmCnsmp
+ 마스터 CSV 정규화 (1회)
```

산출물: `_workspace/01_ingest/{service}.normalized.json`

Phase 2 완료 게이트: 7개 파일 + master 모두 존재해야 다음 Phase.

## Phase 3: 분석·큐레이션 (에이전트 팀)

`TeamCreate(seoulride-curation, [bike-analytics, cultural-events, food-recommender, weather, integration-qa])`

작업 의존성:
1. **bike-analytics** 먼저 실행 → `popular_stations.json` 생성 (좌표 앵커)
2. 완료 즉시 SendMessage로 cultural-events·food-recommender·weather에 트리거
3. 세 에이전트 병렬 실행
4. 각 에이전트 산출물이 나올 때마다 **integration-qa-agent가 즉시 검증** (점진적)
5. critical 발견 시 책임 에이전트에 SendMessage, 차단

산출물:
- `02_analytics/popular_stations.json`
- `03_curation/events_by_station.json`
- `03_curation/food_by_station.json`
- `04_weather/forecast_by_gu.json`
- `qa/03_curation_report.md`

## Phase 4: 프론트엔드 (에이전트 팀 재구성)

이전 팀 정리 후 `TeamCreate(seoulride-build, [frontend-builder, integration-qa])`

1. frontend-builder가 `apps/web` 스캐폴드 (없으면) 또는 컴포넌트 갱신
2. 데이터 fetch + UI 빌드
3. `pnpm build` 통과 확인
4. `pnpm dev` 띄우고 integration-qa가 라우트 검증 + 스크린샷

산출물:
- `apps/web/` Next.js 앱
- `_workspace/qa/04_frontend_report.md`
- `_workspace/qa/screenshots/*.png`

## Phase 5: 사용자 보고 + 피드백 수집

- 인기 대여소 TOP 5, 매칭된 행사 수, 날씨 요약, dev URL 보고
- "결과에서 개선할 부분이 있나요?" 질문
- 피드백 받으면 Phase 7 분기로 갱신

## Phase 6 (조건부): 배포

사용자가 명시적으로 "배포"/"deploy" 요청 시:
- `vercel link` (없으면)
- 환경변수 vercel env에 등록
- `vercel deploy` (preview) → 사용자 확인 후 `--prod`

## Phase 7: 진화 (피드백 반영)

| 피드백 | 호출 |
|------|------|
| "더 많은 대여소" | bike-analytics-agent (TOP 50→100 등) |
| "반경 넓혀줘" | cultural-events-agent (radius 변경) |
| "다른 음식 카테고리도" | food-recommender-agent |
| "지금 날씨" | weather-agent --refresh |
| "디자인 바꿔줘" | frontend-builder-agent |
| 데이터 신뢰성 의심 | integration-qa-agent 재검증 |

CLAUDE.md 변경 이력 갱신.

## 데이터 전달 프로토콜

- **태스크 기반:** TaskCreate로 의존성 표현 (Phase 2 → 3 → 4)
- **파일 기반:** `_workspace/{phase}_{type}/{name}.json` (모든 산출물)
- **메시지 기반:** SendMessage로 "준비 완료" 알림
- **반환값 기반:** Phase 2 서브 에이전트는 반환값으로 성공/실패만

## 에러 핸들링

- API 키 없음/실패: 1회 재시도 → 모의 데이터로 폴백 + 보고서에 명시
- 데이터 결측 > 30%: 사용자에게 진행 여부 확인
- QA critical: 다음 Phase 차단, 책임 에이전트 재호출 (1회), 그래도 실패 시 사용자에게 수동 개입 요청
- frontend 빌드 실패: integration-qa가 에러 캡처 → frontend-builder에 정확한 위치 SendMessage

## 테스트 시나리오

### 정상 흐름
1. `_workspace/` 없음 + 사용자가 "seoulRide 만들어줘" 입력
2. Phase 0 → 초기 실행 모드 결정
3. Phase 2 병렬 수집 (7개 서비스)
4. Phase 3 분석 팀 실행 → popular_stations 등 산출
5. Phase 4 frontend-builder가 Next.js 앱 생성, dev 서버 띄움
6. integration-qa 검증 → PASS
7. 사용자에게 dev URL 보고

### 에러 흐름 1 — API 키 없음
1. Phase 1에서 SEOUL_OPEN_API_KEY 미설정 감지
2. data-ingestion-agent가 sample 키로 5건씩만 수집
3. 보고서에 "운영키 없음" 명시 + 발급 URL 안내
4. UI는 빈약하지만 빌드 통과

### 에러 흐름 2 — QA critical
1. Phase 3에서 events_by_station에 좌표 ∉ 서울 비율 5% 발견
2. integration-qa critical 보고
3. 오케스트레이터가 cultural-events-agent 재호출 (1회)
4. 여전히 critical이면 사용자에게 보고 + 수동 개입 요청

## 후속 작업 키워드

이 스킬은 다음 표현에서도 트리거되어야 한다:
- "다시 실행", "재실행", "업데이트", "수정", "보완"
- "데이터 갱신", "최신 데이터로"
- "행사 더", "음식 다시", "날씨 새로고침"
- "특정 자치구만", "강남구만"
- "디자인 개선", "UI 수정"
- "배포", "deploy", "vercel"
