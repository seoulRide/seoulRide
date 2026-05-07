import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PopularStations,
  EventsByStation,
  FoodByStation,
  WeatherByGu,
  TrendingByStation,
  type PopularStation,
  type StationMasterEntry,
  type TrendingByStation as TrendingByStationType,
} from "./types";

const WS = path.resolve(process.cwd(), "../../_workspace");

async function readJson<T>(rel: string, parser: { parse: (x: unknown) => T }): Promise<T> {
  const txt = await fs.readFile(path.join(WS, rel), "utf8");
  return parser.parse(JSON.parse(txt));
}

export async function getPopularStations(): Promise<PopularStation[]> {
  return readJson("02_analytics/popular_stations.json", PopularStations);
}

export async function getEventsByStation() {
  return readJson("03_curation/events_by_station.json", EventsByStation);
}

export async function getFoodByStation() {
  return readJson("03_curation/food_by_station.json", FoodByStation);
}

export async function getWeatherByGu() {
  return readJson("04_weather/forecast_by_gu.json", WeatherByGu);
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
