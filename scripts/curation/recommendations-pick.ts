/**
 * Solar Pro 2로 50개 인기 대여소 각각에 대해 오늘의 행사 5개를 큐레이션하고
 * Supabase `daily_recommendations` 테이블에 upsert.
 *
 * Input: popular_stations + events_by_station (Supabase) + today's weather (KMA)
 * Output: 250 rows (50 anchor × 5 rank)
 *
 *   pnpm pick:recommendations
 */
import OpenAI from "openai";
import { loadEnv } from "../lib/env.ts";
import { makeServiceClient } from "../lib/supabase.ts";

const RADIUS_KM = 3;
const PICKS_PER_ANCHOR = 5;
const SOLAR_BASE_URL = "https://api.upstage.ai/v1";
const SOLAR_MODEL = "solar-pro2";
const BATCH_DELAY_MS = 500;

interface PopularStation {
  station_no: string;
  station_name_ko: string;
  station_name_en: string | null;
  lat: number;
  lng: number;
  gu_ko: string;
  gu_en: string | null;
  rank_overall: number;
}

interface EventRow {
  id: string;
  title_ko: string;
  title_en: string;
  venue_ko: string;
  venue_en: string;
  category: string;
  lat: number | null;
  lng: number | null;
  start: string;
  end: string;
  is_free: string;
  price: string;
  price_en?: string;
}

