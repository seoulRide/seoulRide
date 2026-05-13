import "server-only";
import { unstable_cache } from "next/cache";
import type { WeatherByGu, WeatherForecast } from "./types";

const SEOUL_GRID: Record<string, { gu_ko: string; nx: number; ny: number }> = {
  "Jongno-gu":      { gu_ko: "종로구",   nx: 60, ny: 127 },
  "Jung-gu":        { gu_ko: "중구",     nx: 60, ny: 127 },
  "Yongsan-gu":     { gu_ko: "용산구",   nx: 60, ny: 126 },
  "Seongdong-gu":   { gu_ko: "성동구",   nx: 61, ny: 127 },
  "Gwangjin-gu":    { gu_ko: "광진구",   nx: 62, ny: 126 },
  "Dongdaemun-gu":  { gu_ko: "동대문구", nx: 61, ny: 127 },
  "Jungnang-gu":    { gu_ko: "중랑구",   nx: 62, ny: 128 },
  "Seongbuk-gu":    { gu_ko: "성북구",   nx: 61, ny: 127 },
  "Gangbuk-gu":     { gu_ko: "강북구",   nx: 61, ny: 128 },
  "Dobong-gu":      { gu_ko: "도봉구",   nx: 61, ny: 129 },
  "Nowon-gu":       { gu_ko: "노원구",   nx: 61, ny: 129 },
  "Eunpyeong-gu":   { gu_ko: "은평구",   nx: 59, ny: 127 },
  "Seodaemun-gu":   { gu_ko: "서대문구", nx: 59, ny: 127 },
  "Mapo-gu":        { gu_ko: "마포구",   nx: 59, ny: 127 },
  "Yangcheon-gu":   { gu_ko: "양천구",   nx: 58, ny: 126 },
  "Gangseo-gu":     { gu_ko: "강서구",   nx: 58, ny: 126 },
  "Guro-gu":        { gu_ko: "구로구",   nx: 58, ny: 125 },
  "Geumcheon-gu":   { gu_ko: "금천구",   nx: 59, ny: 124 },
  "Yeongdeungpo-gu":{ gu_ko: "영등포구", nx: 58, ny: 126 },
  "Dongjak-gu":     { gu_ko: "동작구",   nx: 59, ny: 125 },
  "Gwanak-gu":      { gu_ko: "관악구",   nx: 59, ny: 125 },
  "Seocho-gu":      { gu_ko: "서초구",   nx: 61, ny: 125 },
  "Gangnam-gu":     { gu_ko: "강남구",   nx: 61, ny: 126 },
  "Songpa-gu":      { gu_ko: "송파구",   nx: 62, ny: 126 },
  "Gangdong-gu":    { gu_ko: "강동구",   nx: 62, ny: 126 },
};

interface RawForecast {
  temp_c?: number;
  rain_prob?: number;
  rain_mm?: number;
  wind_ms?: number;
  sky?: number;
  pty?: number;
  reh?: number;
}

function pickBaseTime(now: Date): { date: string; time: string } {
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const hours = [2, 5, 8, 11, 14, 17, 20, 23];
  let h = hours.filter((x) => x <= kst.getUTCHours()).pop();
  let dateOffset = 0;
  if (h === undefined) {
    h = 23;
    dateOffset = -1;
  }
  const d = new Date(kst);
  d.setUTCDate(d.getUTCDate() + dateOffset);
  return {
    date: d.toISOString().slice(0, 10).replace(/-/g, ""),
    time: String(h).padStart(2, "0") + "00",
  };
}

