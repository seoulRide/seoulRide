---
name: nextjs-app-build
description: Next.js 16 App Router로 seoulRide UI(지도, 대여소 카드, 행사·음식·날씨 위젯, KO/EN i18n)를 구축할 때 사용. shadcn/ui 셋업, Leaflet 지도, 데이터 정적 import, Cache Components/PPR 패턴, Vercel 배포 가정 표준을 정의한다. LLM은 사용하지 않는다(영문 카피는 데이터셋 매칭 + 정적 dict로 처리).
---

# seoulRide Next.js App Router 빌드 표준

Vercel 배포가 디폴트. Next.js 16 + App Router + Tailwind + shadcn/ui + Leaflet. LLM/AI Gateway 없음.

## 스캐폴드

```bash
pnpm dlx create-next-app@latest apps/web \
  --ts --app --tailwind --eslint --use-pnpm --src-dir --import-alias "@/*" --turbopack --yes
cd apps/web
pnpm dlx shadcn@latest init -d
pnpm dlx shadcn@latest add card button badge sheet tabs separator skeleton
pnpm add react-leaflet leaflet @types/leaflet
pnpm add zod
```

## 디렉토리 (apps/web/)

```
src/
  app/
    layout.tsx        # 루트 레이아웃, lang 토글
    page.tsx          # 홈 — 지도 + 사이드바
    station/[id]/page.tsx
    events/page.tsx
    about/page.tsx
    api/
      stations/route.ts   # _workspace 데이터 → JSON 응답
      events/route.ts
      weather/route.ts
  components/
    map/SeoulMap.tsx     # client component (Leaflet)
    cards/StationCard.tsx
    cards/EventCard.tsx
    cards/FoodCard.tsx
    cards/WeatherWidget.tsx
    LangToggle.tsx
  lib/
    types.ts          # zod schemas (데이터 에이전트 출력과 일치)
    data.ts           # _workspace 산출물 로딩 (server-only)
    i18n.ts           # 간단한 dict 토글
public/
  locales/{en,ko}.json
```

## 데이터 로딩 (Server Components)

```ts
// src/lib/data.ts
import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { PopularStations } from "./types";

const WS = path.resolve(process.cwd(), "../../_workspace");

export async function getPopularStations() {
  const raw = await fs.readFile(path.join(WS, "02_analytics/popular_stations.json"), "utf8");
  return PopularStations.parse(JSON.parse(raw));
}
```

Cache Components 사용:
```ts
"use cache";
export async function getEvents() { /* ... */ }
```

## 지도

```tsx
// src/components/map/SeoulMap.tsx
"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export function SeoulMap({ stations }: { stations: Station[] }) {
  return (
    <MapContainer center={[37.5665, 126.9780]} zoom={12} className="h-[70vh] w-full rounded-xl">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {stations.map(s => (
        <Marker key={s.station_no} position={[s.lat, s.lng]}>
          <Popup>...</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

루트 컴포넌트에서 dynamic import (SSR 비활성):
```tsx
import dynamic from "next/dynamic";
const SeoulMap = dynamic(() => import("@/components/map/SeoulMap").then(m => m.SeoulMap), { ssr: false });
```

## i18n (단순)

```ts
// src/lib/i18n.ts
import en from "../../public/locales/en.json";
import ko from "../../public/locales/ko.json";

export type Lang = "en" | "ko";
const dicts = { en, ko };

export function t(key: string, lang: Lang) {
  return dicts[lang][key] ?? key;
}
```

URL 파라미터 `?lng=ko` 토글, 쿠키에 영구화. **default는 영문** (외국인 타깃).

## 영문 카피 출처

LLM 호출 없음. 두 경로로만 영문 표기를 채운다:
1. **행사**: `events-geo-join` 스킬이 `ListPublicReservationEnglish` 데이터셋과 dedupe 매칭으로 영문 표기를 가져옴. 매칭 실패 시 한국어 원어를 그대로 노출 (`en_fallback: "ko_original"` 플래그로 UI에서 ⓘ 표시 가능).
2. **음식**: `food-hotspot-analysis` 스킬의 `references/food-blurbs.json` 정적 dict에서 카테고리 키로 lookup, `{gu_en}` 토큰만 치환.

`.env.local`:
```
SEOUL_OPEN_API_KEY=...
KMA_API_KEY=...
```

## shadcn 디자인 원칙

- **Generic AI grid 회피:** 카드 4개 동일 width 그리드 = AI 슬롭. 인기 1위는 hero 카드(2x), 나머지 작게.
- **계층:** 거리 정보는 small, 행사명은 lg semibold
- **마커:** 숫자 라벨 표시 (랭킹 1, 2, 3 시각적으로 구분)
- **로딩:** Skeleton 사용, spinner 금지

## Cache Components / PPR

```tsx
// app/page.tsx
import { Suspense } from "react";
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";

async function StationList() {
  "use cache";
  cacheLife("hours");
  cacheTag("stations");
  const data = await getPopularStations();
  return <List items={data} />;
}
```

## 빌드/배포

```bash
pnpm build          # Turbopack 빌드 검증
pnpm dev            # 로컬 개발
vercel link
vercel deploy --prebuilt
```

## Why

- **`_workspace` 직접 import:** 초기 단계는 데이터가 정적이므로 DB 도입 없이 파일 직접. 운영화 시 Vercel Storage(Neon) 마이그레이션.
- **Leaflet + OSM:** Mapbox 토큰 발급 마찰 회피. 서울 중심에서 OSM 품질 충분.
- **default 영문:** 외국인 타겟. 한국어 default는 사용자 기대를 깬다.
- **LLM 사용 안 함:** 본 프로젝트는 데이터 분석/시각화가 본질. 영문 카피는 데이터셋 매칭 + 정적 dict로 충분하며, LLM은 비결정성·캐싱·QA 비용·환각 위험만 추가한다.
