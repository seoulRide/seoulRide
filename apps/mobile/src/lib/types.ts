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

export type FoodCategory = {
  category: string;
  label_ko: string;
  label_en: string;
  blurb_en: string;
};
export type FoodEntry = {
  gu_ko: string;
  gu_en: string | null;
  activity_score: number;
  top_categories: FoodCategory[];
  data_source: string;
};

export type WeatherForecast = {
  gu_ko: string;
  gu_en: string;
  issued_at: string;
  mocked: boolean;
  mock_reason?: string;
  now: {
    temp_c?: number;
    rain_prob?: number;
    rain_mm?: number;
    wind_ms?: number;
    reh?: number;
    ride_score: number;
    label_en: string;
  };
  next_24h: any[];
  warnings: any[];
};
