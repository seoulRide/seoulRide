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
  price: string;
  price_en?: string;
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
const PRICES_CACHE_FILE = path.join(PATHS.workspace, "03_curation/translations_prices.json");

const PRICE_SYSTEM_PROMPT = `You translate Korean event price descriptions to short, natural English for foreign tourists.

Rules:
- Translate the meaning, keep the numbers intact ("30,000원" → "30,000 KRW").
- Common phrases:
  - "유료" → "Paid"
  - "무료" → "Free"
  - "입장료 별도" → "Admission fee separate"
  - "전석 30,000원" → "All seats 30,000 KRW"
  - "VIP석 165,000원 R석 154,000원" → "VIP 165,000 KRW · R 154,000 KRW"
  - "부가세 포함" → "VAT included"
  - "부가서비스 선택 시 추가 비용 발생" → "Optional add-ons incur extra charges"
  - "강좌별 상이" / "프로그램별 상이" → "Varies by program"
  - "성동구민 1만5천원" → "Seongdong residents 15,000 KRW"
  - "JCC회원 10% 할인" → "10% off for JCC members"
- Keep ~60 chars max per item. Compact, glanceable on a card.
- Do NOT add explanations or the original Korean.`;

const PRICE_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          price_en: { type: "string" },
        },
        required: ["key", "price_en"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

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

type PriceCache = Record<string, string>;

async function readPriceCache(): Promise<PriceCache> {
  try {
    return JSON.parse(await fs.readFile(PRICES_CACHE_FILE, "utf8")) as PriceCache;
  } catch {
    return {};
  }
}

async function writePriceCache(cache: PriceCache): Promise<void> {
  await fs.mkdir(path.dirname(PRICES_CACHE_FILE), { recursive: true });
  await fs.writeFile(PRICES_CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

function priceNeedsTranslation(price: string): boolean {
  // "Free" and rows already with no Korean glyph stay as-is. Everything with
  // any Hangul codepoint goes through the LLM. Pure ASCII (e.g. "Paid") needs
  // no translation either.
  if (!price) return false;
  if (price === "Free") return false;
  return /[ㄱ-힝]/.test(price);
}

function collectUniquePrices(data: EventsByStation, cache: PriceCache): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rows of Object.values(data)) {
    for (const r of rows) {
      const p = r.price?.trim();
      if (!p || !priceNeedsTranslation(p)) continue;
      if (seen.has(p) || cache[p]) continue;
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

async function translatePriceBatch(client: OpenAI, batch: string[]): Promise<PriceCache> {
  const payload = JSON.stringify(
    { items: batch.map((p, i) => ({ key: String(i), price_ko: p })) },
    null,
    2,
  );
  const res = await client.chat.completions.create({
    model: "solar-pro2",
    messages: [
      { role: "system", content: PRICE_SYSTEM_PROMPT },
      {
        role: "user",
        content: "Translate each item's price_ko to English. Echo the same `key`.\n\n" + payload,
      },
    ],
    max_tokens: 1600,
    response_format: {
      type: "json_schema",
      json_schema: { name: "price_translations", strict: true, schema: PRICE_SCHEMA },
    },
  });
  const raw = res.choices[0]?.message.content ?? '{"items":[]}';
  const parsed = JSON.parse(raw) as { items: { key: string; price_en: string }[] };
  const out: PriceCache = {};
  for (const it of parsed.items) {
    const idx = parseInt(it.key, 10);
    if (Number.isFinite(idx) && batch[idx]) {
      out[batch[idx]] = it.price_en;
    }
  }
  return out;
}

function patchPrices(data: EventsByStation, cache: PriceCache): { patched: number; skipped: number } {
  let patched = 0;
  let skipped = 0;
  for (const arr of Object.values(data)) {
    for (const r of arr) {
      const p = r.price?.trim();
      if (!p) { skipped++; continue; }
      if (p === "Free") {
        r.price_en = "Free";
        continue;
      }
      if (!priceNeedsTranslation(p)) {
        // Pure ASCII English already — mirror it as price_en.
        r.price_en = p;
        continue;
      }
      const t = cache[p];
      if (!t) { skipped++; continue; }
      r.price_en = t;
      patched++;
    }
  }
  return { patched, skipped };
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
  console.log(`Patched ${patched}/${rows} title/venue rows.`);

  // --- Price translation pass ---
  const priceCache = await readPriceCache();
  console.log(`Price cache hits available: ${Object.keys(priceCache).length}`);
  const uniquePrices = collectUniquePrices(data, priceCache);
  console.log(`Unique Korean prices to translate: ${uniquePrices.length}`);

  for (let i = 0; i < uniquePrices.length; i += BATCH_SIZE) {
    const batch = uniquePrices.slice(i, i + BATCH_SIZE);
    process.stdout.write(
      `\r  · price batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniquePrices.length / BATCH_SIZE)} (${batch.length}) `,
    );
    let attempt = 0;
    while (attempt < 3) {
      try {
        const result = await translatePriceBatch(client, batch);
        Object.assign(priceCache, result);
        await writePriceCache(priceCache);
        break;
      } catch (e) {
        attempt++;
        console.warn(`\n  ! price batch failed (attempt ${attempt}):`, e instanceof Error ? e.message : e);
        if (attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  if (uniquePrices.length > 0) console.log();

  const { patched: pricePatched, skipped: priceSkipped } = patchPrices(data, priceCache);
  console.log(`Patched ${pricePatched} prices (skipped ${priceSkipped}).`);

  await fs.mkdir(path.dirname(EVENTS_WORKSPACE), { recursive: true });
  await fs.writeFile(EVENTS_WORKSPACE, JSON.stringify(data, null, 2), "utf8");
  await fs.writeFile(EVENTS_MOBILE, JSON.stringify(data, null, 2), "utf8");
  console.log(`✓ wrote ${EVENTS_WORKSPACE}`);
  console.log(`✓ wrote ${EVENTS_MOBILE}`);
  console.log(`✓ cache ${CACHE_FILE}`);
  console.log(`✓ prices cache ${PRICES_CACHE_FILE}`);
}

main().catch((e) => {
  console.error("✗ translate-events failed:", e);
  process.exit(1);
});
