import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS } from "../lib/env.ts";

interface Issue { sev: "critical" | "major" | "minor"; what: string; owner?: string }
const issues: Issue[] = [];
const facts: string[] = [];

const inSeoul = (lat: number, lng: number) =>
  lat >= 37.4 && lat <= 37.7 && lng >= 126.7 && lng <= 127.2;

async function main() {
  const ws = path.join(PATHS.workspace);

  // popular_stations
  const stations: any[] = JSON.parse(await fs.readFile(path.join(ws, "02_analytics/popular_stations.json"), "utf8"));
  facts.push(`stations.length = ${stations.length}`);
  const outOfSeoul = stations.filter((s) => !inSeoul(s.lat, s.lng));
  if (outOfSeoul.length / stations.length > 0.01)
    issues.push({ sev: "critical", what: `${outOfSeoul.length} stations out of Seoul bbox`, owner: "bike-analytics-agent" });
  const noGu = stations.filter((s) => !s.gu_en);
  if (noGu.length / stations.length > 0.05)
    issues.push({ sev: "major", what: `${noGu.length}/${stations.length} stations missing gu_en`, owner: "data-ingestion-agent" });
  facts.push(`stations missing gu_en: ${noGu.length}`);
  const negativeRent = stations.filter((s) => s.rent_total < 0);
  if (negativeRent.length) issues.push({ sev: "major", what: `${negativeRent.length} stations with negative rent`, owner: "bike-analytics-agent" });

  // events_by_station
  const events: Record<string, any[]> = JSON.parse(await fs.readFile(path.join(ws, "03_curation/events_by_station.json"), "utf8"));
  let totalEvt = 0, oobEvt = 0, distViolations = 0, missingTitle = 0;
  for (const sid in events) {
    const station = stations.find((s) => s.station_no === sid);
    if (!station) continue;
    const radius = ["Jongno-gu","Jung-gu","Mapo-gu","Yongsan-gu","Gangnam-gu","Seocho-gu"].includes(station.gu_en) ? 0.7
                 : ["Gangseo-gu","Dobong-gu","Nowon-gu","Eunpyeong-gu","Jungnang-gu"].includes(station.gu_en) ? 1.5 : 1.0;
    for (const e of events[sid]) {
      totalEvt++;
      if (!inSeoul(e.lat, e.lng)) oobEvt++;
      if (e.distance_km > radius + 0.05) distViolations++;
      if (!e.title_ko) missingTitle++;
    }
  }
  facts.push(`event matches total = ${totalEvt}`);
  if (totalEvt && oobEvt / totalEvt > 0.01) issues.push({ sev: "critical", what: `${oobEvt} events outside Seoul bbox`, owner: "cultural-events-agent" });
  if (distViolations) issues.push({ sev: "major", what: `${distViolations} events exceeded gu radius`, owner: "cultural-events-agent" });
  if (missingTitle) issues.push({ sev: "major", what: `${missingTitle} events missing title_ko`, owner: "cultural-events-agent" });

  // weather
  const weather: Record<string, any> = JSON.parse(await fs.readFile(path.join(ws, "04_weather/forecast_by_gu.json"), "utf8"));
  facts.push(`weather.districts = ${Object.keys(weather).length}`);
  const mocked = Object.values(weather).filter((v: any) => v.mocked).length;
  if (mocked === Object.keys(weather).length) {
    issues.push({ sev: "minor", what: `all weather is mocked: ${(Object.values(weather)[0] as any)?.mock_reason ?? "unknown"}`, owner: "weather-agent" });
  }
  const badScore = Object.values(weather).filter((v: any) => v.now.ride_score < 0 || v.now.ride_score > 100);
  if (badScore.length) issues.push({ sev: "critical", what: `${badScore.length} districts have ride_score out of [0,100]`, owner: "weather-agent" });

  // cross-coverage: every popular station should appear in events_by_station
  const missingEvents = stations.filter((s) => !(s.station_no in events));
  if (missingEvents.length) issues.push({ sev: "major", what: `${missingEvents.length} stations missing in events_by_station` });

  // Build report
  const crit = issues.filter((i) => i.sev === "critical").length;
  const maj = issues.filter((i) => i.sev === "major").length;
  const min = issues.filter((i) => i.sev === "minor").length;
  const score = Math.max(0, 100 - crit * 30 - maj * 10 - min * 3);
  const status = crit > 0 ? "FAIL (critical)" : maj > 0 ? "PASS with warnings" : "PASS";

  const report = `# QA Report — Phase 03 curation

**Health Score:** ${score}/100
**Status:** ${status}

## Facts
${facts.map((f) => `- ${f}`).join("\n")}

## Critical (${crit})
${issues.filter((i) => i.sev === "critical").map((i) => `- ${i.what}${i.owner ? ` _(owner: ${i.owner})_` : ""}`).join("\n") || "(none)"}

## Major (${maj})
${issues.filter((i) => i.sev === "major").map((i) => `- ${i.what}${i.owner ? ` _(owner: ${i.owner})_` : ""}`).join("\n") || "(none)"}

## Minor (${min})
${issues.filter((i) => i.sev === "minor").map((i) => `- ${i.what}${i.owner ? ` _(owner: ${i.owner})_` : ""}`).join("\n") || "(none)"}
`;
  const out = path.join(ws, "qa", "03_curation_report.md");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, report, "utf8");
  console.log(report);

  if (crit > 0) {
    console.error("Critical issues found. Aborting.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
