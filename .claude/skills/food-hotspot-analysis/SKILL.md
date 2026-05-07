---
name: food-hotspot-analysis
description: 서울 상권분석(소비) trdarNcmCnsmp 데이터로 자치구별 음식 소비 핫스팟을 산출하고 외국인 친화적 카테고리 추천을 만들 때 사용. 추정치 한계 명시, 자치구 fallback, 정적 blurb dict(references/food-blurbs.json) lookup, 카테고리 over-selection 방지(자치구당 1~2개) 표준.
---

# 음식 핫스팟 분석 표준

상권분석서비스는 음식점 소비액 **추정치**(매출이 아님)를 상권 단위로 제공한다. 개별 식당 정보는 없다. 본 스킬은 이 한계를 정직하게 노출하면서 외국인 사용자에게 가치 있는 시그널을 추출한다.

## 입력

- `_workspace/01_ingest/trdarNcmCnsmp.normalized.json`
  ```json
  [{ "qtr": "20254", "trdar_cd": "3001436", "trdar_nm": "홍대입구역", "gu_ko": "마포구", "food_amt": 12345678901 }, ...]
  ```
- `_workspace/02_analytics/popular_stations.json`

## 절차

### 1. 자치구 집계

상권 단위는 너무 좁고 비공개 자치구 데이터셋도 있어 일관성이 떨어진다. **자치구 단위로 집계**:

```ts
const guAgg = groupBy(rows, r => r.gu_ko);
const guScores = Object.entries(guAgg).map(([gu, rows]) => ({
  gu_ko: gu,
  food_amt_total: rows.reduce((a, b) => a + b.food_amt, 0),
}));
```

### 2. 정규화 점수

```ts
const max = Math.max(...guScores.map(s => s.food_amt_total));
guScores.forEach(s => s.activity_score = +(s.food_amt_total / max).toFixed(2));
```

### 3. 카테고리 매핑

`trdarNcmCnsmp`는 서비스 응답에 카테고리별 소비액 컬럼이 있다 (한식/중식/일식/양식/카페/제과 등). 외국인 친화 라벨로 변환:

```ts
const FOOD_CATEGORY: Record<string, {label_ko: string, label_en: string, blurb_template: string}> = {
  KOREAN_FOOD_AMT: {
    label_ko: "한식", label_en: "Korean Cuisine",
    blurb_template: "{gu} has a strong Korean cuisine scene — try local rice and stew houses near major streets.",
  },
  COFFEE_AMT: {
    label_ko: "카페", label_en: "Cafés",
    blurb_template: "{gu} is dotted with specialty coffee shops, especially in walkable side streets.",
  },
  // ...
};
```

### 4. 자치구당 1~2개만 선택

```ts
guScores.forEach(s => {
  s.top_categories = topNCategoriesForGu(s).slice(0, 2);
});
```

### 5. 영문 카피 lookup (정적 dict)

LLM 호출 없음. 사람이 한 번 작성한 정적 dict(`references/food-blurbs.json`)에서 카테고리 키로 lookup:

```ts
import blurbs from "./references/food-blurbs.json" with { type: "json" };

function getBlurb(category: string, gu_en: string) {
  const entry = blurbs.default[category] ?? blurbs.default["_carryall"];
  return {
    category,
    label_ko: entry.label_ko,
    label_en: entry.label_en,
    blurb_en: entry.blurb_en.replaceAll("{gu_en}", gu_en),
  };
}
```

추후 자치구별 미세 조정이 필요하면 `blurbs[gu_en][category]`로 override 키를 추가하는 형태로 확장 가능 (현재는 `default`만 있음).

미존재 키는 `_carryall` 사용 + 누락 키를 `_workspace/qa/missing_blurbs.txt`에 한 줄씩 append (다음 dict 보강 단서). 항상 `data_source: "estimated_consumption"` 플래그 유지.

### 6. 대여소에 매핑

```ts
const byStation: Record<string, FoodEntry> = {};
popularStations.forEach(st => {
  const guData = guScores.find(g => g.gu_ko === st.gu_ko);
  if (guData) byStation[st.station_no] = {
    gu_ko: st.gu_ko,
    gu_en: st.gu_en,
    activity_score: guData.activity_score,
    top_categories: guData.top_categories,
    data_source: "estimated_consumption",
  };
});
```

## 출력 shape

```json
{
  "ST-1234": {
    "gu_ko": "마포구", "gu_en": "Mapo-gu",
    "activity_score": 0.78,
    "top_categories": [
      {
        "category": "korean_food",
        "label_ko": "한식",
        "label_en": "Korean Cuisine",
        "blurb_en": "Mapo's grilled pork belly alleys near Mangwon Market are a local staple..."
      }
    ],
    "data_source": "estimated_consumption"
  }
}
```

## Why

- **자치구 단위 집계:** 상권 코드 기준 매핑은 좌표→상권 lookup이 부정확하다. 자치구는 모든 데이터에 일관되게 존재하므로 안전하다.
- **카테고리 1~2개:** 외국인 사용자에게 5개 카테고리를 던지면 결정 마비. "이 동네 가면 이거 먹어보세요" 한 줄이 더 강력.
- **추정치 표기:** 사용자가 "이 가게 매출"로 오해하면 안 된다. data_source 플래그로 frontend에서 작은 글씨 disclaimer 노출.
- **LLM 사용 안 함:** 음식 blurb는 도메인이 닫혀 있어(카테고리 enum + 자치구 25개) 사람이 한 번 작성한 dict가 일관성·캐싱·QA·비용 모든 면에서 LLM보다 낫다. 비결정적 출력은 같은 카테고리가 호출마다 다른 카피로 나와 사용자 신뢰를 깬다.
