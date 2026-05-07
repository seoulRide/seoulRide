import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS } from "../lib/env.ts";

interface Station {
  station_no: string;
  station_name_ko: string;
  gu_ko: string;
  gu_en: string | null;
}

interface ConsumptionRow {
  qtr: string;
  trdar_cd: string;
  trdar_nm: string;
  food_expenditure: number;
  culture_expenditure: number;
  leisure_expenditure: number;
  expenditure_total: number;
}

// 정적 blurb dict — .claude/skills/food-hotspot-analysis/references/food-blurbs.json 기반
const BLURBS: Record<string, { label_ko: string; label_en: string; blurb_en: string }> = {
  korean_food: {
    label_ko: "한식",
    label_en: "Korean Cuisine",
    blurb_en: "{gu_en} offers a solid Korean cuisine scene — try local rice and stew houses (baekban) on side streets for an authentic, affordable meal.",
  },
  korean_bbq: {
    label_ko: "한식 (고기)",
    label_en: "Korean BBQ",
    blurb_en: "Look for grilled-meat (gogi-jip) restaurants in {gu_en} — pork belly (samgyeopsal) is the most popular cut and almost always served with banchan.",
  },
  cafe: {
    label_ko: "카페",
    label_en: "Cafés",
    blurb_en: "{gu_en} is dotted with specialty coffee shops, especially in walkable side streets. Many double as dessert spots with seasonal menus.",
  },
  street_food: {
    label_ko: "길거리음식",
    label_en: "Street Food",
    blurb_en: "Street stalls in {gu_en} serve tteokbokki, hotteok, and odeng — best after sunset and very cash-friendly.",
  },
  noodle: {
    label_ko: "면요리",
    label_en: "Noodles & Dumplings",
    blurb_en: "{gu_en} has noodle shops worth visiting — try kalguksu or naengmyeon depending on the season.",
  },
  bakery: {
    label_ko: "베이커리",
    label_en: "Bakeries",
    blurb_en: "Korean bakeries in {gu_en} sell soft milk bread, anpang, and seasonal pastries — look near subway exits.",
  },
  dessert: {
    label_ko: "디저트",
    label_en: "Desserts",
    blurb_en: "Dessert culture is strong in {gu_en} — bingsu in summer and yakgwa or seasonal cakes year-round.",
  },
  _carryall: {
    label_ko: "다양한 음식",
    label_en: "Mixed Local Eats",
    blurb_en: "{gu_en} has a healthy mix of local restaurants — ask staff for the day's recommendation if you don't read Korean.",
  },
};

// 자치구별 대표 카테고리 (수동 큐레이션 — 외국인 친화 1~2개)
// blurb dict는 카테고리 키만 내려주고 ranking은 자치구별로 큐레이션.
const GU_CATEGORIES: Record<string, string[]> = {
  "Mapo-gu": ["korean_bbq", "cafe"],
  "Yongsan-gu": ["korean_food", "street_food"],
  "Jongno-gu": ["korean_food", "street_food"],
  "Jung-gu": ["street_food", "korean_food"],
  "Gangnam-gu": ["korean_bbq", "dessert"],
  "Seocho-gu": ["korean_bbq", "cafe"],
  "Seongdong-gu": ["cafe", "korean_food"],
  "Gwangjin-gu": ["korean_bbq", "cafe"],
  "Songpa-gu": ["korean_food", "cafe"],
  "Gangdong-gu": ["korean_food", "noodle"],
  "Yeongdeungpo-gu": ["korean_food", "street_food"],
  "Yangcheon-gu": ["korean_food", "bakery"],
  "Gangseo-gu": ["korean_food", "noodle"],
  "Guro-gu": ["korean_food", "noodle"],
  "Geumcheon-gu": ["korean_food", "noodle"],
  "Dongjak-gu": ["korean_food", "cafe"],
  "Gwanak-gu": ["korean_food", "cafe"],
  "Eunpyeong-gu": ["korean_food", "bakery"],
  "Seodaemun-gu": ["cafe", "korean_food"],
  "Nowon-gu": ["korean_food", "noodle"],
  "Dobong-gu": ["korean_food", "noodle"],
  "Gangbuk-gu": ["korean_food", "noodle"],
  "Seongbuk-gu": ["cafe", "korean_food"],
  "Dongdaemun-gu": ["street_food", "korean_food"],
  "Jungnang-gu": ["korean_food", "noodle"],
};

