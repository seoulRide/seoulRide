import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PopularStations,
  EventsByStation,
  FoodByStation,
  WeatherByGu,
  type PopularStation,
  type StationMasterEntry,
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
