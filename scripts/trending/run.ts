/**
 * Orchestrator for the daily trending pipeline. Runs every step in order:
 *   fetch_reddit + fetch_visit_seoul + fetch_naver_news (parallel)
 *   → extract → aggregate → synthesize
 *
 *   pnpm trending:run
 *
 * Each step is run as a child tsx process so a failure in one fetcher
 * (e.g. Visit Seoul HTML structure changed) doesn't kill the rest.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function run(script: string): Promise<{ ok: boolean; code: number }> {
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", "tsx", path.join("scripts/trending", script)], {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => resolve({ ok: code === 0, code: code ?? 1 }));
  });
}

async function parallel(scripts: string[]): Promise<boolean> {
  const results = await Promise.all(scripts.map(run));
  let allOk = true;
  for (const [i, r] of results.entries()) {
    if (!r.ok) {
      console.error(`✗ ${scripts[i]} exited with code ${r.code} — continuing without it`);
      allOk = false;
    }
  }
  return allOk;
}

async function sequential(script: string): Promise<boolean> {
  const r = await run(script);
  if (!r.ok) console.error(`✗ ${script} exited with code ${r.code}`);
  return r.ok;
}

async function main() {
  console.log("=== Phase 1: fetchers (parallel) ===");
  await parallel(["fetch_reddit.ts", "fetch_visit_seoul.ts", "fetch_naver_news.ts"]);

  console.log("\n=== Phase 2: extract (Solar Pro 2) ===");
  if (!(await sequential("extract.ts"))) process.exit(1);

  console.log("\n=== Phase 3: aggregate (place ↔ station match) ===");
  if (!(await sequential("aggregate.ts"))) process.exit(1);

  console.log("\n=== Phase 4: synthesize (Solar Pro 2) ===");
  if (!(await sequential("synthesize.ts"))) process.exit(1);

  console.log("\n✓ trending pipeline complete");
}

main().catch((e) => {
  console.error("✗ pipeline failed:", e);
  process.exit(1);
});