async function main() {
  const ws = path.join(PATHS.workspace);
  const stations: Station[] = JSON.parse(await fs.readFile(path.join(ws, "02_analytics/popular_stations.json"), "utf8"));
  const consumption: ConsumptionRow[] = JSON.parse(
    await fs.readFile(path.join(ws, "01_ingest/trdarNcmCnsmp.normalized.json"), "utf8"),
  );

  // 자치구별 음식 지출 score (정규화 0~1) — 상권명에서 자치구 추론은 불완전해서
  // 전체 데이터의 활동 수준을 가늠하는 보조 시그널로만 사용
  const totalFood = consumption.reduce((a, r) => a + r.food_expenditure, 0);
  const totalCulture = consumption.reduce((a, r) => a + r.culture_expenditure, 0);
  const avgFoodPerArea = totalFood / Math.max(1, consumption.length);
  // Note: trdar(상권) → gu 매핑이 없어 자치구별 분리 점수 산출 불가.
  // 대신 자치구의 일반적 활성도를 GU_CATEGORIES 사전 큐레이션에 의존.

  const byStation: Record<string, any> = {};
  let missingBlurbs: string[] = [];

  for (const station of stations) {
    const guEn = station.gu_en ?? "";
    const cats = GU_CATEGORIES[guEn] ?? ["korean_food", "cafe"];
    const top_categories = cats.map((catKey) => {
      const entry = BLURBS[catKey] ?? BLURBS["_carryall"];
      if (!BLURBS[catKey]) missingBlurbs.push(`${guEn}:${catKey}`);
      return {
        category: catKey,
        label_ko: entry.label_ko,
        label_en: entry.label_en,
        blurb_en: entry.blurb_en.replaceAll("{gu_en}", guEn || station.gu_ko),
      };
    });

    byStation[station.station_no] = {
      gu_ko: station.gu_ko,
      gu_en: station.gu_en,
      activity_score: +(avgFoodPerArea > 0 ? 0.7 : 0.5).toFixed(2), // placeholder broad signal
      top_categories,
      data_source: "estimated_consumption + curated_categories",
    };
  }

  const outDir = path.join(PATHS.workspace, "03_curation");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "food_by_station.json"), JSON.stringify(byStation, null, 2), "utf8");

  if (missingBlurbs.length) {
    const qaDir = path.join(PATHS.workspace, "qa");
    await fs.mkdir(qaDir, { recursive: true });
    await fs.writeFile(path.join(qaDir, "missing_blurbs.txt"), [...new Set(missingBlurbs)].join("\n"), "utf8");
  }

  const summary = `# food curation summary

- Stations: ${stations.length}
- Categories used: ${[...new Set(Object.values(byStation).flatMap((v: any) => v.top_categories.map((c: any) => c.category)))].join(", ")}
- Missing blurb keys: ${missingBlurbs.length}
- Data note: 상권 코드 ↔ 자치구 매핑이 데이터셋에 없어 자치구별 음식 지출 점수는 산출하지 못함. 대신 정적 큐레이션(GU_CATEGORIES) + blurb dict + 전반적 활성도 지표.

## Sample (top 3 stations)
${stations
  .slice(0, 3)
  .map((s) => {
    const v = byStation[s.station_no];
    return `- **${s.station_name_ko}** (${s.gu_ko})\n  - ${v.top_categories.map((c: any) => c.label_en).join(", ")}\n  - ${v.top_categories[0].blurb_en}`;
  })
  .join("\n")}
`;
  await fs.writeFile(path.join(outDir, "food_summary.md"), summary, "utf8");
  console.log(summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
