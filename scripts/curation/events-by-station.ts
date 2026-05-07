import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS } from "../lib/env.ts";
import { radiusForGu, toGuEn } from "../lib/gu-mapping.ts";

interface Station {
  station_no: string;
  station_name_ko: string;
  lat: number;
  lng: number;
  gu_ko: string;
  gu_en: string | null;
  rent_total: number;
}

type Category = "concert" | "exhibition" | "festival" | "performance" | "experience";
const CATEGORY_MAP: { test: RegExp; cat: Category }[] = [
  { test: /콘서트|음악|뮤직|라이브|국악/, cat: "concert" },
  { test: /전시|미술|갤러리|아트|exhibition|전시·미술/i, cat: "exhibition" },
  { test: /축제|페스티벌|festival/i, cat: "festival" },
  { test: /체험|교육|workshop|class/i, cat: "experience" },
  { test: /뮤지컬|오페라|연극|공연|performance|theater/i, cat: "performance" },
];
function categorize(text: string): Category {
  const t = (text ?? "").toLowerCase();
  for (const { test, cat } of CATEGORY_MAP) if (test.test(t)) return cat;
  return "performance";
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface Event {
  source: string;
  title: string;
  place: string;
  gu_ko: string;
  start: string;
  end: string;
  lat: number | null;
  lng: number | null;
  url: string;
  is_free: string;
  category: Category;
  fee: string;
  img: string;
  org_name?: string;
  is_english?: boolean;
}

async function readJson(file: string): Promise<any[]> {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function main() {
  const ws = path.join(PATHS.workspace);
  const stations: Station[] = await readJson(path.join(ws, "02_analytics/popular_stations.json"));

  const cei: any[] = await readJson(path.join(ws, "01_ingest/culturalEventInfo.normalized.json"));
  const lprc: any[] = await readJson(path.join(ws, "01_ingest/ListPublicReservationCulture.normalized.json"));
  const lpre: any[] = await readJson(path.join(ws, "01_ingest/ListPublicReservationEnglish.normalized.json"));
  const sjw: any[] = await readJson(path.join(ws, "01_ingest/SJWPerform.normalized.json"));

  const events: Event[] = [];
  // culturalEventInfo
  for (const r of cei) {
    if (!r.lat || !r.lng) continue;
    if (Math.abs(r.lat) < 30 || Math.abs(r.lng) < 100) continue;
    events.push({
      source: "culturalEventInfo",
      title: r.title,
      place: r.place,
      gu_ko: r.gu_ko || "",
      start: r.start_date,
      end: r.end_date,
      lat: r.lat,
      lng: r.lng,
      url: r.org_link || "",
      is_free: r.is_free || "",
      category: categorize(r.codename + " " + r.title),
      fee: r.use_fee || "",
      img: r.main_img || "",
      org_name: r.org_name,
    });
  }
  // ListPublicReservationCulture
  for (const r of lprc) {
    if (!r.lat || !r.lng) continue;
    if (Math.abs(r.lat) < 30 || Math.abs(r.lng) < 100) continue;
    events.push({
      source: "ListPublicReservationCulture",
      title: r.title,
      place: r.place,
      gu_ko: r.gu_ko || "",
      start: r.start_date,
      end: r.end_date,
      lat: r.lat,
      lng: r.lng,
      url: r.url || "",
      is_free: r.is_free || "",
      category: categorize(r.max_class + " " + r.min_class + " " + r.title),
      fee: r.is_free || "",
      img: "",
    });
  }
  // English reservations — merge separately for matching
  const englishEvents: any[] = lpre
    .filter((r) => r.lat && r.lng && Math.abs(r.lat) > 30)
    .map((r) => ({
      title_en: r.title,
      place_en: r.place,
      gu_en: toGuEn(r.gu_ko) ?? r.gu_ko,
      start: r.start_date,
      end: r.end_date,
      lat: r.lat,
      lng: r.lng,
      url: r.url,
    }));
  // SJWPerform — fixed venue; only include if recent/upcoming
  for (const r of sjw) {
    if (!r.start_date) continue;
    events.push({
      source: "SJWPerform",
      title: r.title,
      place: "세종문화회관",
      gu_ko: "종로구",
      start: r.start_date,
      end: r.end_date,
      lat: 37.5725,
      lng: 126.9760,
      url: r.url || "",
      is_free: "",
      category: categorize(r.genre + " " + r.title),
      fee: "",
      img: r.img || "",
    });
  }

  // Dedupe
  const dedupeKey = (e: Event) =>
    `${e.title.toLowerCase().trim()}|${e.place.toLowerCase().trim()}|${(e.start || "").slice(0, 10)}`;
  const dedupeMap = new Map<string, { event: Event; sources: Set<string> }>();
  for (const e of events) {
    const k = dedupeKey(e);
    const exist = dedupeMap.get(k);
    if (exist) {
      exist.sources.add(e.source);
      // prefer entry with non-empty fields
      if (!exist.event.url && e.url) exist.event.url = e.url;
      if (!exist.event.img && e.img) exist.event.img = e.img;
    } else {
      dedupeMap.set(k, { event: e, sources: new Set([e.source]) });
    }
  }

  // Match against english dataset (by start date + place proximity)
  function matchEnglish(e: Event): { en?: any; matched: boolean } {
    if (!e.lat || !e.lng) return { matched: false };
    for (const en of englishEvents) {
      if (!en.start || !e.start) continue;
      if (en.start.slice(0, 10) !== e.start.slice(0, 10)) continue;
      const d = haversineKm(e as any, en);
      if (d < 0.05) return { en, matched: true };
    }
    return { matched: false };
  }

  // Filter date window: include if end >= today OR (today is between start and end)
  // OR if start is in future. Many datasets have past events; we keep ±90 days for richness.
  const today = new Date();
  const cutoffPast = new Date(today);
  cutoffPast.setDate(cutoffPast.getDate() - 30);
  const cutoffFuture = new Date(today);
  cutoffFuture.setDate(cutoffFuture.getDate() + 90);

  function inWindow(e: Event): boolean {
    if (!e.start) return false;
    const st = new Date(e.start);
    if (isNaN(st.getTime())) return false;
    const en = e.end ? new Date(e.end) : st;
    if (isNaN(en.getTime())) return false;
    // overlap with [cutoffPast, cutoffFuture]
    return en >= cutoffPast && st <= cutoffFuture;
  }

  // Build by-station mapping
  const byStation: Record<string, any[]> = {};
  let stationsWithZero = 0;
  for (const station of stations) {
    const radius = radiusForGu(station.gu_en);
    const matches: any[] = [];
    for (const [k, v] of dedupeMap) {
      const e = v.event;
      if (!e.lat || !e.lng) continue;
      if (!inWindow(e)) continue;
      const dist = haversineKm({ lat: station.lat, lng: station.lng }, { lat: e.lat, lng: e.lng });
      if (dist > radius) continue;
      const enMatch = matchEnglish(e);
      const fee = e.is_free === "무료" || /free/i.test(e.is_free) ? "Free" : (e.fee || (e.is_free ? `Paid (${e.is_free})` : "Paid"));
      matches.push({
        id: k,
        title_ko: e.title,
        title_en: enMatch.en?.title_en ?? e.title,
        venue_ko: e.place,
        venue_en: enMatch.en?.place_en ?? e.place,
        category: e.category,
        lat: e.lat,
        lng: e.lng,
        distance_km: +dist.toFixed(2),
        start: e.start,
        end: e.end,
        price: fee,
        url: e.url,
        img: e.img,
        sources: [...v.sources],
        en_fallback: enMatch.matched ? "matched_dataset" : "ko_original",
      });
    }
    matches.sort((a, b) => a.distance_km - b.distance_km);
    byStation[station.station_no] = matches.slice(0, 30);
    if (matches.length === 0) stationsWithZero++;
  }

  const outDir = path.join(PATHS.workspace, "03_curation");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "events_by_station.json"), JSON.stringify(byStation, null, 2), "utf8");

  // Summary
  const allIds = new Set<string>();
  let totalMatches = 0;
  let englishMatched = 0;
  for (const arr of Object.values(byStation)) {
    for (const e of arr) {
      allIds.add(e.id);
      totalMatches++;
      if (e.en_fallback === "matched_dataset") englishMatched++;
    }
  }
  const summary = `# events curation summary

- Total events read: ${events.length}
- Deduped events: ${dedupeMap.size}
- English dataset events: ${englishEvents.length}
- Stations: ${stations.length}, with 0 events nearby: ${stationsWithZero}
- Total event matches across stations: ${totalMatches}
- Distinct events surfaced: ${allIds.size}
- English-matched (dataset): ${englishMatched}/${totalMatches} (${((englishMatched / Math.max(1, totalMatches)) * 100).toFixed(1)}%)
- Window: ${cutoffPast.toISOString().slice(0, 10)} ~ ${cutoffFuture.toISOString().slice(0, 10)}

## First 3 stations preview
${stations
  .slice(0, 3)
  .map((s) => {
    const arr = byStation[s.station_no];
    return `- **${s.station_name_ko}** (${s.gu_ko}): ${arr.length} events\n${arr
      .slice(0, 3)
      .map((e) => `  - ${e.title_ko} @ ${e.venue_ko} — ${e.distance_km}km — ${e.start.slice(0, 10)}`)
      .join("\n")}`;
  })
  .join("\n")}
`;
  await fs.writeFile(path.join(outDir, "events_summary.md"), summary, "utf8");
  console.log(summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
