import type {
  PopularStation,
  EventEntry,
  FoodEntry,
  WeatherForecast,
} from "./types";

import popularStationsRaw from "../../assets/data/popular_stations.json";
import eventsByStationRaw from "../../assets/data/events_by_station.json";
import foodByStationRaw from "../../assets/data/food_by_station.json";
import forecastByGuRaw from "../../assets/data/forecast_by_gu.json";

export const popularStations: PopularStation[] = popularStationsRaw as PopularStation[];
export const eventsByStation: Record<string, EventEntry[]> = eventsByStationRaw as Record<string, EventEntry[]>;
export const foodByStation: Record<string, FoodEntry> = foodByStationRaw as Record<string, FoodEntry>;
export const forecastByGu: Record<string, WeatherForecast> = forecastByGuRaw as Record<string, WeatherForecast>;

export function getStationById(id: string): PopularStation | null {
  return popularStations.find((s) => s.station_no === id) ?? null;
}

export function getEventsForStation(id: string): EventEntry[] {
  return eventsByStation[id] ?? [];
}

export function getFoodForStation(id: string): FoodEntry | null {
  return foodByStation[id] ?? null;
}

export function getWeatherForGu(guEn: string | null | undefined): WeatherForecast | null {
  if (!guEn) return null;
  return forecastByGu[guEn] ?? null;
}
