import { promises as fs } from "node:fs";
import path from "node:path";
import { PATHS } from "./env.ts";

const PAGE = 1000;
const BASE = "http://openapi.seoul.go.kr:8088";

export interface FetchOpts {
  service: string;
  args?: string[];
  apiKey: string;
  refresh?: boolean;
  maxRows?: number;
}

interface PageResult {
  rows: any[];
  total: number;
}

/** 서울 OpenAPI는 2016년 버전 Jetty(9.2.19)로 운영되어 가끔 connection을
 *  못 받는다. 한 번 실패하면 ETL 전체가 죽으므로 3회 지수 backoff 재시도.
 *  application-level 에러(잘못된 키 등 INFO-1xx)는 즉시 throw — 재시도 무의미. */
async function fetchPage(
  service: string,
  apiKey: string,
  start: number,
  end: number,
  args: string[],
): Promise<PageResult> {
  const segments = [apiKey, "json", service, String(start), String(end), ...args];
  const url = `${BASE}/${segments.join("/")}`;
  const MAX_ATTEMPTS = 3;
  const CONNECT_TIMEOUT_MS = 30_000;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "seoulRide/0.1" },
        signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`${service} HTTP ${res.status}`);
      const data: any = await res.json();
      const root = data?.[service];
      if (!root) {
        if (data?.RESULT?.CODE === "INFO-200") return { rows: [], total: 0 };
        throw new Error(`Unexpected payload for ${service}: ${JSON.stringify(data).slice(0, 200)}`);
      }
      const code: string | undefined = root.RESULT?.CODE;
      if (code && !code.startsWith("INFO-000")) {
        if (code === "INFO-200") return { rows: [], total: 0 };
        // 키 무효(INFO-100), 정책 위반(ERROR-3xx) 등은 재시도해도 답 안 바뀜.
        throw new Error(`${service}: ${code} ${root.RESULT?.MESSAGE ?? ""}`);
      }
      return { rows: root.row ?? [], total: root.list_total_count ?? 0 };
    } catch (err) {
      lastErr = err;
      const msg = (err as Error).message ?? String(err);
      // 영구 에러(잘못된 키 / 정책 위반)도 동일하게 재시도하지만 3회로 제한 —
      // 분류 로직 복잡도 늘리는 것보다 단순한 게 안전.
      if (attempt === MAX_ATTEMPTS) break;
      const waitMs = 5_000 * 2 ** (attempt - 1); // 5s, 10s, 20s
      console.warn(`  [retry] ${service} ${start}-${end} attempt ${attempt}/${MAX_ATTEMPTS} failed (${msg}) — waiting ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

export async function fetchAll(opts: FetchOpts): Promise<any[]> {
  const cacheDir = path.join(PATHS.cache, "seoul");
  await fs.mkdir(cacheDir, { recursive: true });
  const argsKey = (opts.args ?? []).join("_") || "all";
  const cacheFile = path.join(cacheDir, `${opts.service}_${argsKey}.json`);
  if (!opts.refresh) {
    try {
      const stat = await fs.stat(cacheFile);
      const ageMs = Date.now() - stat.mtimeMs;
      if (ageMs < 24 * 3600 * 1000) {
        const txt = await fs.readFile(cacheFile, "utf8");
        const arr = JSON.parse(txt);
        console.log(`  [cache] ${opts.service} ← ${arr.length} rows`);
        return arr;
      }
    } catch {}
  }

  const collected: any[] = [];
  let start = 1;
  let totalReported = -1;
  while (true) {
    const end = start + PAGE - 1;
    const { rows, total } = await fetchPage(opts.service, opts.apiKey, start, end, opts.args ?? []);
    collected.push(...rows);
    if (totalReported < 0) totalReported = total;
    if (rows.length < PAGE) break;
    if (opts.maxRows && collected.length >= opts.maxRows) break;
    if (collected.length >= total && total > 0) break;
    start += PAGE;
    if (start > 50000) break; // safety
  }
  await fs.writeFile(cacheFile, JSON.stringify(collected), "utf8");
  console.log(`  [fetch] ${opts.service} → ${collected.length} rows (total reported ${totalReported})`);
  return collected;
}
