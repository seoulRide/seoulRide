import { z } from "zod";

export const PopularStation = z.object({
  station_no: z.string(),
  station_name_ko: z.string(),
  station_name_en: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  gu_ko: z.string(),
  gu_en: z.string().nullable(),
  address: z.string(),
  rent_total: z.number(),
  rank_overall: z.number(),
  rank_in_gu: z.number(),
  hotspot_z: z.number(),
  is_outlier: z.boolean(),
  monthly_series: z.array(z.object({ ym: z.string(), cnt: z.number() })),
});
export type PopularStation = z.infer<typeof PopularStation>;
export const PopularStations = z.array(PopularStation);

export const EventEntry = z.object({
  id: z.string(),
  title_ko: z.string(),
  title_en: z.string(),
  venue_ko: z.string(),
  venue_en: z.string(),
  category: z.enum(["concert", "exhibition", "festival", "performance", "experience"]),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  distance_km: z.number(),
  start: z.string(),
  end: z.string(),
  price: z.string(),
  url: z.string(),
  img: z.string().optional().default(""),
  sources: z.array(z.string()),
  en_fallback: z.enum(["matched_dataset", "ko_original"]),
});
export type EventEntry = z.infer<typeof EventEntry>;
export const EventsByStation = z.record(z.string(), z.array(EventEntry));
export type EventsByStation = z.infer<typeof EventsByStation>;

export const FoodCategory = z.object({
  category: z.string(),
  label_ko: z.string(),
  label_en: z.string(),
  blurb_en: z.string(),
});
export const FoodEntry = z.object({
  gu_ko: z.string(),
  gu_en: z.string().nullable(),
  activity_score: z.number(),
  top_categories: z.array(FoodCategory),
  data_source: z.string(),
});
export type FoodEntry = z.infer<typeof FoodEntry>;
export const FoodByStation = z.record(z.string(), FoodEntry);
export type FoodByStation = z.infer<typeof FoodByStation>;

export const WeatherForecast = z.object({
  gu_ko: z.string(),
  gu_en: z.string(),
  issued_at: z.string(),
  mocked: z.boolean(),
  mock_reason: z.string().optional(),
  now: z.object({
    temp_c: z.number().optional(),
    rain_prob: z.number().optional(),
    rain_mm: z.number().optional(),
    wind_ms: z.number().optional(),
    reh: z.number().optional(),
    ride_score: z.number(),
    label_en: z.string(),
  }),
  next_24h: z.array(z.any()),
  warnings: z.array(z.any()),
});
export type WeatherForecast = z.infer<typeof WeatherForecast>;
export const WeatherByGu = z.record(z.string(), WeatherForecast);
export type WeatherByGu = z.infer<typeof WeatherByGu>;

export interface StationMasterEntry {
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

export const TrendingSource = z.enum([
  "reddit_seoul",
  "reddit_korea",
  "visit_seoul",
  "naver_news",
  "timeout_seoul",
]);
export type TrendingSource = z.infer<typeof TrendingSource>;

export const TrendingEntry = z.object({
  station_no: z.string(),
  station_name_ko: z.string(),
  gu_ko: z.string(),
  gu_en: z.string().nullable(),
  /** Mention count over the trailing 7-day window. */
  mention_count: z.number(),
  /** Sentiment-weighted score; -1..1, higher = more positive buzz. */
  sentiment_avg: z.number(),
  summary_ko: z.string(),
  summary_en: z.string(),
  /** Event ids (from EventEntry) within ~7 days near this station. */
  related_event_ids: z.array(z.string()),
  sources: z.array(z.object({
    url: z.string(),
    title: z.string(),
    snippet: z.string(),
    source: TrendingSource,
  })),
  /** ISO 8601 — when the synthesizer wrote this entry. */
  updated_at: z.string(),
});
export type TrendingEntry = z.infer<typeof TrendingEntry>;
export const TrendingByStation = z.array(TrendingEntry);
export type TrendingByStation = z.infer<typeof TrendingByStation>;

