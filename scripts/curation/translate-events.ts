/**
 * Translate Korean event titles/venues to English via Solar Pro 2 and patch the
 * existing curation output in place.
 *
 * Reads `_workspace/03_curation/events_by_station.json` (falls back to the
 * committed `apps/mobile/assets/data/events_by_station.json` so this works in
 * CI/fresh clones), finds rows with `en_fallback === "ko_original"`, batches
 * 20 unique (title_ko, venue_ko) pairs per Solar request, and persists
 * translations to `_workspace/03_curation/translations_events.json` keyed by
 * `${title_ko}|${venue_ko}` so re-runs skip cached pairs.
 *
 * After translation, writes the patched events JSON back to
 * `_workspace/03_curation/events_by_station.json` AND
 * `apps/mobile/assets/data/events_by_station.json` (the committed CI fallback).
 *
 *   pnpm translate:events
 *   TRANSLATE_EVENTS_LIMIT=20 pnpm translate:events   # dev cap (unique pairs)
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { loadEnv, PATHS } from "../lib/env.ts";

interface EventRow {
  id: string;
  title_ko: string;
  title_en: string;
  venue_ko: string;
  venue_en: string;
  en_fallback: "matched_dataset" | "ko_original" | "translated";
  [k: string]: unknown;
}

type EventsByStation = Record<string, EventRow[]>;

interface Translation {
  title_en: string;
  venue_en: string;
}
type Cache = Record<string, Translation>;

const SYSTEM_PROMPT = `You translate Korean cultural-event titles and venue names into natural English for foreign tourists visiting Seoul.

Rules:
- Translate, do not transliterate, unless the term is a proper noun. Use established English place names where they exist (Seoul Forest, Han River Park, Sejong Cultural Center, Lotte World Tower, COEX, DDP, etc.).
- Keep brackets/parentheses meaning ("[xxx]" → keep as a bracketed phrase in English).
- If the Korean text contains a year, gu name, or program edition, preserve it.
- Be concise and skimmable on a card; max ~80 chars per field.
- Do NOT add explanations, do NOT translate URLs, do NOT include the original Korean.
- If the input is empty, return an empty string for that field.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          title_en: { type: "string" },
          venue_en: { type: "string" },
        },
        required: ["key", "title_en", "venue_en"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const BATCH_SIZE = 20;

const EVENTS_WORKSPACE = path.join(PATHS.workspace, "03_curation/events_by_station.json");
const EVENTS_MOBILE = path.join(PATHS.mobileAssets, "events_by_station.json");
const CACHE_FILE = path.join(PATHS.workspace, "03_curation/translations_events.json");

function pairKey(title_ko: string, venue_ko: string): string {
  return `${title_ko.trim()}||${venue_ko.trim()}`;
}

async function readEvents(): Promise<{ data: EventsByStation; source: string }> {
  try {
    const txt = await fs.readFile(EVENTS_WORKSPACE, "utf8");
    return { data: JSON.parse(txt), source: EVENTS_WORKSPACE };
  } catch {
    const txt = await fs.readFile(EVENTS_MOBILE, "utf8");
    return { data: JSON.parse(txt), source: EVENTS_MOBILE };
  }
}

async function readCache(): Promise<Cache> {
  try {
    const txt = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(txt) as Cache;
  } catch {
    return {};
  }
}

async function writeCache(cache: Cache): Promise<void> {
  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

interface UniquePair {
  key: string;
  title_ko: string;
  venue_ko: string;
}

function collectUniquePairs(data: EventsByStation, cache: Cache): UniquePair[] {
  const seen = new Set<string>();
  const out: UniquePair[] = [];
  for (const rows of Object.values(data)) {
    for (const r of rows) {
      if (r.en_fallback !== "ko_original") continue;
      const k = pairKey(r.title_ko, r.venue_ko);
      if (seen.has(k) || cache[k]) continue;
      seen.add(k);
      out.push({ key: k, title_ko: r.title_ko, venue_ko: r.venue_ko });
    }
  }
  return out;
}

async function translateBatch(client: OpenAI, batch: UniquePair[]): Promise<Cache> {
  const userPayload = JSON.stringify(
    {
      items: batch.map((b) => ({ key: b.key, title_ko: b.title_ko, venue_ko: b.venue_ko })),
    },
    null,
    2,
  );
  const res = await client.chat.completions.create({
    model: "solar-pro2",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Translate each item's title_ko and venue_ko to English. Echo the same `key` so I can match the response back.\n\n" +
          userPayload,
      },
    ],
    max_tokens: 2200,
    response_format: {
      type: "json_schema",
      json_schema: { name: "event_translations", strict: true, schema: SCHEMA },
    },
  });
  const raw = res.choices[0]?.message.content ?? '{"items":[]}';
  const parsed = JSON.parse(raw) as { items: { key: string; title_en: string; venue_en: string }[] };
  const out: Cache = {};
  for (const it of parsed.items) {
    out[it.key] = { title_en: it.title_en, venue_en: it.venue_en };
  }
  return out;
}

function patchEvents(data: EventsByStation, cache: Cache): { patched: number; rows: number } {
  let patched = 0;
  let rows = 0;
  for (const arr of Object.values(data)) {
    for (const r of arr) {
      rows++;
      if (r.en_fallback !== "ko_original") continue;
      const k = pairKey(r.title_ko, r.venue_ko);
      const t = cache[k];
      if (!t) continue;
      r.title_en = t.title_en || r.title_ko;
      r.venue_en = t.venue_en || r.venue_ko;
      r.en_fallback = "translated";
      patched++;
    }
  }
  return { patched, rows };
}

async function main() {
  const env = await loadEnv();
  const apiKey = process.env.SOLAR_API_KEY || env.SOLAR_API_KEY;
  if (!apiKey) throw new Error("SOLAR_API_KEY missing (.env.local or process.env)");
  const client = new OpenAI({ apiKey, baseURL: "https://api.upstage.ai/v1" });

  const { data, source } = await readEvents();
  console.log(`Loaded events from: ${source}`);
  const cache = await readCache();
  console.log(`Cache hits available: ${Object.keys(cache).length}`);

  const pairs = collectUniquePairs(data, cache);
  const cap = parseInt(process.env.TRANSLATE_EVENTS_LIMIT ?? "0", 10) || pairs.length;
  const work = pairs.slice(0, cap);
  console.log(`Unique untranslated pairs: ${pairs.length} (processing ${work.length})`);

  for (let i = 0; i < work.length; i += BATCH_SIZE) {
    const batch = work.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  · batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(work.length / BATCH_SIZE)} (${batch.length} pairs) `);
    let attempt = 0;
    while (attempt < 3) {
      try {
        const result = await translateBatch(client, batch);
        Object.assign(cache, result);
        await writeCache(cache);
        break;
      } catch (e) {
        attempt++;
        console.warn(`\n  ! batch failed (attempt ${attempt}):`, e instanceof Error ? e.message : e);
        if (attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  console.log();

  const { patched, rows } = patchEvents(data, cache);
  console.log(`Patched ${patched}/${rows} rows.`);

  await fs.mkdir(path.dirname(EVENTS_WORKSPACE), { recursive: true });
  await fs.writeFile(EVENTS_WORKSPACE, JSON.stringify(data, null, 2), "utf8");
  await fs.writeFile(EVENTS_MOBILE, JSON.stringify(data, null, 2), "utf8");
  console.log(`✓ wrote ${EVENTS_WORKSPACE}`);
  console.log(`✓ wrote ${EVENTS_MOBILE}`);
  console.log(`✓ cache ${CACHE_FILE}`);
}

main().catch((e) => {
  console.error("✗ translate-events failed:", e);
  process.exit(1);
});
