import { loadEnv, readWorkspaceText } from "../lib/env.ts";
import { makeServiceClient } from "../lib/supabase.ts";

interface EventEntry {
  id: string;
  title_ko: string;
  title_en: string;
  // ... 나머지는 jsonb로 그대로 통과
  [k: string]: unknown;
}

async function main() {
  const env = await loadEnv();
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }

  const txt = await readWorkspaceText("03_curation/events_by_station.json");
  const byStation = JSON.parse(txt) as Record<string, EventEntry[]>;
  const stationIds = Object.keys(byStation);
  console.log(`source: ${stationIds.length} stations`);

  const now = new Date().toISOString();
  const rows = stationIds.map((station_no) => ({
    station_no,
    events: byStation[station_no],
    updated_at: now,
  }));

  const sb = makeServiceClient();
  const { error, count } = await sb
    .from("events_by_station")
    .upsert(rows, { onConflict: "station_no", count: "exact" });
  if (error) throw error;
  console.log(`upserted ${count ?? rows.length} stations`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
