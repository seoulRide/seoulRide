import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

export async function loadEnv(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const file = path.join(ROOT, ".env.local");
  try {
    const txt = await fs.readFile(file, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // no .env.local — fall back entirely to process.env (CI path)
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v && !(k in out)) out[k] = v;
  }
  return out;
}

export const PATHS = {
  root: ROOT,
  raw: path.join(ROOT, "data/raw"),
  cache: path.join(ROOT, "data/cache"),
  workspace: path.join(ROOT, "_workspace"),
  mobileAssets: path.join(ROOT, "apps/mobile/assets/data"),
};

/**
 * Pipeline outputs live under `_workspace/...` locally but `_workspace/` is
 * gitignored, so they're absent in CI. The same JSONs are committed under
 * `apps/mobile/assets/data/` for the mobile bundle — use those as a CI
 * fallback. Map: workspace-relative path → mobile filename.
 */
const MOBILE_FALLBACK: Record<string, string> = {
  "02_analytics/popular_stations.json": "popular_stations.json",
  "03_curation/events_by_station.json": "events_by_station.json",
  "04_weather/forecast_by_gu.json": "forecast_by_gu.json",
};

export async function readWorkspaceText(rel: string): Promise<string> {
  try {
    return await fs.readFile(path.join(PATHS.workspace, rel), "utf8");
  } catch (e) {
    const fallback = MOBILE_FALLBACK[rel];
    if (!fallback) throw e;
    return fs.readFile(path.join(PATHS.mobileAssets, fallback), "utf8");
  }
}
