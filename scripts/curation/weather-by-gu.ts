import { promises as fs } from "node:fs";
import path from "node:path";
import { loadEnv, PATHS } from "../lib/env.ts";
import { SEOUL_GRID } from "../lib/seoul-grid.ts";

interface Station { gu_en: string | null; gu_ko: string }

function pickBaseTime(now: Date): { date: string; time: string } {
  // KST = UTC+9
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

interface Forecast { temp_c?: number; rain_prob?: number; rain_mm?: number; wind_ms?: number; sky?: number; pty?: number; reh?: number }

function rideScore(f: Forecast): number {
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

async function fetchKma(authKey: string, nx: number, ny: number, base: { date: string; time: string }) {
  const url = new URL("https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst");
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
  const data: any = await res.json();
  const items: any[] = data?.response?.body?.items?.item ?? [];
  return items;
}

function aggregate(items: any[]): { now: Forecast; series: { ts: string; f: Forecast }[] } {
  // group by fcstDate+fcstTime
  const buckets = new Map<string, Forecast>();
  for (const it of items) {
    const key = `${it.fcstDate}_${it.fcstTime}`;
    let f = buckets.get(key);
    if (!f) { f = {}; buckets.set(key, f); }
    const v = parseFloat(it.fcstValue);
    switch (it.category) {
      case "TMP": f.temp_c = v; break;
      case "POP": f.rain_prob = v; break;
      case "PCP":
        if (it.fcstValue === "강수없음" || it.fcstValue === "0" || it.fcstValue === "0mm") f.rain_mm = 0;
        else if (typeof it.fcstValue === "string" && it.fcstValue.includes("mm")) f.rain_mm = parseFloat(it.fcstValue) || 0;
        else f.rain_mm = isNaN(v) ? 0 : v; break;
      case "WSD": f.wind_ms = v; break;
      case "SKY": f.sky = v; break;
      case "PTY": f.pty = v; break;
      case "REH": f.reh = v; break;
    }
  }
  const sorted = [...buckets.entries()].sort();
  const now: Forecast = sorted[0]?.[1] ?? {};
  const series = sorted.slice(0, 8).map(([k, f]) => ({ ts: k, f }));
  return { now, series };
}

async function main() {
  const env = await loadEnv();
  const apiKey = env.KMA_API_KEY;
  const ws = path.join(PATHS.workspace);
  const stations: Station[] = JSON.parse(await fs.readFile(path.join(ws, "02_analytics/popular_stations.json"), "utf8"));

  // collect unique gu list from popular stations
  const guSet = new Set<string>();
  for (const s of stations) if (s.gu_en) guSet.add(s.gu_en);

  const out: Record<string, any> = {};
  const base = pickBaseTime(new Date());
  console.log(`base ${base.date}/${base.time}`);

  // 시드된 변동을 주는 약한 의사난수 (자치구별로 살짝 다른 모의 값을 만들기 위해)
  function mockFor(guEn: string): { temp_c: number; rain_prob: number; rain_mm: number; wind_ms: number; reh: number } {
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

  function applyMocked(reason: string) {
    console.warn(`⚠ KMA mocked (${reason})`);
    for (const guEn of guSet) {
      const grid = SEOUL_GRID[guEn];
      const f = mockFor(guEn);
      const s = rideScore(f);
      out[guEn] = {
        gu_ko: grid?.gu_ko ?? guEn,
        gu_en: guEn,
        issued_at: new Date().toISOString(),
        mocked: true,
        mock_reason: reason,
        now: { ...f, ride_score: s, label_en: rideLabel(s) },
        next_24h: [],
        warnings: [],
      };
    }
  }

  if (!apiKey) {
    applyMocked("KMA_API_KEY not set");
  } else {
    let okCount = 0;
    let lastErr = "";
    for (const guEn of guSet) {
      const grid = SEOUL_GRID[guEn];
      if (!grid) continue;
      try {
        const items = await fetchKma(apiKey, grid.nx, grid.ny, base);
        if (!items.length) throw new Error("empty items");
        const { now, series } = aggregate(items);
        const score = rideScore(now);
        out[guEn] = {
          gu_ko: grid.gu_ko,
          gu_en: guEn,
          issued_at: `${base.date.slice(0,4)}-${base.date.slice(4,6)}-${base.date.slice(6,8)}T${base.time.slice(0,2)}:00:00+09:00`,
          mocked: false,
          now: { ...now, ride_score: score, label_en: rideLabel(score) },
          next_24h: series.map((x) => ({ ...x.f, ts: x.ts, ride_score: rideScore(x.f) })),
          warnings: [],
        };
        okCount++;
        console.log(`  ${guEn}: ${score} (${rideLabel(score)})`);
      } catch (e: any) {
        lastErr = e.message;
      }
    }
    if (okCount === 0) {
      applyMocked(`all KMA requests failed (${lastErr}). 활용신청 필요: https://apihub.kma.go.kr → 단기예보 조회서비스 활용신청`);
    }
  }

  const outDir = path.join(PATHS.workspace, "04_weather");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "forecast_by_gu.json"), JSON.stringify(out, null, 2), "utf8");

  const summary = `# weather summary

- Districts queried: ${guSet.size}
- Districts with forecast: ${Object.keys(out).length}
- Base time: ${base.date}/${base.time} KST
- Mocked: ${Object.values(out).every((v: any) => v.mocked) ? "yes" : "no"}

## Sample
${Object.entries(out)
  .slice(0, 5)
  .map(([k, v]: any) => `- ${k} (${v.gu_ko}): ${v.now.temp_c ?? "?"}°C, rain ${v.now.rain_prob ?? "?"}%, wind ${v.now.wind_ms ?? "?"}m/s → score ${v.now.ride_score} (${v.now.label_en})`)
  .join("\n")}
`;
  await fs.writeFile(path.join(outDir, "summary.md"), summary, "utf8");
  console.log(summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
