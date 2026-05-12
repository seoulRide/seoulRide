import { promises as fs } from "node:fs";
import path from "node:path";
import { loadEnv, PATHS, readWorkspaceText } from "../lib/env.ts";
import { makeServiceClient } from "../lib/supabase.ts";

interface PopularStationRow {
  station_no: string;
  station_name_ko: string;
  station_name_en: string | null;
  lat: number;
  lng: number;
  gu_ko: string;
  gu_en: string | null;
  address: string;
  rent_total: number;
  rank_overall: number;
  rank_in_gu: number;
  hotspot_z: number;
  is_outlier: boolean;
  monthly_series: Array<{ ym: string; cnt: number }>;
}

async function main() {
  const env = await loadEnv();
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }

  const txt = await readWorkspaceText("02_analytics/popular_stations.json");
  const stations = JSON.parse(txt) as PopularStationRow[];
  console.log(`source: ${stations.length} stations`);

  const now = new Date().toISOString();
  const rows = stations.map((s) => ({
    station_no: s.station_no,
    station_name_ko: s.station_name_ko,
    station_name_en: s.station_name_en,
    lat: s.lat,
    lng: s.lng,
    gu_ko: s.gu_ko,
    gu_en: s.gu_en,
    address: s.address ?? "",
    rent_total: s.rent_total,
    rank_overall: s.rank_overall,
    rank_in_gu: s.rank_in_gu,
    hotspot_z: s.hotspot_z,
    is_outlier: s.is_outlier,
    monthly_series: s.monthly_series,
    updated_at: now,
  }));

  const sb = makeServiceClient();
  const { error, count } = await sb
    .from("popular_stations")
    .upsert(rows, { onConflict: "station_no", count: "exact" });
  if (error) throw error;
  console.log(`upserted ${count ?? rows.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
