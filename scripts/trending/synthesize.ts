/**
 * Synthesize the final trending.json by asking Solar Pro 2 to write 1–2
 * sentence ko + en summaries for the top stations from aggregate.ts. Single
 * call per run (not per station) — feeds all candidates at once for global
 * coherence.
 *
 * Input:  _workspace/05_trending/aggregated.json
 *         _workspace/03_curation/events_by_station.json (for event titles)
 * Output: _workspace/05_trending/trending.json
 *
 *   pnpm trending:synthesize
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { loadEnv, PATHS, readWorkspaceText } from "../lib/env.ts";
import type { RawSource } from "./types.ts";

const TOP_N = 5;

interface AggregatedEntry {
  station_no: string;
  station_name_ko: string;
  gu_ko: string;
  gu_en: string | null;
  mention_count: number;
  sentiment_avg: number;
  evidence_articles: Array<{
    article_id: string;
    source: RawSource;
    url: string;
    title: string;
    snippet: string;
    place_ko: string;
    sentiment: "positive" | "neutral" | "negative";
  }>;
  related_event_ids: string[];
}

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
  sources: Array<{ url: string; title: string; snippet: string; source: RawSource }>;
  updated_at: string;
}

const SYSTEM_PROMPT = `You write concise, foreigner-tourist-friendly summaries for trending Seoul neighborhoods.

For each station entry below, produce summary_ko (1-2 short Korean sentences) and summary_en (1-2 short English sentences). Both must:
- Lead with what's actually buzzing (cafes / events / pop-ups / festivals — whatever the evidence supports).
- Mention the gu or specific neighborhood name.
- Be honest about sentiment — if evidence is mixed/negative, do not oversell.
- Not invent facts not present in the evidence snippets.
- Stay under ~140 chars per language.

Return JSON keyed by station_no.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    summaries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          station_no: { type: "string" },
          summary_ko: { type: "string" },
          summary_en: { type: "string" },
        },
        required: ["station_no", "summary_ko", "summary_en"],
        additionalProperties: false,
      },
    },
  },
  required: ["summaries"],
  additionalProperties: false,
};

function buildUserContent(top: AggregatedEntry[], eventTitlesById: Map<string, { ko: string; en: string }>): string {
  const lines: string[] = [];
  for (const a of top) {
    lines.push(`### station_no=${a.station_no}  ${a.station_name_ko}  (${a.gu_ko}/${a.gu_en ?? "?"})`);
    lines.push(`mention_count=${a.mention_count}  sentiment_avg=${a.sentiment_avg.toFixed(2)}`);
    lines.push("evidence (article snippets):");
    for (const ev of a.evidence_articles.slice(0, 6)) {
      lines.push(`  - [${ev.source} · ${ev.sentiment}] ${ev.place_ko}: ${ev.snippet.slice(0, 200)}`);
    }
    if (a.related_event_ids.length > 0) {
      lines.push("nearby events (next 7 days):");
      for (const id of a.related_event_ids) {
        const t = eventTitlesById.get(id);
        if (t) lines.push(`  - ${t.ko} / ${t.en}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

async function main() {
  const env = await loadEnv();
  const apiKey = process.env.SOLAR_API_KEY || env.SOLAR_API_KEY;
  if (!apiKey) throw new Error("SOLAR_API_KEY missing (.env.local or process.env)");

  const wsDir = PATHS.workspace;
  const [aggTxt, eventsTxt] = await Promise.all([
    fs.readFile(path.join(wsDir, "05_trending", "aggregated.json"), "utf8"),
    readWorkspaceText("03_curation/events_by_station.json"),
  ]);
  const aggregated = JSON.parse(aggTxt) as AggregatedEntry[];
  const eventsByStation = JSON.parse(eventsTxt) as Record<
    string,
    Array<{ id: string; title_ko: string; title_en: string }>
  >;
  const eventTitlesById = new Map<string, { ko: string; en: string }>();
  for (const list of Object.values(eventsByStation)) {
    for (const e of list) {
      eventTitlesById.set(e.id, { ko: e.title_ko, en: e.title_en });
    }
  }

  const top = aggregated.slice(0, TOP_N);
  if (top.length === 0) {
    console.error("✗ aggregated.json is empty — nothing to synthesize");
    process.exit(1);
  }
  console.log(`Synthesizing top ${top.length} of ${aggregated.length} stations…`);

  const client = new OpenAI({ apiKey, baseURL: "https://api.upstage.ai/v1" });
  const res = await client.chat.completions.create({
    model: "solar-pro2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(top, eventTitlesById) },
    ],
    max_tokens: 1500,
    response_format: {
      type: "json_schema",
      json_schema: { name: "summaries", strict: true, schema: SCHEMA },
    },
  });
  const raw = res.choices[0]?.message.content ?? '{"summaries":[]}';
  const parsed = JSON.parse(raw) as { summaries: Array<{ station_no: string; summary_ko: string; summary_en: string }> };
  const sumByStation = new Map(parsed.summaries.map((s) => [s.station_no, s]));

  const updated_at = new Date().toISOString();
  const trending: TrendingEntry[] = top.map((a) => {
    const s = sumByStation.get(a.station_no);
    return {
      station_no: a.station_no,
      station_name_ko: a.station_name_ko,
      gu_ko: a.gu_ko,
      gu_en: a.gu_en,
      mention_count: a.mention_count,
      sentiment_avg: a.sentiment_avg,
      summary_ko: s?.summary_ko ?? "",
      summary_en: s?.summary_en ?? "",
      related_event_ids: a.related_event_ids,
      sources: a.evidence_articles.slice(0, 4).map((ev) => ({
        url: ev.url,
        title: ev.title,
        snippet: ev.snippet.slice(0, 280),
        source: ev.source,
      })),
      updated_at,
    };
  });

  const outFile = path.join(wsDir, "05_trending", "trending.json");
  await fs.writeFile(outFile, JSON.stringify(trending, null, 2), "utf8");
  console.log(`✓ ${trending.length} entries → ${outFile}`);
  for (const t of trending) {
    console.log(`  · ${t.station_name_ko}: "${t.summary_en.slice(0, 80)}…"`);
  }
}

main().catch((e) => {
  console.error("✗ synthesize failed:", e);
  process.exit(1);
});
