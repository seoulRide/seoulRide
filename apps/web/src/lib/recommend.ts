import type { EventEntry, EventsByStation, PopularStation } from "./types";
import { getEventStatus } from "./event-status";

export interface RecommendedEvent extends EventEntry {
  /** Station near which this event was anchored. */
  anchor_station_no: string;
  anchor_station_name_ko: string;
  anchor_gu_ko: string;
  anchor_gu_en: string | null;
  anchor_rent_total: number;
  /** Distance from the anchor station to the event venue (km). */
  anchor_distance_km: number;
  /** Composite recommendation score. */
  score: number;
}

export interface RecommendOptions {
  /** Max events per anchor station (diversity guard). */
  perStationCap?: number;
  /** How many to return overall. */
  total?: number;
  now?: Date;
}

/**
 * Score events by "how often foreigners ride here × how close it is".
 *
 *   score = station.rent_total / (event.distance_km + 0.2)
 *
 * Past events are excluded; ongoing events tie-break above upcoming.
 * Multiple stations can anchor the same event — the highest-scoring
 * station wins. Then a diversity cap limits how many events any single
 * station contributes.
 */
export function recommendTopEvents(
  eventsByStation: EventsByStation,
  stations: PopularStation[],
  opts: RecommendOptions = {},
): RecommendedEvent[] {
  const perStationCap = opts.perStationCap ?? 3;
  const total = opts.total ?? 12;
  const now = opts.now ?? new Date();

  const stationByNo = new Map(stations.map((s) => [s.station_no, s]));

  // For each (event id), keep best (station, score) anchor
  const best = new Map<string, RecommendedEvent>();
  for (const stationNo in eventsByStation) {
    const station = stationByNo.get(stationNo);
    if (!station) continue; // event station not in popular list — skip
    for (const event of eventsByStation[stationNo]) {
      if (getEventStatus(event.start, event.end, now) === "past") continue;
      const score = station.rent_total / (event.distance_km + 0.2);
      const existing = best.get(event.id);
      if (!existing || score > existing.score) {
        best.set(event.id, {
          ...event,
          anchor_station_no: station.station_no,
          anchor_station_name_ko: station.station_name_ko,
          anchor_gu_ko: station.gu_ko,
          anchor_gu_en: station.gu_en,
          anchor_rent_total: station.rent_total,
          anchor_distance_km: event.distance_km,
          score,
        });
      }
    }
  }

  const ranked = [...best.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // tie-break: ongoing first, then earlier start
    const aS = getEventStatus(a.start, a.end, now);
    const bS = getEventStatus(b.start, b.end, now);
    if (aS !== bS) return aS === "ongoing" ? -1 : 1;
    return a.start.localeCompare(b.start);
  });

  // Diversity: cap per anchor station
  const out: RecommendedEvent[] = [];
  const usedByStation = new Map<string, number>();
  for (const ev of ranked) {
    const k = ev.anchor_station_no;
    const used = usedByStation.get(k) ?? 0;
    if (used >= perStationCap) continue;
    usedByStation.set(k, used + 1);
    out.push(ev);
    if (out.length >= total) break;
  }
  return out;
}
