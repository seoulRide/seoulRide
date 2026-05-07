---
name: integration-qa-checklist
description: seoulRide 데이터 산출물과 프론트엔드 훅의 shape 정합성을 경계면 단위로 검증할 때 사용. 각 모듈 완성 직후(전체 끝나고 1회 X) 점진적으로 호출. 좌표 범위, 다국어 결측률, 거리/반경 sanity, 타임존(KST), Playwright 라우트 200 검증 표준.
---

# 경계면 정합성 점검 체크리스트

QA의 핵심은 "키 존재 여부"가 아니라 **데이터 산출물과 소비자 훅을 동시에 읽고 비교**하는 것이다.

## 시점

각 데이터 에이전트가 산출물을 만들면 즉시 호출. 통합 테스트는 별도가 아니라 점진적.

## 검증 매트릭스

### 1. Schema cross-read (가장 중요)

```bash
# 산출물
cat _workspace/02_analytics/popular_stations.json | head -50
# 소비자 타입
cat apps/web/src/lib/types.ts
```

zod schema와 실제 JSON의 키 차이를 diff:
- 누락 키 (frontend에서 undefined로 깨짐)
- 추가 키 (스키마 갱신 필요)
- 타입 불일치 (string 기대인데 number)

### 2. 좌표 sanity

```ts
const inSeoul = (lat: number, lng: number) =>
  lat >= 37.4 && lat <= 37.7 && lng >= 126.7 && lng <= 127.2;
```

서울 밖 좌표 비율이 1% 초과면 critical.

### 3. 거리 vs 반경

```ts
// events_by_station.json: distance_km <= radius (자치구별)
events.forEach(e => {
  const radius = radiusForGu(station.gu_ko);
  if (e.distance_km > radius) report("major", `event ${e.id} distance ${e.distance_km}km > ${radius}km`);
});
```

### 4. 다국어 결측률

```ts
const enMissing = events.filter(e => !e.title_en).length / events.length;
if (enMissing > 0.05) report("major", `English missing ${(enMissing*100).toFixed(1)}%`);
```

### 5. 타임존 (KST)

- weather.issued_at, events.start/end는 모두 ISO + `+09:00` 또는 명시된 KST
- UTC 또는 무명 datetime 검출 시 critical

### 6. 외국인 데이터 의미 검증

- popular_stations rent_total ≥ 0
- monthly_series 합 ≈ rent_total (오차 5% 이내)
- 음식 activity_score ∈ [0, 1]
- 날씨 ride_score ∈ [0, 100]

### 7. dev 서버 라우트 200

```bash
pnpm --filter web dev &
DEV_PID=$!
sleep 8
for path in / /events /about; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000$path)
  [ "$code" = "200" ] || echo "FAIL $path $code"
done
# 임의 station 1건
sid=$(jq -r '.[0].station_no' _workspace/02_analytics/popular_stations.json)
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/station/$sid"
kill $DEV_PID
```

### 8. Playwright 스크린샷 (선택)

```ts
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:3000");
await page.screenshot({ path: "_workspace/qa/home.png", fullPage: true });
```

## 보고 형식

`_workspace/qa/{phase}_{n}_report.md`:

```markdown
# QA Report — Phase 02 (analytics)

**Health Score:** 87/100
**Status:** PASS (with warnings)

## Critical
- (none)

## Major
- events.title_en matched-from-dataset rate is only 62% (38% fall back to ko_original)
  - Owner: cultural-events-agent
  - Suggested fix: tighten dedupe matching keys (e.g., loosen place-name normalization) to recover more English-dataset matches; the remaining ko_original entries are acceptable per design

## Minor
- 2 records have rent_total = 0 (likely test data)
```

## 책임 분배

- bug 발견 → 직접 수정 금지, **책임 에이전트에 SendMessage**
- critical 1건 이상 → 오케스트레이터에 진행 차단 신호

## Why

- **점진적 QA:** 마지막에 한 번에 검증하면 누가 깬 건지 추적 비용 폭증
- **경계면 cross-read:** 한쪽만 읽으면 "키가 있다"는 사실만 안다. 양쪽 비교해야 mismatch 발견
- **수정 금지:** QA가 수정하면 책임이 흐려진다. 보고만 하고 책임 에이전트가 수정하면 학습/예방 가능
