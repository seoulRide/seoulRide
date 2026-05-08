/**
 * Extract Korean place mentions from each raw article via Solar Pro 2.
 *
 * Reads _workspace/05_trending/raw/*.json, concatenates, and asks the LLM
 * for structured `{ place_ko, place_en, gu_ko, gu_en, category, sentiment,
 * tourist_relevant, evidence_snippet }[]` per article. NAVER articles get
 * an extra "tourist-relevance filter" instruction since the source mixes
 * politics / business news.
 *
 *   pnpm trending:extract
 *   TRENDING_EXTRACT_LIMIT=30 pnpm trending:extract   # dev cap
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { loadEnv, PATHS } from "../lib/env.ts";
import type { RawArticle, RawSource } from "./types.ts";

const RAW_FILES = ["reddit.json", "visit_seoul.json", "naver_news.json"] as const;

interface PlaceMention {
  place_ko: string;
  place_en: string;
  gu_ko: string;
  gu_en: string;
  category: "neighborhood" | "park" | "landmark" | "street" | "venue" | "exhibition" | "restaurant" | "other";
  sentiment: "positive" | "neutral" | "negative";
  tourist_relevant: boolean;
  evidence_snippet: string;
}

interface ExtractedRow {
  article_id: string;
  source: RawSource;
  url: string;
  title: string;
  published_at: string;
  mentions: PlaceMention[];
}

const SYSTEM_PROMPT = `You extract real Seoul place mentions from a news/blog/forum snippet.

Return ONLY places that are physical Seoul locations a foreign visitor could plausibly go to: neighborhoods (동), districts (구), parks, landmarks, streets, named venues (a specific cafe / gallery / restaurant), exhibitions.

Skip:
- Political "hot place" idioms ("핫플레이스" used about elections, business deals, kombat sports, etc.)
- Company / brand names without a physical location ("삼성물산", "올리브영" as a brand)
- Generic "Seoul" / "한국" alone
- Outside-Seoul places (use gu name to verify)

For tourist_relevant: true only if a foreign tourist would benefit from going there. Cultural buzz / food / outdoor / shopping → true. Pure local political news, business IR, sports / celebrity gossip → false (still extract, but flag false).

For gu_ko / gu_en: best-guess Seoul administrative district containing the place. If unknown or ambiguous, use empty string.

Return Korean (place_ko) and a romanized/English form (place_en).`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    mentions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          place_ko: { type: "string" },
          place_en: { type: "string" },
          gu_ko: { type: "string" },
          gu_en: { type: "string" },
          category: {
            type: "string",
            enum: ["neighborhood", "park", "landmark", "street", "venue", "exhibition", "restaurant", "other"],
          },
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
          tourist_relevant: { type: "boolean" },
          evidence_snippet: { type: "string" },
        },
        required: ["place_ko", "place_en", "gu_ko", "gu_en", "category", "sentiment", "tourist_relevant", "evidence_snippet"],
        additionalProperties: false,
      },
    },
  },
  required: ["mentions"],
  additionalProperties: false,
};

async function loadRaw(): Promise<RawArticle[]> {
  const dir = path.join(PATHS.workspace, "05_trending", "raw");
  const out: RawArticle[] = [];
  for (const f of RAW_FILES) {
    try {
      const txt = await fs.readFile(path.join(dir, f), "utf8");
      const parsed = JSON.parse(txt) as RawArticle[];
      out.push(...parsed);
    } catch (e) {
      console.warn(`  ! skip ${f}:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

function buildUserContent(a: RawArticle): string {
  const head = `[${a.source}] ${a.title}`;
  const body = a.body && a.body.length > 0 ? a.body : (a.snippet ?? "");
  return `${head}\n\n${body}`.slice(0, 6000);
}

async function extractOne(client: OpenAI, a: RawArticle): Promise<PlaceMention[]> {
  const isNaver = a.source === "naver_news";
  const sys = isNaver
    ? SYSTEM_PROMPT + "\n\n특히 NAVER 뉴스는 정치·기업 IR·연예 가십이 많이 섞입니다. 'tourist_relevant'를 보수적으로 false로 두세요."
    : SYSTEM_PROMPT;
  const res = await client.chat.completions.create({
    model: "solar-pro2",
    messages: [
      { role: "system", content: sys },
      { role: "user", content: buildUserContent(a) },
    ],
    max_tokens: 800,
    response_format: {
      type: "json_schema",
      json_schema: { name: "place_mentions", strict: true, schema: SCHEMA },
    },
  });
  const raw = res.choices[0]?.message.content ?? '{"mentions":[]}';
  try {
    const parsed = JSON.parse(raw) as { mentions: PlaceMention[] };
    return parsed.mentions ?? [];
  } catch {
    console.warn(`  ! JSON parse failed for ${a.id}`);
    return [];
  }
}

async function main() {
  const env = await loadEnv();
  // CI doesn't ship .env.local — fall back to process.env (the GitHub Actions
  // workflow injects SOLAR_API_KEY there from the repo secret).
  const apiKey = process.env.SOLAR_API_KEY || env.SOLAR_API_KEY;
  if (!apiKey) throw new Error("SOLAR_API_KEY missing (.env.local or process.env)");

  const client = new OpenAI({ apiKey, baseURL: "https://api.upstage.ai/v1" });

  const articles = await loadRaw();
  const limit = parseInt(process.env.TRENDING_EXTRACT_LIMIT ?? "0", 10) || articles.length;
  const work = articles.slice(0, limit);
  console.log(`Articles: ${articles.length} (processing ${work.length})`);

  const out: ExtractedRow[] = [];
  let totalMentions = 0;
  let touristCount = 0;
  for (const [i, a] of work.entries()) {
    process.stdout.write(`\r  · ${i + 1}/${work.length} `);
    try {
      const mentions = await extractOne(client, a);
      totalMentions += mentions.length;
      touristCount += mentions.filter((m) => m.tourist_relevant).length;
      out.push({
        article_id: a.id,
        source: a.source,
        url: a.url,
        title: a.title,
        published_at: a.published_at,
        mentions,
      });
    } catch (e) {
      console.warn(`\n  ! ${a.id}:`, e instanceof Error ? e.message : e);
    }
    // Polite throttle (Solar 100 RPM ≈ 1.66/sec; stay well under).
    await new Promise((r) => setTimeout(r, 700));
  }

  const outDir = path.join(PATHS.workspace, "05_trending", "extracted");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "mentions.json");
  await fs.writeFile(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(
    `\n✓ ${out.length} articles · ${totalMentions} mentions (${touristCount} tourist-relevant) → ${outFile}`,
  );
}

main().catch((e) => {
  console.error("✗ extract failed:", e);
  process.exit(1);
});
