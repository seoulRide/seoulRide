import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS } from "../lib/env.ts";

interface Station {
  station_no: string;
  station_no_norm: string;
  station_name_ko: string;
  station_name_en: string | null;
  lat: number;
  lng: number;
  gu_ko: string;
  gu_en: string | null;
  address: string;
}

interface BikeRow {
  ym?: string;
  date?: string;
  station_no: string;
  station_name: string;
  rent_cnt: number;
  rtn_cnt: number;
}

const TOP_N = 50;

function digitsOf(s: string): string {
  return (s ?? "").replace(/[^0-9]/g, "");
}

function extractIdFromName(name: string): string {
  // monthly often has "157. 애오개역 ..." → "157"
  const m = name?.match(/^(\d+)\b/);
  return m ? m[1] : "";
}

async function main() {
  const ws = path.join(PATHS.workspace, "01_ingest");
  const stations: Station[] = JSON.parse(await fs.readFile(path.join(ws, "station_master.normalized.json"), "utf8"));
  const monthly: BikeRow[] = JSON.parse(await fs.readFile(path.join(ws, "cycleForeignerRentMonthInfo.normalized.json"), "utf8"));
  const daily: BikeRow[]   = JSON.parse(await fs.readFile(path.join(ws, "cycleForeignerRentDayInfo.normalized.json"), "utf8"));

  // master index by digits-of(station_no_norm) — also by station_name fuzzy
  const byId = new Map<string, Station>();
  const byName = new Map<string, Station>();
  for (const s of stations) {
    if (s.station_no_norm) byId.set(s.station_no_norm, s);
    if (s.station_name_ko) byName.set(s.station_name_ko.trim(), s);
  }

  function lookup(row: BikeRow): Station | null {
    const idCandidates = [digitsOf(row.station_no), extractIdFromName(row.station_name)];
    for (const id of idCandidates) {
      if (id && byId.has(id)) return byId.get(id)!;
    }
    // fallback by name (strip leading "123. " prefix)
    const name = (row.station_name || "").replace(/^\d+\.\s*/, "").trim();
    if (byName.has(name)) return byName.get(name)!;
    return null;
  }

  // Aggregate monthly across all available months
  const totalsByStation = new Map<string, { station: Station; rent: number; ymSet: Set<string>; series: Map<string, number> }>();
  let unmatched = 0;
  let unmatchedExamples = new Map<string, number>();
  for (const row of monthly) {
    const station = lookup(row);
    if (!station) {
      unmatched++;
      const k = `${row.station_no}|${row.station_name}`;
      unmatchedExamples.set(k, (unmatchedExamples.get(k) ?? 0) + row.rent_cnt);
      continue;
    }
    const key = station.station_no;
    let entry = totalsByStation.get(key);
    if (!entry) {
      entry = { station, rent: 0, ymSet: new Set(), series: new Map() };
      totalsByStation.set(key, entry);
    }
    entry.rent += row.rent_cnt;
    if (row.ym) entry.ymSet.add(row.ym);
    if (row.ym) entry.series.set(row.ym, (entry.series.get(row.ym) ?? 0) + row.rent_cnt);
  }

  // Add daily as additional signal (already includes monthly periods sometimes)
  // We treat daily separately for time pattern; for total ranking, prefer monthly
  // (avoid double-counting). But for stations only present in daily, include.
  const dailyOnly = new Map<string, { station: Station; rent: number }>();
  for (const row of daily) {
    const station = lookup(row);
    if (!station) continue;
    if (totalsByStation.has(station.station_no)) continue;
    let e = dailyOnly.get(station.station_no);
    if (!e) { e = { station, rent: 0 }; dailyOnly.set(station.station_no, e); }
    e.rent += row.rent_cnt;
  }
  // Merge dailyOnly stations into totals (for stations that don't appear in monthly)
  for (const [k, v] of dailyOnly) {
    if (!totalsByStation.has(k)) {
      totalsByStation.set(k, { station: v.station, rent: v.rent, ymSet: new Set(), series: new Map() });
    }
  }

  // Build array
  const all = [...totalsByStation.values()].filter((e) => e.rent > 0);
  // Sort by rent total desc
  all.sort((a, b) => b.rent - a.rent);

  // Stats for hotspot z-score
  const totals = all.map((e) => e.rent);
  const mean = totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length);
  const variance = totals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, totals.length);
  const sd = Math.sqrt(variance);

  // IQR upper fence
  const sorted = [...totals].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const upperFence = q3 + 1.5 * (q3 - q1);

  const guRanks = new Map<string, number>();
  const ranked = all.map((e, idx) => {
    const rank_overall = idx + 1;
    const guKey = e.station.gu_en ?? e.station.gu_ko;
    const rank_in_gu = (guRanks.get(guKey) ?? 0) + 1;
    guRanks.set(guKey, rank_in_gu);
    const z = sd > 0 ? (e.rent - mean) / sd : 0;
    const series = [...e.series.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, cnt]) => ({ ym, cnt }));
    return {
      station_no: e.station.station_no,
      station_name_ko: e.station.station_name_ko,
      station_name_en: e.station.station_name_en,
      lat: e.station.lat,
      lng: e.station.lng,
      gu_ko: e.station.gu_ko,
      gu_en: e.station.gu_en,
      address: e.station.address,
      rent_total: e.rent,
      rank_overall,
      rank_in_gu,
      hotspot_z: +z.toFixed(3),
      is_outlier: e.rent > upperFence,
      monthly_series: series,
    };
  });

  const top = ranked.slice(0, TOP_N);
  const outDir = path.join(PATHS.workspace, "02_analytics");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "popular_stations.json"), JSON.stringify(top, null, 2), "utf8");

  // gu distribution
  const guAgg: Record<string, { gu_ko: string; gu_en: string | null; rent_total: number; stations: number }> = {};
  for (const r of ranked) {
    const k = r.gu_en ?? r.gu_ko ?? "unknown";
    if (!guAgg[k]) guAgg[k] = { gu_ko: r.gu_ko, gu_en: r.gu_en, rent_total: 0, stations: 0 };
    guAgg[k].rent_total += r.rent_total;
    guAgg[k].stations += 1;
  }
  const guList = Object.values(guAgg).sort((a, b) => b.rent_total - a.rent_total);
  await fs.writeFile(path.join(outDir, "gu_distribution.json"), JSON.stringify(guList, null, 2), "utf8");

  // Outliers — ranked above upper fence
  const outliers = ranked.filter((r) => r.is_outlier);
  await fs.writeFile(path.join(outDir, "outliers.json"), JSON.stringify(outliers, null, 2), "utf8");

  // Unmatched
  const unmatchedSorted = [...unmatchedExamples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
  await fs.writeFile(
    path.join(outDir, "unmatched_stations.json"),
    JSON.stringify({ count: unmatched, top_examples: unmatchedSorted }, null, 2),
    "utf8",
  );

  // Summary
  const summary = `# bike-analytics summary

- Stations matched: ${all.length} (with rent > 0)
- Top-${TOP_N} written to popular_stations.json
- Total rentals (monthly aggregate): ${totals.reduce((a, b) => a + b, 0).toLocaleString()}
- Mean: ${mean.toFixed(1)}, SD: ${sd.toFixed(1)}, Upper fence (IQR): ${upperFence.toFixed(1)}
- Outliers (above upper fence): ${outliers.length}
- Unmatched bike rows: ${unmatched}

## Top 5
${top.slice(0, 5).map((s, i) => `${i + 1}. **${s.station_name_ko}** (${s.gu_ko}) — ${s.rent_total} rentals`).join("\n")}

## Top 5 districts
${guList.slice(0, 5).map((g, i) => `${i + 1}. ${g.gu_en ?? g.gu_ko} — ${g.rent_total} rentals across ${g.stations} stations`).join("\n")}
`;
  await fs.writeFile(path.join(outDir, "summary.md"), summary, "utf8");
  console.log(summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
