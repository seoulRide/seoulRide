import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PopularStations,
  EventsByStation,
  TrendingByStation,
  type PopularStation,
  type StationMasterEntry,
  type TrendingByStation as TrendingByStationType,
  type WeatherByGu,
} from "./types";
import { getCachedWeatherByGu } from "./weather";

const WS = path.resolve(process.cwd(), "../../_workspace");
const MOBILE_ASSETS = path.resolve(process.cwd(), "../mobile/assets/data");

async function readJson<T>(rel: string, parser: { parse: (x: unknown) => T }): Promise<T> {
  const txt = await fs.readFile(path.join(WS, rel), "utf8");
  return parser.parse(JSON.parse(txt));
}

/** Read a committed mobile-assets JSON; used as a build-time fallback when
 *  pipeline outputs aren't checked in. */
async function readMobileJson<T = unknown>(filename: string): Promise<T> {
  const txt = await fs.readFile(path.join(MOBILE_ASSETS, filename), "utf8");
  return JSON.parse(txt) as T;
}

export async function getPopularStations(): Promise<PopularStation[]> {
  return readJson("02_analytics/popular_stations.json", PopularStations);
}

export async function getEventsByStation() {
  return readJson("03_curation/events_by_station.json", EventsByStation);
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
