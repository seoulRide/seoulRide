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

async function fetchPage(
  service: string,
  apiKey: string,
  start: number,
  end: number,
  args: string[],
): Promise<PageResult> {
  const segments = [apiKey, "json", service, String(start), String(end), ...args];
  const url = `${BASE}/${segments.join("/")}`;
  const res = await fetch(url, { headers: { "User-Agent": "seoulRide/0.1" } });
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
    throw new Error(`${service}: ${code} ${root.RESULT?.MESSAGE ?? ""}`);
  }
  return { rows: root.row ?? [], total: root.list_total_count ?? 0 };
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
