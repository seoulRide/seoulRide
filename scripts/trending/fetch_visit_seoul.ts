/**
 * Visit Seoul fetcher — scrapes the English Editor's Picks listing and a
 * sample of the linked detail pages. Visit Seoul has no public RSS, so we
 * parse the rendered HTML with cheerio.
 *
 *   pnpm trending:fetch:visit-seoul
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { PATHS } from "../lib/env.ts";
import type { RawArticle } from "./types.ts";

const ROOT = "https://english.visitseoul.net";
const LISTINGS = [
  { url: `${ROOT}/editorspicks`, label: "editors-picks" },
  { url: `${ROOT}/exhibition-events`, label: "exhibition-events" },
];
const USER_AGENT = "seoulRide/0.1 (https://github.com/dev.hibi/seoulRide)";

interface ListingItem {
  href: string;
  title: string;
  excerpt: string;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Visit Seoul ${res.status} for ${url}`);
  }
  return res.text();
}

function parseListing(html: string, listingUrl: string): ListingItem[] {
  const $ = cheerio.load(html);
  const items: ListingItem[] = [];
  // Look for any anchor that links to a detail page. Both /editorspicks/{slug}/{id}
  // and /exhibition/{slug}/{id} share the same card layout.
  $("a").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(/^\/(editorspicks|exhibition|event|exhibition-events)\/[^/]+\/[A-Z0-9]+/);
    if (!m) return;
    const title = $(el).find(".title").first().text().trim();
    if (!title) return;
    const excerpt = $(el).find(".small-text").first().text().trim();
    items.push({ href, title, excerpt });
  });
  // Dedupe by href
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.href)) return false;
    seen.add(it.href);
    return true;
  });
}

function extractDetailBody(html: string): { body: string; published_at: string | null } {
  const $ = cheerio.load(html);
  // Strip script/style/noscript tags before extracting text — Visit Seoul
  // inlines large CSS blocks inside the article container.
  $("script, style, noscript").remove();

  // Visit Seoul detail pages put the article body inside .se-contents or .editor-content.
  const candidates = [
    $(".se-contents"),
    $(".editor-content"),
    $(".content_view"),
    $(".container-detail"),
    $("article"),
  ];
  let body = "";
  for (const c of candidates) {
    const text = c.text().replace(/\s+/g, " ").trim();
    if (text.length > body.length) body = text;
  }
  const dateRaw =
    $(".date").first().text().trim() ||
    $('meta[property="article:published_time"]').attr("content") ||
    null;
  return { body: body.slice(0, 4000), published_at: dateRaw };
}

async function main() {
  const fetched_at = new Date().toISOString();
  const out: RawArticle[] = [];

  for (const listing of LISTINGS) {
    console.log(`⟳ ${listing.label}…`);
    const html = await fetchHtml(listing.url);
    const items = parseListing(html, listing.url);
    console.log(`  · ${items.length} listing items`);

    // Cap detail-page fetches per listing to keep the run fast.
    const cap = 12;
    for (const item of items.slice(0, cap)) {
      const url = item.href.startsWith("http") ? item.href : `${ROOT}${item.href}`;
      try {
        const detailHtml = await fetchHtml(url);
        const { body, published_at } = extractDetailBody(detailHtml);
        const id = `visitseoul_${item.href.split("/").pop() ?? item.href}`;
        out.push({
          id,
          source: "visit_seoul",
          url,
          title: item.title,
          body,
          snippet: item.excerpt || body.slice(0, 280),
          published_at: published_at && !Number.isNaN(Date.parse(published_at))
            ? new Date(published_at).toISOString()
            : fetched_at,
          fetched_at,
          metadata: { listing: listing.label },
        });
        await new Promise((r) => setTimeout(r, 350)); // gentle pace
      } catch (e) {
        console.warn(`  ! skip ${item.href}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  const outDir = path.join(PATHS.workspace, "05_trending", "raw");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "visit_seoul.json");
  await fs.writeFile(outFile, JSON.stringify(out, null, 2), "utf8");
  console.log(`\n✓ ${out.length} articles → ${outFile}`);
}

main().catch((e) => {
  console.error("✗ fetch_visit_seoul failed:", e);
  process.exit(1);
});
