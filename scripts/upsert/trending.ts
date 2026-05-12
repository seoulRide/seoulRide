import { loadEnv, readWorkspaceText } from "../lib/env.ts";
import { makeServiceClient } from "../lib/supabase.ts";

interface TrendingEntry {
  station_no: string;
  station_name_ko: string;
  gu_ko: string;
  gu_en: string | null;
  mention_count: number;
  sentiment_avg: number;
  summary_ko: string;
  summary_en: string;
  related_event_ids: string[];
  sources: unknown[];
  updated_at: string;
}

async function main() {
  const env = await loadEnv();
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }

  const txt = await readWorkspaceText("05_trending/trending.json");
  const entries = JSON.parse(txt) as TrendingEntry[];
  console.log(`source: ${entries.length} trending entries`);

  const now = new Date().toISOString();
  const rows = entries.map((e, i) => ({
    rank: i + 1,
    station_no: e.station_no,
    station_name_ko: e.station_name_ko,
    gu_ko: e.gu_ko,
    gu_en: e.gu_en,
    mention_count: e.mention_count,
    sentiment_avg: e.sentiment_avg,
    summary_ko: e.summary_ko,
    summary_en: e.summary_en,
    related_event_ids: e.related_event_ids,
    sources: e.sources,
    entry_updated_at: e.updated_at,
    updated_at: now,
  }));

  const sb = makeServiceClient();
  const { error } = await sb
    .from("trending")
    .upsert(rows, { onConflict: "rank" });
  if (error) throw error;

  // 새 결과가 기존보다 적을 때 잔여 rank 행 정리.
  const maxRank = rows.length;
  const { error: delError } = await sb
    .from("trending")
    .delete()
    .gt("rank", maxRank);
  if (delError) throw delError;

  console.log(`upserted ${rows.length} entries (cleared rank > ${maxRank})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
