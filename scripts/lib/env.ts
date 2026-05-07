import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

export async function loadEnv(): Promise<Record<string, string>> {
  const file = path.join(ROOT, ".env.local");
  try {
    const txt = await fs.readFile(file, "utf8");
    const out: Record<string, string> = {};
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

export const PATHS = {
  root: ROOT,
  raw: path.join(ROOT, "data/raw"),
  cache: path.join(ROOT, "data/cache"),
  workspace: path.join(ROOT, "_workspace"),
};
