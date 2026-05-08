/**
 * Smoke test: verify SOLAR_API_KEY works and that solar-mini can extract
 * place mentions from a tiny Korean snippet via structured JSON output.
 *
 *   pnpm trending:smoke
 */
import OpenAI from "openai";
import { loadEnv } from "../lib/env.ts";

async function main() {
  const env = await loadEnv();
  const apiKey = env.SOLAR_API_KEY;
  if (!apiKey) {
    console.error("✗ SOLAR_API_KEY not found in .env.local");
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.upstage.ai/v1",
  });

  // 1. Plain ping ---------------------------------------------------------
  console.log("⟳ ping (solar-mini)…");
  const ping = await client.chat.completions.create({
    model: "solar-mini",
    messages: [
      { role: "user", content: "한 줄로 인사해줘. '안녕'으로 시작." },
    ],
    max_tokens: 40,
  });
  console.log("  ✓", ping.choices[0]?.message.content?.trim());

  // 2. Structured-output extraction ---------------------------------------
  const model = process.env.SOLAR_EXTRACT_MODEL || "solar-pro2";
  console.log(`⟳ structured place extraction (${model})…`);
  const article =
    "이번 주말 성수동 카페 거리가 다시 붐볐다. 서울숲 쪽에서 한강까지 자전거로 이동하는 외국인 관광객도 늘었다. 한남동의 새 와인바도 입소문을 타고 있다.";
  const extract = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You extract Korean place mentions from a news/blog snippet. Return only places that are physical neighborhoods/landmarks/streets in Seoul (not company names, not abstract concepts). Return Korean and a best-effort English/romanized form.",
      },
      { role: "user", content: article },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "place_mentions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            mentions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  place_ko: { type: "string" },
                  place_en: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["neighborhood", "park", "landmark", "street", "venue"],
                  },
                  evidence_snippet: { type: "string" },
                },
                required: ["place_ko", "place_en", "category", "evidence_snippet"],
                additionalProperties: false,
              },
            },
          },
          required: ["mentions"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 600,
  });
  const raw = extract.choices[0]?.message.content ?? "";
  console.log("  raw output:", raw);
  const parsed = JSON.parse(raw);
  console.log("  ✓ parsed mentions count:", parsed.mentions?.length);
  for (const m of parsed.mentions ?? []) {
    console.log(`    - ${m.place_ko} (${m.place_en}) · ${m.category}`);
  }

  console.log("\n✓ smoke test passed");
}

main().catch((e) => {
  console.error("✗ smoke test failed:", e);
  process.exit(1);
});
