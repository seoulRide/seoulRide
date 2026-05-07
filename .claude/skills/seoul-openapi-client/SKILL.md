---
name: seoul-openapi-client
description: 서울 열린데이터광장(openapi.seoul.go.kr) 호출 표준. 따릉이 외국인 대여, 문화행사, 공공예약, 세종문화회관, 상권분석 7개 엔드포인트를 호출하거나 정규화할 때 반드시 이 스킬을 사용한다. 인증키 관리, 페이지네이션(START_INDEX/END_INDEX), 결과코드 처리, 자치구명 정규화, CP949/UTF-8 인코딩 이슈를 다룬다.
---

# Seoul Open API 호출 표준

서울시 OpenAPI는 `http://openapi.seoul.go.kr:8088/{KEY}/{TYPE}/{SERVICE}/{START}/{END}/[arg1]/[arg2]/...` 형식을 가진다. 본 스킬은 7개 서비스에 대한 안정적 호출·정규화 절차를 정의한다.

## 인증키

- 운영키: `process.env.SEOUL_OPEN_API_KEY` (Vercel/`.env.local`)
- 미발급 시 `sample` 사용 (5건만 반환). 개발 단계 스키마 추론에 충분.

## 엔드포인트 매핑

| 서비스 | path | 주요 인자 | 결과 컨테이너 |
|------|------|---------|------------|
| `cycleForeignerRentMonthInfo` | (none) | START/END | `cycleForeignerRentMonthInfo.row[]` |
| `cycleForeignerRentDayInfo` | (none) | START/END | `cycleForeignerRentDayInfo.row[]` |
| `culturalEventInfo` | `[CODENAME]/[TITLE]/[DATE]` | 분류/제목/날짜 | `culturalEventInfo.row[]` |
| `ListPublicReservationCulture` | `[SVCNM]/[GUNAME]` | 예약명/자치구 | `ListPublicReservationCulture.row[]` |
| `ListPublicReservationEnglish` | (영문) | (동일) | `ListPublicReservationEnglish.row[]` |
| `SJWPerform` | `[KIDX]` | 공연ID 옵션 | `SJWPerform.row[]` |
| `trdarNcmCnsmp` | (none) | START/END | `trdarNcmCnsmp.row[]` |

## 호출 패턴 (TypeScript / Node.js)

```ts
const KEY = process.env.SEOUL_OPEN_API_KEY ?? "sample";
const PAGE = 1000; // 서울 OpenAPI는 1회 1000건 권장 상한

async function fetchPage(service: string, start: number, end: number, args: string[] = []) {
  const path = [KEY, "json", service, start, end, ...args].join("/");
  const url = `http://openapi.seoul.go.kr:8088/${path}`;
  const res = await fetch(url, { headers: { "User-Agent": "seoulRide/0.1" } });
  if (!res.ok) throw new Error(`${service} HTTP ${res.status}`);
  const data = await res.json();
  const root = data[service];
  if (!root) throw new Error(`Unexpected payload for ${service}`);
  if (root.RESULT?.CODE && !root.RESULT.CODE.startsWith("INFO-000")) {
    if (root.RESULT.CODE === "INFO-200") return { rows: [], total: 0 }; // 데이터 없음
    throw new Error(`${service}: ${root.RESULT.CODE} ${root.RESULT.MESSAGE}`);
  }
  return { rows: root.row ?? [], total: root.list_total_count ?? 0 };
}

export async function fetchAll(service: string, args: string[] = []) {
  const all: any[] = [];
  let start = 1;
  while (true) {
    const { rows, total } = await fetchPage(service, start, start + PAGE - 1, args);
    all.push(...rows);
    if (all.length >= total || rows.length === 0) break;
    start += PAGE;
  }
  return all;
}
```

## 결과코드 처리

| CODE | 의미 | 처리 |
|------|------|------|
| `INFO-000` | 정상 | 진행 |
| `INFO-200` | 데이터 없음 | 빈 배열 반환, 정상 |
| `ERROR-300` | 필수값 오류 | 인자 점검 후 1회 재시도 |
| `ERROR-301` | 타입 오류 | path 구성 점검 |
| `ERROR-500` | 서버 오류 | 백오프 3회 |
| `INFO-100` | 인증키 오류 | 키 재발급 안내 |

## 자치구 정규화

자치구 표기(GUNAME, AREANM, SIGUNGU)는 서비스마다 다르다. 통일 규칙:

```ts
// references/gu-mapping.json 참조
const GU_KO_TO_EN: Record<string, string> = {
  "강남구": "Gangnam-gu",
  "마포구": "Mapo-gu",
  // ... 25개
};
```

전체 매핑은 `references/gu-mapping.json`에 있다.

## 인코딩

- 따릉이 마스터 CSV는 **CP949**(EUC-KR). 읽을 때 명시.
  ```ts
  import iconv from "iconv-lite";
  const buf = await fs.readFile(path);
  const text = iconv.decode(buf, "cp949");
  ```
- 파이썬: `pd.read_csv(..., encoding="cp949")`
- API 응답은 UTF-8.

## 캐싱

- 캐시 디렉토리: `data/cache/seoul/{service}_{argsHash}.json`
- TTL: 일별 데이터 24h, 월별/마스터 7d
- `--refresh` 플래그 시 캐시 무시

## Why

서울 OpenAPI는 (a) 결과코드를 HTTP 200 안에 넣어 던지므로 status로만 판단하면 빈 응답을 정상으로 오인한다, (b) 페이지네이션 상한이 명세에 일관되지 않아 1000건 이상 주면 잘리는 케이스가 있다, (c) 자치구명이 한글 인코딩+표기 불일치로 join 실패가 잦다. 이 세 가지가 본 스킬의 존재 이유다.

## 참고

- 자치구 매핑 전체: `references/gu-mapping.json`
- 서비스별 필드 사전: `references/field-dictionary.md`
