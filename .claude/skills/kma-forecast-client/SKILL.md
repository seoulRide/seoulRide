---
name: kma-forecast-client
description: 기상청 apihub.kma.go.kr 예특보 API 호출 표준. 단기예보·동네예보·기상특보를 자치구별로 호출, 자치구→격자(nx,ny) 매핑, 텍스트/JSON 응답 파싱, 자전거 라이딩 적합도 점수(0~100) 산출 공식을 정의한다. 날씨/예보/풍속/강수/적합도 작업 시 사용.
---

# KMA apihub 예특보 호출 + 라이딩 적합도 산출

## 인증

- `KMA_API_KEY` 환경변수
- apihub 계정 발급 후 마이페이지에서 키 복사
- 키 미발급 시 모의 데이터 폴백 (`mocked: true`)

## 사용할 엔드포인트

| 용도 | endpoint | 응답 |
|------|---------|------|
| 단기예보(동네예보, 3시간 단위 +3일) | `https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst` | JSON |
| 초단기실황 | `.../getUltraSrtNcst` | JSON |
| 기상특보 | `.../typ01/url/wrn_now_data.php` | TEXT (CSV-like) |

JSON 엔드포인트 호출 예:
```ts
const url = new URL("https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst");
url.searchParams.set("authKey", process.env.KMA_API_KEY!);
url.searchParams.set("dataType", "JSON");
url.searchParams.set("numOfRows", "1000");
url.searchParams.set("pageNo", "1");
url.searchParams.set("base_date", baseDate); // YYYYMMDD
url.searchParams.set("base_time", baseTime); // 0200/0500/0800/1100/1400/1700/2000/2300
url.searchParams.set("nx", String(grid.nx));
url.searchParams.set("ny", String(grid.ny));
const res = await fetch(url);
const data = await res.json();
const items = data.response?.body?.items?.item ?? [];
```

## 자치구 → 격자 매핑

서울 25개 자치구 대표 격자 (`references/seoul-grid.json`). 자치구별로 1포인트만 호출 (행정동 단위는 과함).

## base_date/base_time 산출

단기예보는 발표 시각 기준 가장 최근 발효본을 호출:
- 발표 시각: 02, 05, 08, 11, 14, 17, 20, 23 (KST)
- 현재 시각이 09:30 KST면 base_time=0800 사용

```ts
function pickBaseTime(now: Date): { date: string, time: string } {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const hours = [2, 5, 8, 11, 14, 17, 20, 23];
  let h = hours.filter(x => x <= kst.getHours()).pop() ?? 23;
  const offset = h === 23 && kst.getHours() < 2 ? -1 : 0;
  const d = new Date(kst);
  if (offset) d.setDate(d.getDate() - 1);
  return {
    date: d.toISOString().slice(0,10).replace(/-/g, ""),
    time: String(h).padStart(2, "0") + "00",
  };
}
```

## 응답 카테고리

| category | 의미 | 단위 |
|---------|------|------|
| TMP | 1시간 기온 | °C |
| POP | 강수확률 | % |
| PCP | 1시간 강수량 | mm (0/0.1mm/...) |
| WSD | 풍속 | m/s |
| SKY | 하늘상태 | 1맑음/3구름많음/4흐림 |
| PTY | 강수형태 | 0없음/1비/2비눈/3눈/4소나기 |
| REH | 습도 | % |

## 라이딩 적합도 (0~100)

```ts
function rideScore(f: {temp_c:number, rain_prob:number, rain_mm:number, wind_ms:number, pm10?:number}): number {
  let score = 100;
  // 강수 — 강함
  if (f.rain_prob >= 60 || f.rain_mm > 1) return 0;
  if (f.rain_prob >= 40) score -= 30;
  else if (f.rain_prob >= 20) score -= 10;
  // 바람
  if (f.wind_ms > 10) score -= 40;
  else if (f.wind_ms > 7) score -= 20;
  else if (f.wind_ms > 5) score -= 10;
  // 기온
  if (f.temp_c < -5 || f.temp_c > 35) score -= 40;
  else if (f.temp_c < 0 || f.temp_c > 33) score -= 20;
  else if (f.temp_c < 5 || f.temp_c > 30) score -= 10;
  // 미세먼지
  if (f.pm10 != null) {
    if (f.pm10 > 150) score -= 30;
    else if (f.pm10 > 80) score -= 15;
  }
  return Math.max(0, Math.min(100, score));
}

function labelEn(score: number): string {
  if (score >= 80) return "Great for cycling";
  if (score >= 60) return "Good — bring sunscreen/jacket";
  if (score >= 40) return "Mild conditions, ride with care";
  if (score >= 20) return "Not recommended";
  return "Skip cycling today";
}
```

## 캐싱

- TTL 1시간
- 키: `weather_${gu}_${baseDate}${baseTime}`
- 디렉토리: `data/cache/weather/`

## Why

- **자치구 단위:** 서울은 격자 1km 단위지만, UI는 자치구 단위로만 표시한다. 격자별 호출은 25배 비용 + UI에 못 쓴다.
- **base_time 정확:** 잘못된 base_time은 NO_DATA를 반환한다. 한국 표준시 보정이 핵심.
- **점수 0 처리(rain ≥ 60%):** 외국인 사용자는 한국 우기 미경험자가 많다. "비 온다"는 신호를 강하게 줘야 한다.
