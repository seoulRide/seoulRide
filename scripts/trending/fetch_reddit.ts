/**
 * Reddit fetcher via Atom RSS (no OAuth, no app registration needed).
 *
 * Reddit blocks the anonymous JSON endpoint from datacenter IPs (e.g.
 * GitHub Actions runners) but the .rss endpoints stay open. Pulls
 * /r/seoul + /r/korea top-of-day and hot, parses Atom XML with cheerio
 * (xmlMode), and writes a uniform RawArticle[] to
 * _workspace/05_trending/raw/reddit.json.
 *
 *   pnpm trending:fetch:reddit
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { PATHS } from "../lib/env.ts";
import type { RawArticle, RawSource } from "./types.ts";

const USER_AGENT = "seoulRide/0.1 (https://github.com/seoulRide/seoulRide)";

const FEEDS: Array<{ url: string; source: RawSource; label: string }> = [
  { url: "https://www.reddit.com/r/seoul/top/.rss?t=day", source: "reddit_seoul", label: "r/seoul top/day" },
  { url: "https://www.reddit.com/r/seoul/.rss",            source: "reddit_seoul", label: "r/seoul hot" },
  { url: "https://www.reddit.com/r/korea/top/.rss?t=day", source: "reddit_korea", label: "r/korea top/day" },
  { url: "https://www.reddit.com/r/korea/.rss",            source: "reddit_korea", label: "r/korea hot" },
];

interface Parsed {
  id: string;          // "t3_xxxx" → strip to xxxx
  title: string;
  link: string;
  author: string;
  updated: string;     // ISO
  bodyHtml: string;    // entry content (HTML-escaped Reddit table)
}

async function fetchFeed(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/atom+xml",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Reddit RSS ${res.status} for ${url}: ${body.slice(0, 200)}`);
  }
  return res.text();
}

function parseFeed(xml: string): Parsed[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const out: Parsed[] = [];
  $("entry").each((_i, el) => {
    const title = $(el).find("> title").text().trim();
    if (!title) return;
    // Reddit posts use link[rel=alternate] for the post URL; fall back to first <link>.
    let link = $(el).find("> link[rel='alternate']").attr("href") ?? "";
    if (!link) link = $(el).find("> link").first().attr("href") ?? "";
    const id = $(el).find("> id").text().replace(/^t3_/, "");
    const author = $(el).find("> author > name").text().replace(/^\/u\//, "");
    const updated = $(el).find("> updated").text();
    const bodyHtml = $(el).find("> content").first().text();
    if (!id || !link) return;
    out.push({ id, title, link, author, updated, bodyHtml });
  });
  return out;
}

/** Extract just the post body text from Reddit's RSS content table. */
function extractSelftext(bodyHtml: string): string {
  if (!bodyHtml) return "";
  const $ = cheerio.load(bodyHtml);
  // Reddit wraps the post body inside <div class="md">. Anything outside is
  // boilerplate ("submitted by …", thumbnail, comment count, etc).
  const md = $("div.md").first();
  if (md.length === 0) return "";
  return md.text().replace(/\s+/g, " ").trim();
}

function isInteresting(title: string, body: string): boolean {
  if (!title) return false;
  if (/^(daily|weekly) (discussion|thread|free)/i.test(title)) return false;
  // Reddit removed-content sentinels
  if (body === "[removed]" || body === "[deleted]") return false;
  return true;
}

async function main() {
  const fetched_at = new Date().toISOString();
  const seen = new Set<string>();
  const out: RawArticle[] = [];
  let totalParsed = 0;

  for (const feed of FEEDS) {
    try {
      console.log(`⟳ ${feed.label}…`);
      const xml = await fetchFeed(feed.url);
      const entries = parseFeed(xml);
      totalParsed += entries.length;
      for (const e of entries) {
        const body = extractSelftext(e.bodyHtml);
        if (!isInteresting(e.title, body)) continue;
        const articleId = `reddit_${e.id}`;
        if (seen.has(articleId)) continue;
        seen.add(articleId);
        const snippet = body.length > 0
          ? body.slice(0, 280)
          : `[link post] ${e.link}`;
        out.push({
          id: articleId,
          source: feed.source,
          url: e.link,
          title: e.title,
          body,
          snippet,
          published_at: e.updated || fetched_at,
          fetched_at,
          metadata: {
            author: e.author,
            feed: feed.label,
          },
        });
      }
      // Polite pause between feeds.
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      console.warn(`  ! ${feed.label}:`, e instanceof Error ? e.message : e);
    }
  }

  const outDir = path.join(PATHS.workspace, "05_trending", "raw");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "reddit.json");
  await fs.writeFile(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n✓ ${out.length} unique posts (parsed ${totalParsed} entries) → ${outFile}`);
}

main().catch((e) => {
  console.error("✗ fetch_reddit failed:", e);
  process.exit(1);
});