interface WeatherRow {
  gu_en: string;
  now: {
    temp_c?: number;
    rain_prob?: number;
    wind_ms?: number;
    label_en: string;
  };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SYSTEM_PROMPT = `You are curating today's bike-friendly event picks for foreign tourists in Seoul.

For each anchor bike station, you receive:
- The station's name, gu, today's date and weather
- A list of candidate events within 3km, with distance, category, dates, English title

Pick the TOP 5 events ranked by appropriateness for TODAY. Output strict JSON.

Picking rules:
- Prefer events that are CURRENTLY running (start ≤ today, end ≥ today)
- Closer is better (under 2km strongly preferred)
- Diversity: avoid 5 picks of the same category
- Weather-aware: if rainy/cold → indoor (exhibition/performance); if warm/sunny → outdoor (festival/experience) preferred
- Tourist-friendly: prefer well-known cultural venues
- Prefer events with English title that does not equal Korean (i.e., real translation present)

For each pick output:
- rank (1-5)
- event_id (exact id from candidate list)
- reason_ko: ONE Korean line, under 35 chars, explaining why THIS event for TODAY's context
- reason_en: ONE English line, under 50 chars, same intent

Reasons must reference today's weather or weekday or distance when relevant — not generic descriptions of the event.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rank: { type: "integer" },
          event_id: { type: "string" },
          reason_ko: { type: "string" },
          reason_en: { type: "string" },
        },
        required: ["rank", "event_id", "reason_ko", "reason_en"],
        additionalProperties: false,
      },
    },
  },
  required: ["picks"],
  additionalProperties: false,
};

interface Pick {
  rank: number;
  event_id: string;
  reason_ko: string;
  reason_en: string;
}

async function pickForAnchor(
  client: OpenAI,
  anchor: PopularStation,
  candidates: Array<EventRow & { distance_km: number }>,
  today: string,
  dayOfWeek: string,
  weather: WeatherRow | null,
): Promise<Pick[]> {
  if (candidates.length === 0) return [];

  const weatherLine = weather
    ? `${weather.now.temp_c ?? "?"}°C, rain ${weather.now.rain_prob ?? 0}%, wind ${weather.now.wind_ms ?? 0}m/s — "${weather.now.label_en}"`
    : "weather unavailable";

  const compactCandidates = candidates.slice(0, 30).map((c) => ({
    event_id: c.id,
    title_ko: c.title_ko.slice(0, 60),
    title_en: c.title_en.slice(0, 60),
    venue_en: c.venue_en.slice(0, 40),
    category: c.category,
    start: c.start.slice(0, 10),
    end: c.end.slice(0, 10),
    distance_km: Math.round(c.distance_km * 10) / 10,
    is_free: c.is_free,
  }));

  const userContent = `Anchor station: ${anchor.station_name_en ?? anchor.station_name_ko} (${anchor.gu_en ?? anchor.gu_ko})
Today: ${today} (${dayOfWeek})
Weather: ${weatherLine}

Candidate events within ${RADIUS_KM}km (sorted by distance, top ${compactCandidates.length}):
${JSON.stringify(compactCandidates, null, 0)}

Pick top ${PICKS_PER_ANCHOR}.`;

  const res = await client.chat.completions.create({
    model: SOLAR_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    max_tokens: 1500,
    response_format: {
      type: "json_schema",
      json_schema: { name: "anchor_picks", strict: true, schema: SCHEMA },
    },
  });

  const raw = res.choices[0]?.message.content ?? '{"picks":[]}';
  const parsed = JSON.parse(raw) as { picks: Pick[] };
  return parsed.picks.slice(0, PICKS_PER_ANCHOR);
}

async function main() {
  const env = await loadEnv();
  const apiKey = env.SOLAR_API_KEY ?? process.env.SOLAR_API_KEY;
  if (!apiKey) throw new Error("SOLAR_API_KEY required");
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (env[k] && !process.env[k]) process.env[k] = env[k];
  }

  const sb = makeServiceClient();

  // 1. popular stations (anchors)
  const { data: stations, error: stErr } = await sb
    .from("popular_stations")
    .select("station_no, station_name_ko, station_name_en, lat, lng, gu_ko, gu_en, rank_overall")
    .order("rank_overall", { ascending: true });
  if (stErr) throw stErr;
  console.log(`anchors: ${stations?.length ?? 0}`);

  // 2. events (jsonb per station — we flatten + dedupe)
  const { data: eventRows, error: evErr } = await sb
    .from("events_by_station")
    .select("station_no, events");
  if (evErr) throw evErr;
  const allEvents = new Map<string, EventRow>();
  for (const row of (eventRows ?? []) as Array<{ events: EventRow[] }>) {
    for (const e of row.events) {
      if (!e.lat || !e.lng) continue;
      if (!allEvents.has(e.id)) allEvents.set(e.id, e);
    }
  }
  const events = [...allEvents.values()];
  console.log(`events (deduped, with coords): ${events.length}`);

  // 3. today's weather — direct KMA call would be ideal but we keep this script
  //    LLM-only; weather context is best-effort from forecast cache if available.
  //    For now we skip weather context and let LLM rely on date/season knowledge.
  //    (If KMA cache table is added later, plug it in here.)
  const weatherByGuEn = new Map<string, WeatherRow>();

  // 4. today
  const now = new Date();
  const todayKst = new Date(now.getTime() + 9 * 3600 * 1000);
  const today = todayKst.toISOString().slice(0, 10);
  const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][todayKst.getUTCDay()];
  console.log(`today: ${today} (${dayOfWeek} KST)`);

  // 5. iterate anchors, build candidates, call Solar
  const client = new OpenAI({ apiKey, baseURL: SOLAR_BASE_URL });
  const allPicks: Array<{
    anchor_station_no: string;
    rank: number;
    event_id: string;
    reason_ko: string;
    reason_en: string;
    distance_km: number;
    pick_date: string;
  }> = [];

  for (const anchor of stations ?? []) {
    const candidates = events
      .map((e) => ({ ...e, distance_km: haversineKm({ lat: anchor.lat, lng: anchor.lng }, { lat: e.lat!, lng: e.lng! }) }))
      .filter((e) => e.distance_km <= RADIUS_KM)
      .sort((a, b) => a.distance_km - b.distance_km);

    const weather = anchor.gu_en ? weatherByGuEn.get(anchor.gu_en) ?? null : null;
    const picks = await pickForAnchor(client, anchor, candidates, today, dayOfWeek, weather);

    // map back to distance_km
    const distMap = new Map(candidates.map((c) => [c.id, c.distance_km]));
    for (const p of picks) {
      allPicks.push({
        anchor_station_no: anchor.station_no,
        rank: p.rank,
        event_id: p.event_id,
        reason_ko: p.reason_ko,
        reason_en: p.reason_en,
        distance_km: distMap.get(p.event_id) ?? 0,
        pick_date: today,
      });
    }

    process.stdout.write(`\r  · ${anchor.station_no} (${anchor.rank_overall}): ${picks.length} picks from ${candidates.length} candidates `);
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }
  console.log();

  // 6. upsert — clear all today's rows for these anchors first, then insert
  console.log(`upserting ${allPicks.length} picks...`);

  // delete existing rows for these anchors (so deletes propagate)
  const anchorIds = (stations ?? []).map((s) => s.station_no);
  if (anchorIds.length > 0) {
    const { error: delErr } = await sb
      .from("daily_recommendations")
      .delete()
      .in("anchor_station_no", anchorIds);
    if (delErr) throw delErr;
  }

  // batch insert
  if (allPicks.length > 0) {
    const { error: insErr } = await sb.from("daily_recommendations").insert(allPicks);
    if (insErr) throw insErr;
  }

  console.log(`✓ ${allPicks.length} rows in daily_recommendations`);
}

main().catch((e) => {
  console.error("✗ recommendations-pick failed:", e);
  process.exit(1);
});
