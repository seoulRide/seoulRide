---
name: events-geo-join
description: 인기 따릉이 대여소 좌표를 기준으로 문화행사·공공예약·세종문화회관 데이터를 반경 내 매칭할 때 사용. Haversine 거리 계산, 다중 출처 dedupe(제목+장소+시작일 키), 한/영 표기 동기화(영문 데이터셋 매칭 + ko 원어 폴백), 카테고리 5종 정규화 표준을 정의한다.
---

# 행사 ↔ 대여소 지오조인 표준

## 입력

- `popular_stations.json` (좌표 앵커)
- 4개 행사 데이터셋 정규화 JSON

## 좌표 표준화

각 데이터셋 좌표 컬럼이 다르다:

| 데이터셋 | 좌표 컬럼 |
|---------|---------|
| culturalEventInfo | LOT(경도)/LAT(위도) |
| ListPublicReservationCulture | X(경도)/Y(위도) |
| ListPublicReservationEnglish | X/Y |
| SJWPerform | (좌표 없음) → 세종문화회관 고정 좌표 사용: `lat: 37.5725, lng: 126.9760` |

**문자열 → number 변환** + 0/빈 값 필터.

## Haversine 거리

```ts
function haversineKm(a: {lat: number, lng: number}, b: {lat: number, lng: number}) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

## 반경 정책

- 도심권 자치구 (종로/중구/마포/용산/강남/서초): **0.7km**
- 일반: **1.0km**
- 외곽 (강서/도봉/노원/은평): **1.5km**

자치구별 자동 선택. 사용자가 명시하면 override.

## 일정 필터

- 기본: 오늘 ~ +14일 사이에 진행 중이거나 시작
- `(start <= now+14d) && (end >= now)`

## Dedupe

키: `lower(title_ko) + "|" + lower(venue_ko) + "|" + start_date`

같은 이벤트가 culturalEventInfo + ListPublicReservationCulture에 중복될 수 있으므로 합치고 `sources: string[]`에 출처 보존.

## 카테고리 정규화

```ts
const CATEGORY_MAP: Record<string, "concert" | "exhibition" | "festival" | "performance" | "experience"> = {
  "콘서트": "concert", "음악": "concert",
  "전시/미술": "exhibition", "전시": "exhibition",
  "축제": "festival",
  "뮤지컬/오페라": "performance", "연극": "performance", "공연": "performance",
  "교육/체험": "experience", "체험": "experience",
};
```

매핑 안 되면 "performance" default.

## 한/영 동시 표기

영문은 LLM으로 만들지 않는다. 같은 행사가 영문 데이터셋(`ListPublicReservationEnglish`)에 등재되어 있으면 그 표기를 그대로 사용하고, 없으면 한국어 원어를 그대로 영문 필드에 채운다.

### 매칭 규칙

1. dedupe 시 한국어/영문 row가 같은 행사인지 판정하는 키:
   - `start_date` (필수 일치)
   - `place` 좌표 거리 < 50m (또는 PLACENM 정규화 일치)
   - `gu` 일치
2. 매칭되면:
   ```ts
   title_en = enRow.SVCNM;
   venue_en = enRow.PLACENM;
   en_fallback = "matched_dataset";
   ```
3. 매칭 안 되면:
   ```ts
   title_en = title_ko;       // 원어 그대로
   venue_en = venue_ko;
   en_fallback = "ko_original"; // UI에서 작은 ⓘ 표시 가능
   ```

**Why no LLM:** 한국 축제명·고유명사를 LLM으로 번역하면 "벚꽃축제 → Cherry Blossom Festival"처럼 과번역되어 실제 행사명과 다른 검색 결과를 유발. 원어 표기가 외국인의 구글링·SNS 검색에도 더 유리. 또한 LLM 호출은 비결정적이라 같은 행사가 호출마다 다른 영문 명을 갖게 되어 dedupe·캐싱이 망가진다.

## 가격 정규화

- 무료: `"Free"`
- 유료: `"Paid (KRW ${amount.toLocaleString()})"` — amount 추출 못 하면 `"Paid"`

## 출력 shape

`events_by_station.json`:
```json
{
  "ST-1234": [
    {
      "id": "evt_a1b2",
      "title_ko": "...", "title_en": "...",
      "venue_ko": "...", "venue_en": "...",
      "category": "concert",
      "lat": 37.5, "lng": 126.9,
      "distance_km": 0.42,
      "start": "2026-05-09",
      "end": "2026-05-12",
      "price": "Paid (KRW 15,000)",
      "url": "https://...",
      "sources": ["culturalEventInfo"],
      "en_fallback": "matched_dataset"
    }
  ]
}
```

`en_fallback` 값: `"matched_dataset"` (영문 데이터셋과 매칭됨) | `"ko_original"` (원어 사용).

## Why

- **반경 자동 조정:** 강남에서 1km는 수십 개 행사가 잡혀 사용자가 압도된다. 도봉구에서 1km는 0건이다. 자치구 밀도 차이를 반영해야 사용자 경험이 일정해진다.
- **dedupe 후 sources 보존:** 출처를 잃으면 신뢰도 표시("3 sources confirmed")가 불가능하다.
- **en_fallback 플래그:** 영문이 데이터셋 매칭에서 온 건지 원어 그대로인지 frontend가 구분할 수 있어야 한다 (작은 ⓘ로 "Original Korean name" 안내 가능).
