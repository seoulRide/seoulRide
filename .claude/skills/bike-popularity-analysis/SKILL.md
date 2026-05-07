---
name: bike-popularity-analysis
description: 외국인 따릉이 월별/일별 대여 데이터를 분석해 인기 대여소 TOP-N과 자치구·시계열 분포를 산출할 때 사용한다. 대여소번호 키로 마스터 CSV(위경도)와 inner join, IQR 이상치 분리, Z-score 핫스팟 검출, 한/영 자치구명 동시 출력 표준을 정의한다.
---

# 외국인 따릉이 인기 대여소 분석 표준

목표: "외국인이 어디서 자전거를 타고 오는가/가는가"를 신뢰성 있게 답할 수 있는 좌표 + 점수 + 시계열 데이터셋을 만든다.

## 입력 가정

- `_workspace/01_ingest/cycleForeignerRentMonthInfo.normalized.json`
  ```json
  [{ "ym": "202504", "station_no": "ST-1234", "rent_cnt": 412 }, ...]
  ```
- `_workspace/01_ingest/cycleForeignerRentDayInfo.normalized.json`
  ```json
  [{ "date": "2026-04-15", "station_no": "ST-1234", "station_name": "여의나루역 1번출구", "rent_cnt": 21, "rtn_cnt": 19 }, ...]
  ```
- `_workspace/01_ingest/station_master.normalized.json`
  ```json
  [{ "station_no": "ST-1234", "station_name_ko": "여의나루역 1번출구 앞", "lat": 37.5273, "lng": 126.9325, "gu_ko": "영등포구" }, ...]
  ```

## 처리 절차

### 1. Join

대여소번호로 inner join. **표기 정규화**:
- "ST-1234", "1234", "ST_1234" 등 prefix 변형은 숫자 부분 추출 후 비교

```ts
const norm = (s: string) => s.replace(/[^0-9]/g, "");
const masterByNo = new Map(master.map(m => [norm(m.station_no), m]));
```

매칭 안 되는 row는 `unmatched_stations.json`에 기록 후 제외 (실패 아님).

### 2. 집계

- 월별 합계: `rent_total_by_station = Σ rent_cnt by station_no`
- 자치구별 합계: `rent_total_by_gu`
- 일별 데이터로 요일/시간 패턴 (옵션)

### 3. 이상치 분리

```ts
const sorted = totals.sort((a, b) => a - b);
const q1 = sorted[Math.floor(sorted.length * 0.25)];
const q3 = sorted[Math.floor(sorted.length * 0.75)];
const iqr = q3 - q1;
const upperFence = q3 + 1.5 * iqr;
// upperFence 초과 = 이상치, 별도 outliers.json에 보존하되 popular_stations에서는 유지
```

이상치를 **삭제하지 않는다** — 관광 이벤트 단서로 가치 있다.

### 4. 핫스팟 점수 (Z-score)

```ts
const mean = sum / n;
const sd = Math.sqrt(variance);
const z = (rent_total - mean) / sd;
// z >= 1.0 → "hotspot"
```

### 5. 출력

```ts
const out = stations.map(s => ({
  station_no: s.station_no,
  station_name_ko: s.station_name_ko,
  station_name_en: s.station_name_en ?? null, // 마스터 영문 없으면 null
  lat: s.lat, lng: s.lng,
  gu_ko: s.gu_ko, gu_en: GU_MAP[s.gu_ko],
  rent_total: s.rent_total,
  rank_overall: s.rank_overall,
  rank_in_gu: s.rank_in_gu,
  hotspot_z: s.z,
  is_outlier: s.z > 1.5 || s.rent_total > upperFence,
  monthly_series: s.series, // [{ ym, cnt }]
}));
out.sort((a, b) => b.rent_total - a.rent_total);
```

기본 TOP 50 출력. 추가 옵션은 파라미터.

## Why

- **outlier 보존:** 외국인 자전거 데이터는 K-pop 콘서트, 국제행사 같은 단발 이벤트로 스파이크가 잦다. 이 스파이크 자체가 "외국인이 어디 가는가"의 강력한 신호이므로 일반 이상치처럼 trim하면 안 된다.
- **자치구명 한/영:** 외국인 사용자 default가 영어이므로 join 결과에 영문 표기가 반드시 포함되어야 다운스트림(이벤트 큐레이션, 음식 추천)에서 영문 매칭이 가능.
- **inner join:** 위경도 없으면 지도에 못 찍는다. left join으로 좌표 결측을 허용하면 다운스트림이 무너진다.
