import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { unstable_cache } from "next/cache";
import {
  PopularStations,
  EventsByStation,
  TrendingByStation,
  type PopularStation,
  type StationMasterEntry,
  type TrendingByStation as TrendingByStationType,
  type EventsByStation as EventsByStationType,
  type WeatherByGu,
} from "./types";
import { getCachedWeatherByGu } from "./weather";
import { getSupabase, hasSupabase } from "./supabase";

const WS = path.resolve(process.cwd(), "../../_workspace");
const MOBILE_ASSETS = path.resolve(process.cwd(), "../mobile/assets/data");

// When the pipeline output under _workspace/ is missing (fresh clone, CI),
// fall back to the committed copy under apps/mobile/assets/data/. Keys here
// are workspace-relative paths; values are mobile asset filenames.
const MOBILE_FALLBACK: Record<string, string> = {
  "02_analytics/popular_stations.json": "popular_stations.json",
  "03_curation/events_by_station.json": "events_by_station.json",
  "04_weather/forecast_by_gu.json": "forecast_by_gu.json",
};

async function readJson<T>(rel: string, parser: { parse: (x: unknown) => T }): Promise<T> {
  let txt: string;
  try {
    txt = await fs.readFile(path.join(WS, rel), "utf8");
  } catch (e) {
    const fallback = MOBILE_FALLBACK[rel];
    if (!fallback) throw e;
    txt = await fs.readFile(path.join(MOBILE_ASSETS, fallback), "utf8");
  }
  return parser.parse(JSON.parse(txt));
}

/** Read a committed mobile-assets JSON; used as a build-time fallback when
 *  pipeline outputs aren't checked in. */
async function readMobileJson<T = unknown>(filename: string): Promise<T> {
  const txt = await fs.readFile(path.join(MOBILE_ASSETS, filename), "utf8");
  return JSON.parse(txt) as T;
}

const getPopularStationsFromSupabase = unstable_cache(
  async (): Promise<PopularStation[]> => {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("popular_stations")
      .select(
        "station_no, station_name_ko, station_name_en, lat, lng, gu_ko, gu_en, address, rent_total, rank_overall, rank_in_gu, hotspot_z, is_outlier, monthly_series",
      )
      .order("rank_overall", { ascending: true });
    if (error) throw error;
    return PopularStations.parse(data);
  },
  ["popular-stations-v1"],
  { revalidate: 3600, tags: ["popular-stations"] },
);

export async function getPopularStations(): Promise<PopularStation[]> {
  if (hasSupabase()) return getPopularStationsFromSupabase();
  // Local dev fallback when Supabase is not configured.
  return readJson("02_analytics/popular_stations.json", PopularStations);
}

// Module-level cache so /events doesn't re-read the 559 KB JSON + re-run
// zod validation on every searchParams change (lang/status/price toggle).
let _eventsByStation: EventsByStationType | null = null;
export async function getEventsByStation(): Promise<EventsByStationType> {
  if (_eventsByStation) return _eventsByStation;
  _eventsByStation = await readJson("03_curation/events_by_station.json", EventsByStation);
  return _eventsByStation;
}

export async function getWeatherByGu(): Promise<WeatherByGu> {
  const popular = await getPopularStations();
  const guSet = new Set<string>();
  for (const s of popular) if (s.gu_en) guSet.add(s.gu_en);
  const guList = [...guSet].sort();
  return getCachedWeatherByGu(guList);
}

/**
 * Returns the daily-refreshed trending list. Tries the canonical
 * `trending.json` first; falls back to `trending.sample.json` so the UI
 * still renders during Phase 1 before the live pipeline is wired up.
 */
export async function getTrending(): Promise<TrendingByStationType> {
  try {
    return await readJson("05_trending/trending.json", TrendingByStation);
  } catch {
    return readJson("05_trending/trending.sample.json", TrendingByStation);
  }
}

export async function getStationById(id: string): Promise<PopularStation | null> {
  const all = await getPopularStations();
  return all.find((s) => s.station_no === id) ?? null;
}

let _stationMaster: StationMasterEntry[] | null = null;
export async function getStationMaster(): Promise<StationMasterEntry[]> {
  if (_stationMaster) return _stationMaster;
  const txt = await fs.readFile(path.join(WS, "01_ingest/station_master.normalized.json"), "utf8");
  _stationMaster = JSON.parse(txt) as StationMasterEntry[];
  return _stationMaster;
}

/** Lean station list for client maps — only id/name/lat/lng. ~3,335 entries.
 *  Reads the committed lite snapshot from apps/mobile/assets/data so it's
 *  available in CI/Vercel builds without the pipeline output. */
export interface StationLite {
  station_no: string;
  name: string;
  lat: number;
  lng: number;
}
let _stationLite: StationLite[] | null = null;
export async function getAllStationsLite(): Promise<StationLite[]> {
  if (_stationLite) return _stationLite;
  _stationLite = await readMobileJson<StationLite[]>("station_master.lite.json");
  return _stationLite;
}
