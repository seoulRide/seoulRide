/**
 * Common shape every fetcher in the trending pipeline emits.
 * Keeping it small + uniform so extract.ts can iterate without source-specific
 * branches (with one exception: NAVER 뉴스 carries Korean text and the
 * extractor adds a "tourist-relevance filter" prompt branch for it).
 */
export interface RawArticle {
  /** Unique within (source). e.g. Reddit post id, NAVER news link hash. */
  id: string;
  source: "reddit_seoul" | "reddit_korea" | "visit_seoul" | "naver_news";
  url: string;
  title: string;
  /** Body text. Empty string for link-only posts (Reddit `is_self === false`). */
  body: string;
  /** Optional short excerpt; falls back to first ~280 chars of `body` if absent. */
  snippet?: string;
  /** Source-published timestamp, ISO. Falls back to `fetched_at` if not parseable. */
  published_at: string;
  /** When we fetched it, ISO. */
  fetched_at: string;
  /** Source-specific extras (score, flair, author, etc.) — preserved for debugging. */
  metadata?: Record<string, unknown>;
}

export type RawSource = RawArticle["source"];
