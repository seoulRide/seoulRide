/**
 * Reddit fetcher (anonymous JSON endpoint — no OAuth needed).
 *
 * Pulls /r/seoul + /r/korea top-of-day and hot-of-day, dedupes, filters out
 * removed/NSFW posts, and writes a uniform RawArticle[] to
 * _workspace/05_trending/raw/reddit.json.
 *
 *   pnpm trending:fetch:reddit
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS } from "../lib/env.ts";
import type { RawArticle, RawSource } from "./types.ts";

const USER_AGENT = "seoulRide/0.1 (https://github.com/dev.hibi/seoulRide)";
const SUBS: Array<{ name: "seoul" | "korea"; source: RawSource }> = [
  { name: "seoul", source: "reddit_seoul" },
  { name: "korea", source: "reddit_korea" },
];
const SORTS = ["top", "hot"] as const;
const PER_PAGE = 25;
const T_TOP = "day"; // "top" only — "hot" doesn't take a t window

interface RedditChild {
  data: {
    id: string;
    title: string;
    selftext: string;
    permalink: string;
    url: string;
    score: number;
    num_comments: number;
    created_utc: number;
    is_self: boolean;
    over_18: boolean;
    stickied: boolean;
    link_flair_text: string | null;
    author: string;
    subreddit: string;
  };
}

interface RedditListing {
  data: { children: RedditChild[] };
}

async function fetchListing(sub: string, sort: string): Promise<RedditChild[]> {
  const u = new URL(`https://www.reddit.com/r/${sub}/${sort}.json`);
  u.searchParams.set("limit", String(PER_PAGE));
  if (sort === "top") u.searchParams.set("t", T_TOP);
  u.searchParams.set("raw_json", "1");
  const res = await fetch(u, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Reddit ${res.status} for ${u.toString()}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as RedditListing;
  return json?.data?.children ?? [];
}

function isInteresting(c: RedditChild): boolean {
  const d = c.data;
  if (d.over_18) return false;
  if (d.stickied) return false;
  // mod-removed posts
  if (d.selftext === "[removed]" || d.selftext === "[deleted]") return false;
  // crosspost / non-content meta
  if (d.title.startsWith("Daily Discussion") || d.title.startsWith("Weekly")) return false;
  return true;
}

function toArticle(c: RedditChild, source: RawSource, fetched_at: string): RawArticle {
  const d = c.data;
  const body = (d.selftext || "").trim();
  const snippet = body.length > 0
    ? body.slice(0, 280)
    : `[link post] ${d.url}`;
  return {
    id: `reddit_${d.id}`,
    source,
    url: `https://www.reddit.com${d.permalink}`,
    title: d.title,
    body,
    snippet,
    published_at: new Date(d.created_utc * 1000).toISOString(),
    fetched_at,
    metadata: {
      score: d.score,
      num_comments: d.num_comments,
      author: d.author,
      flair: d.link_flair_text ?? null,
      subreddit: d.subreddit,
      external_link: d.is_self ? null : d.url,
    },
  };
}

async function main() {
  const fetched_at = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawArticle[] = [];
  let totalFetched = 0;

  for (const sub of SUBS) {
    for (const sort of SORTS) {
      console.log(`⟳ /r/${sub.name}/${sort}…`);
      const children = await fetchListing(sub.name, sort);
      totalFetched += children.length;
      for (const c of children) {
        if (!isInteresting(c)) continue;
        const article = toArticle(c, sub.source, fetched_at);
        if (seen.has(article.id)) continue;
        seen.add(article.id);
        out.push(article);
      }
      // Reddit suggests ~1s pause between requests for unauthenticated calls.
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  const outDir = path.join(PATHS.workspace, "05_trending", "raw");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "reddit.json");
  await fs.writeFile(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n✓ ${out.length} unique posts (filtered from ${totalFetched}) → ${outFile}`);
}

main().catch((e) => {
  console.error("✗ fetch_reddit failed:", e);
  process.exit(1);
});
