/**
 * Aggregate extracted place mentions into per-station rollups.
 *
 * Input:  _workspace/05_trending/extracted/mentions.json
 *         _workspace/02_analytics/popular_stations.json (50 stations)
 *         _workspace/03_curation/events_by_station.json
 * Output: _workspace/05_trending/aggregated.json
 *
 *   pnpm trending:aggregate
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS, readWorkspaceText } from "../lib/env.ts";
import type { RawSource } from "./types.ts";

interface PlaceMention {
  place_ko: string;
  place_en: string;
  gu_ko: string;
  gu_en: string;
  category: string;
  sentiment: "positive" | "neutral" | "negative";
  tourist_relevant: boolean;
  evidence_snippet: string;
}
interface ExtractedRow {
  article_id: string;
  source: RawSource;
  url: string;
  title: string;
  published_at: string;
  mentions: PlaceMention[];
}
interface PopularStation {
  station_no: string;
  station_name_ko: string;
  station_name_en: string | null;
  lat: number;
  lng: number;
  gu_ko: string;
  gu_en: string | null;
  rank_overall: number;
}
interface EventEntry {
  id: string;
  start: string;
  end: string;
  title_ko: string;
  title_en: string;
  lat: number | null;
  lng: number | null;
  distance_km: number;
}

interface AggregatedEntry {
  station_no: string;
  station_name_ko: string;
  gu_ko: string;
  gu_en: string | null;
  mention_count: number;
  sentiment_avg: number;
  evidence_articles: Array<{
    article_id: string;
    source: RawSource;
    url: string;
    title: string;
    snippet: string;
    place_ko: string;
    sentiment: "positive" | "neutral" | "negative";
  }>;
  related_event_ids: string[];
}

// Best-effort dong → gu fallback for cases where the LLM returned an empty gu_ko.
const DONG_TO_GU: Record<string, string> = {
  성수동: "성동구",
  성수: "성동구",
  서울숲: "성동구",
  연남동: "마포구",
  연남: "마포구",
  망원동: "마포구",
  합정동: "마포구",
  상수동: "마포구",
  홍대: "마포구",
  HBC: "용산구",
  해방촌: "용산구",
  한남동: "용산구",
  한남: "용산구",
  이태원: "용산구",
  익선동: "종로구",
  북촌: "종로구",
  서촌: "종로구",
  종로: "종로구",
  광화문: "종로구",
  을지로: "중구",
  명동: "중구",
  강남역: "강남구",
  강남: "강남구",
  청담: "강남구",
  압구정: "강남구",
  잠실: "송파구",
  여의도: "영등포구",
  목동: "양천구",
  성북동: "성북구",
};

function inferGu(m: PlaceMention): string {
  if (m.gu_ko) return m.gu_ko;
  // Try place_ko as-is, then strip "동"/"역"/"구" tail
  const candidates = [m.place_ko, m.place_ko.replace(/[동역구]$/, ""), m.place_en];
  for (const k of candidates) {
    if (k && DONG_TO_GU[k]) return DONG_TO_GU[k];
  }
  return "";
}

function sentimentScore(s: "positive" | "neutral" | "negative"): number {
  if (s === "positive") return 1;
  if (s === "negative") return -1;
  return 0;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pickAnchorStation(stations: PopularStation[], gu_ko: string): PopularStation | null {
  const inGu = stations.filter((s) => s.gu_ko === gu_ko);
  if (inGu.length === 0) return null;
  return inGu.sort((a, b) => a.rank_overall - b.rank_overall)[0];
}

function eventsNearStation(
  station: PopularStation,
  events: EventEntry[],
  windowDays: number,
  radiusKm: number,
): string[] {
  const now = Date.now();
  const cutoffEnd = new Date(now + windowDays * 24 * 3600 * 1000).getTime();
  return events
    .filter((e) => e.lat != null && e.lng != null)
    .filter((e) => {
      const startMs = Date.parse(e.start);
      const endMs = Date.parse(e.end || e.start);
      return endMs >= now && startMs <= cutoffEnd;
    })
    .filter((e) => haversineKm({ lat: station.lat, lng: station.lng }, { lat: e.lat as number, lng: e.lng as number }) <= radiusKm)
    .map((e) => e.id)
    .slice(0, 5);
}

async function main() {
  const wsDir = PATHS.workspace;
  const [mentionsTxt, stationsTxt, eventsTxt] = await Promise.all([
    fs.readFile(path.join(wsDir, "05_trending", "extracted", "mentions.json"), "utf8"),
    readWorkspaceText("02_analytics/popular_stations.json"),
    readWorkspaceText("03_curation/events_by_station.json"),
  ]);
  const rows = JSON.parse(mentionsTxt) as ExtractedRow[];
  const stations = JSON.parse(stationsTxt) as PopularStation[];
  const eventsByStation = JSON.parse(eventsTxt) as Record<string, EventEntry[]>;
  // Flatten + dedupe events by id (closest-station occurrence wins)
  const eventMap = new Map<string, EventEntry>();
  for (const list of Object.values(eventsByStation)) {
    for (const e of list) {
      const prev = eventMap.get(e.id);
      if (!prev || e.distance_km < prev.distance_km) eventMap.set(e.id, e);
    }
  }
  const events = [...eventMap.values()];

  console.log(`Articles: ${rows.length} · Stations: ${stations.length} · Events: ${events.length}`);

  // Bucket mentions by station_no via gu match.
  type Bucket = {
    station: PopularStation;
    sentimentSum: number;
    items: AggregatedEntry["evidence_articles"];
  };
  const buckets = new Map<string, Bucket>();

  let dropped = 0;
  for (const row of rows) {
    for (const m of row.mentions) {
      if (!m.tourist_relevant) {
        dropped++;
        continue;
      }
      const gu = inferGu(m);
      if (!gu) {
        dropped++;
        continue;
      }
      const station = pickAnchorStation(stations, gu);
      if (!station) {
        dropped++;
        continue;
      }
      let bucket = buckets.get(station.station_no);
      if (!bucket) {
        bucket = { station, sentimentSum: 0, items: [] };
        buckets.set(station.station_no, bucket);
      }
      bucket.sentimentSum += sentimentScore(m.sentiment);
      bucket.items.push({
        article_id: row.article_id,
        source: row.source,
        url: row.url,
        title: row.title,
        snippet: m.evidence_snippet,
        place_ko: m.place_ko,
        sentiment: m.sentiment,
      });
    }
  }

  const aggregated: AggregatedEntry[] = [];
  for (const [station_no, b] of buckets) {
    const mention_count = b.items.length;
    const sentiment_avg = mention_count > 0 ? b.sentimentSum / mention_count : 0;
    const related_event_ids = eventsNearStation(b.station, events, 7, 1.5);
    aggregated.push({
      station_no,
      station_name_ko: b.station.station_name_ko,
      gu_ko: b.station.gu_ko,
      gu_en: b.station.gu_en,
      mention_count,
      sentiment_avg,
      evidence_articles: b.items.slice(0, 8), // cap evidence per station
      related_event_ids,
    });
  }
  // Rank by mention_count × (sentiment_avg + 1.2) so neutral stays useful; very negative deprioritizes
  aggregated.sort((a, b) => b.mention_count * (b.sentiment_avg + 1.2) - a.mention_count * (a.sentiment_avg + 1.2));

  const outFile = path.join(wsDir, "05_trending", "aggregated.json");
  await fs.writeFile(outFile, JSON.stringify(aggregated, null, 2), "utf8");
  console.log(
    `\n✓ ${aggregated.length} stations bucketed (dropped ${dropped} mentions: not tourist-relevant / no gu / no station) → ${outFile}`,
  );
  for (const a of aggregated.slice(0, 5)) {
    console.log(`  · ${a.station_name_ko} (${a.gu_ko}) — ${a.mention_count} mentions · sentiment ${a.sentiment_avg.toFixed(2)} · ${a.related_event_ids.length} events`);
  }
}

main().catch((e) => {
  console.error("✗ aggregate failed:", e);
  process.exit(1);
});
