/**
 * NAVER News fetcher via k-skill-proxy (anonymous, no NAVER credentials).
 *
 * Hits a curated tourist-focused keyword pool (cafe streets, popular gus,
 * Han River parks, exhibitions, festivals). Returns search-result metadata
 * only (no full article body) — proxy doesn't fetch the body. The extract
 * step will use title + description as input.
 *
 *   pnpm trending:fetch:naver
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS } from "../lib/env.ts";
import type { RawArticle } from "./types.ts";

const PROXY_BASE = "https://k-skill-proxy.nomadamas.org/v1/naver-news/search";

// Tourist-tilted keyword pool. Avoid keywords like "핫플레이스" alone — too
// noisy with political "hot place" idioms. Prefer place-anchored queries.
const KEYWORDS = [
  // Foreigner-popular neighborhoods
  "성수 카페",
  "연남동",
  "익선동",
  "한남동",
  "망원동",
  "을지로",
  "서촌",
  "북촌",
  // Anchors in our popular_stations.json
  "서울숲 카페",
  "한강공원 자전거",
  // Cultural/event terms
  "서울 전시 추천",
  "서울 축제 5월",
  "서울 팝업스토어",
  // Foreign tourist filter cues
  "외국인 관광객 서울",
] as const;

const PER_QUERY = 10;
const SORT = "date";

interface ProxyItem {
  rank: number;
  title: string;
  description: string;
  link: string;
  original_link: string;
  pub_date: string;
  pub_date_iso: string;
  source: string;
}
interface ProxyResponse {
  items: ProxyItem[];
}

function hashId(input: string): string {
  // Tiny FNV-1a — enough to dedupe across keyword overlaps.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

async function searchOne(q: string): Promise<ProxyItem[]> {
  const u = new URL(PROXY_BASE);
  u.searchParams.set("q", q);
  u.searchParams.set("display", String(PER_QUERY));
  u.searchParams.set("sort", SORT);
  const res = await fetch(u, {
    headers: {
      "User-Agent": "seoulRide/0.1",
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NAVER proxy ${res.status} for "${q}": ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as ProxyResponse;
  return json?.items ?? [];
}

async function main() {
  const fetched_at = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawArticle[] = [];

  for (const q of KEYWORDS) {
    console.log(`⟳ "${q}"…`);
    try {
      const items = await searchOne(q);
      for (const it of items) {
        // Stable id from canonical URL
        const id = `naver_${hashId(it.original_link || it.link)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const body = it.description || ""; // proxy already strips HTML entities
        out.push({
          id,
          source: "naver_news",
          url: it.original_link || it.link,
          title: it.title,
          body,
          snippet: body.slice(0, 280),
          published_at: it.pub_date_iso || fetched_at,
          fetched_at,
          metadata: {
            keyword: q,
            naver_link: it.link,
            rank_within_query: it.rank,
          },
        });
      }
      // ~1 req/sec to stay polite to the proxy
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      console.warn(`  ! "${q}":`, e instanceof Error ? e.message : e);
    }
  }

  const outDir = path.join(PATHS.workspace, "05_trending", "raw");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "naver_news.json");
  await fs.writeFile(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n✓ ${out.length} unique items across ${KEYWORDS.length} keywords → ${outFile}`);
}

main().catch((e) => {
  console.error("✗ fetch_naver_news failed:", e);
  process.exit(1);
});