function rideScore(f: RawForecast): number {
  let score = 100;
  const rp = f.rain_prob ?? 0;
  const rmm = f.rain_mm ?? 0;
  const w = f.wind_ms ?? 0;
  const t = f.temp_c ?? 20;
  if (rp >= 60 || rmm > 1) return 0;
  if (rp >= 40) score -= 30;
  else if (rp >= 20) score -= 10;
  if (w > 10) score -= 40;
  else if (w > 7) score -= 20;
  else if (w > 5) score -= 10;
  if (t < -5 || t > 35) score -= 40;
  else if (t < 0 || t > 33) score -= 20;
  else if (t < 5 || t > 30) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function rideLabel(score: number): string {
  if (score >= 80) return "Great for cycling";
  if (score >= 60) return "Good — bring sunscreen/jacket";
  if (score >= 40) return "Mild conditions, ride with care";
  if (score >= 20) return "Not recommended";
  return "Skip cycling today";
}

async function fetchKma(
  authKey: string,
  nx: number,
  ny: number,
  base: { date: string; time: string },
): Promise<unknown[]> {
  const url = new URL(
    "https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst",
  );
  url.searchParams.set("authKey", authKey);
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("numOfRows", "1000");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("base_date", base.date);
  url.searchParams.set("base_time", base.time);
  url.searchParams.set("nx", String(nx));
  url.searchParams.set("ny", String(ny));
  const res = await fetch(url, { headers: { "User-Agent": "seoulRide/0.1" } });
  if (!res.ok) throw new Error(`KMA HTTP ${res.status}`);
  const data = (await res.json()) as {
    response?: { body?: { items?: { item?: unknown[] } } };
  };
  return data.response?.body?.items?.item ?? [];
}

function aggregate(items: unknown[], at: Date): { now: RawForecast; series: { ts: string; f: RawForecast }[] } {
  const buckets = new Map<string, RawForecast>();
  for (const raw of items) {
    const it = raw as { fcstDate?: string; fcstTime?: string; fcstValue?: string; category?: string };
    const key = `${it.fcstDate}_${it.fcstTime}`;
    let f = buckets.get(key);
    if (!f) {
      f = {};
      buckets.set(key, f);
    }
    const v = parseFloat(it.fcstValue ?? "");
    switch (it.category) {
      case "TMP": f.temp_c = v; break;
      case "POP": f.rain_prob = v; break;
      case "PCP":
        if (it.fcstValue === "강수없음" || it.fcstValue === "0" || it.fcstValue === "0mm") f.rain_mm = 0;
        else if (typeof it.fcstValue === "string" && it.fcstValue.includes("mm")) f.rain_mm = parseFloat(it.fcstValue) || 0;
        else f.rain_mm = isNaN(v) ? 0 : v;
        break;
      case "WSD": f.wind_ms = v; break;
      case "SKY": f.sky = v; break;
      case "PTY": f.pty = v; break;
      case "REH": f.reh = v; break;
    }
  }
  const sorted = [...buckets.entries()].sort();
  // Pick the bucket matching the current KST hour. KMA's getVilageFcst response
  // contains hourly forecasts for ~3 days from base_time; without this, we'd
  // always pick the first slot (base_time+1h) and the displayed value would
  // only advance when base_time rolls (every 3h). Falls back to sorted[0] if
  // no slot is ≤ now (e.g., right after a base_time switch).
  const kst = new Date(at.getTime() + 9 * 3600 * 1000);
  const yyyymmdd = kst.toISOString().slice(0, 10).replace(/-/g, "");
  const targetKey = `${yyyymmdd}_${String(kst.getUTCHours()).padStart(2, "0")}00`;
  let pickIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i][0] <= targetKey) pickIdx = i;
    else break;
  }
  const now: RawForecast = sorted[pickIdx]?.[1] ?? {};
  const series = sorted.slice(pickIdx, pickIdx + 8).map(([ts, f]) => ({ ts, f }));
  return { now, series };
}

function mockFor(guEn: string): RawForecast {
  let seed = 0;
  for (const c of guEn) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const r = (n: number) => ((seed = (seed * 1664525 + 1013904223) >>> 0) % n);
  return {
    temp_c: 18 + r(10),
    rain_prob: r(40),
    rain_mm: 0,
    wind_ms: 2 + r(4),
    reh: 40 + r(40),
  };
}

function buildMocked(guList: string[], reason: string): WeatherByGu {
  const out: Record<string, WeatherForecast> = {};
  const issuedAt = new Date().toISOString();
  for (const guEn of guList) {
    const grid = SEOUL_GRID[guEn];
    const f = mockFor(guEn);
    const score = rideScore(f);
    out[guEn] = {
      gu_ko: grid?.gu_ko ?? guEn,
      gu_en: guEn,
      issued_at: issuedAt,
      mocked: true,
      mock_reason: reason,
      now: { ...f, ride_score: score, label_en: rideLabel(score) },
      next_24h: [],
      warnings: [],
    };
  }
  return out;
}

async function buildForecastByGu(guList: string[]): Promise<WeatherByGu> {
  const apiKey = process.env.KMA_API_KEY;
  if (!apiKey) return buildMocked(guList, "KMA_API_KEY not set");

  const issuedAt = new Date();
  const base = pickBaseTime(issuedAt);
  const out: Record<string, WeatherForecast> = {};
  let lastErr = "";

  const results = await Promise.allSettled(
    guList.map(async (guEn) => {
      const grid = SEOUL_GRID[guEn];
      if (!grid) return null;
      const items = await fetchKma(apiKey, grid.nx, grid.ny, base);
      if (!items.length) throw new Error("empty items");
      const { now, series } = aggregate(items, issuedAt);
      const score = rideScore(now);
      const entry: WeatherForecast = {
        gu_ko: grid.gu_ko,
        gu_en: guEn,
        issued_at: `${base.date.slice(0, 4)}-${base.date.slice(4, 6)}-${base.date.slice(6, 8)}T${base.time.slice(0, 2)}:00:00+09:00`,
        mocked: false,
        now: { ...now, ride_score: score, label_en: rideLabel(score) },
        next_24h: series.map((x) => ({ ...x.f, ts: x.ts, ride_score: rideScore(x.f) })),
        warnings: [],
      };
      return { guEn, entry };
    }),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) out[r.value.guEn] = r.value.entry;
    else if (r.status === "rejected") lastErr = String(r.reason?.message ?? r.reason);
  }

  if (Object.keys(out).length === 0) {
    return buildMocked(guList, `all KMA requests failed (${lastErr || "unknown"})`);
  }
  return out;
}

/**
 * Hourly-revalidated forecast per gu. Argument list is part of the cache key,
 * so distinct popular-station sets get separate entries.
 */
export const getCachedWeatherByGu = unstable_cache(
  async (guList: string[]) => buildForecastByGu(guList),
  ["weather-by-gu-v1"],
  { revalidate: 3600, tags: ["weather"] },
);
