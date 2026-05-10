import { promises as fs } from "node:fs";
import path from "node:path";
import { loadEnv, PATHS } from "../lib/env.ts";
import { fetchAll } from "../lib/seoul-api.ts";

const SERVICES = [
  { service: "cycleForeignerRentMonthInfo", maxRows: 30000 },
  { service: "culturalEventInfo",           maxRows: 5000 },
  { service: "ListPublicReservationCulture", maxRows: 5000 },
  { service: "ListPublicReservationEnglish", maxRows: 5000 },
  { service: "SJWPerform",                   maxRows: 3000 },
] as const;

async function main() {
  const env = await loadEnv();
  const apiKey = env.SEOUL_OPEN_API_KEY || "sample";
  if (apiKey === "sample") {
    console.warn("⚠ SEOUL_OPEN_API_KEY not set — using sample key (5 rows per service)");
  }
  const refresh = process.argv.includes("--refresh");
  const outDir = path.join(PATHS.workspace, "01_ingest");
  await fs.mkdir(outDir, { recursive: true });

  const results = await Promise.allSettled(
    SERVICES.map(async ({ service, maxRows }) => {
      console.log(`→ ${service}`);
      const rows = await fetchAll({ service, apiKey, refresh, maxRows });
      const norm = normalize(service, rows);
      const file = path.join(outDir, `${service}.normalized.json`);
      await fs.writeFile(file, JSON.stringify(norm), "utf8");
      const summary = summarize(service, norm);
      await fs.writeFile(file.replace(".json", ".summary.md"), summary, "utf8");
      return { service, count: norm.length };
    }),
  );

  const ok = results.filter((r) => r.status === "fulfilled");
  const fail = results.filter((r) => r.status === "rejected");
  console.log(`\nIngest complete: ${ok.length} ok, ${fail.length} failed`);
  for (const r of results) {
    if (r.status === "fulfilled") console.log(`  ✓ ${r.value.service}: ${r.value.count}`);
    else console.error(`  ✗ ${(r.reason as Error).message}`);
  }
}

function normalize(service: string, rows: any[]): any[] {
  switch (service) {
    case "cycleForeignerRentMonthInfo":
      return rows.map((r) => ({
        ym: String(r.RNTL_YMD ?? "").replace(/-/g, "").slice(0, 6),
        station_no: String(r.RNTL_NO ?? ""),
        station_name: String(r.RNTL_NM ?? ""),
        rent_cnt: Number(r.RNTL_QTY ?? 0),
        rtn_cnt: Number(r.RTN_CNT ?? 0),
      }));
    case "culturalEventInfo":
      return rows.map((r) => ({
        codename: String(r.CODENAME ?? ""),
        gu_ko: String(r.GUNAME ?? ""),
        title: String(r.TITLE ?? ""),
        place: String(r.PLACE ?? ""),
        org_name: String(r.ORG_NAME ?? ""),
        use_target: String(r.USE_TRGT ?? ""),
        use_fee: String(r.USE_FEE ?? ""),
        program: String(r.PROGRAM ?? ""),
        org_link: String(r.ORG_LINK ?? r.HMPG_ADDR ?? ""),
        main_img: String(r.MAIN_IMG ?? ""),
        start_date: String(r.STRTDATE ?? "").slice(0, 19),
        end_date: String(r.END_DATE ?? r.ENDDATE ?? "").slice(0, 19),
        is_free: String(r.IS_FREE ?? ""),
        lng: parseFloat(r.LOT ?? "0") || null,
        lat: parseFloat(r.LAT ?? "0") || null,
      }));
    case "ListPublicReservationCulture":
    case "ListPublicReservationEnglish":
      return rows.map((r) => ({
        svcid: String(r.SVCID ?? ""),
        gubun: String(r.GUBUN ?? ""),
        max_class: String(r.MAXCLASSNM ?? ""),
        min_class: String(r.MINCLASSNM ?? ""),
        status: String(r.SVCSTATNM ?? ""),
        title: String(r.SVCNM ?? ""),
        place: String(r.PLACENM ?? ""),
        target: String(r.USETGTINFO ?? ""),
        url: String(r.SVCURL ?? ""),
        is_free: String(r.PAYATNM ?? ""),
        gu_ko: String(r.AREANM ?? ""),
        rcpt_start: String(r.RCPTBGNDT ?? ""),
        rcpt_end: String(r.RCPTENDDT ?? ""),
        start_date: String(r.SVCOPNBGNDT ?? "").slice(0, 19),
        end_date: String(r.SVCOPNENDDT ?? "").slice(0, 19),
        lng: parseFloat(r.X ?? "0") || null,
        lat: parseFloat(r.Y ?? "0") || null,
      }));
    case "SJWPerform":
      return rows.map((r) => ({
        kidx: String(r.PERFORM_IDX ?? ""),
        genre: String(r.GENRE_NAME ?? ""),
        title: String(r.TITLE ?? ""),
        place: String(r.PLACE_LIST ?? "세종문화회관"),
        start_date: String(r.START_DATE ?? "").slice(0, 19),
        end_date: String(r.END_DATE ?? "").slice(0, 19),
        runtime: String(r.RUNNING_TIME ?? ""),
        url: String(r.INFO_URL ?? ""),
        img: String(r.FILE_URL ?? ""),
        // 세종문화회관 좌표 고정
        lat: 37.5725,
        lng: 126.9760,
      }));
    default:
      return rows;
  }
}

function summarize(service: string, rows: any[]): string {
  const sample = rows.slice(0, 2);
  return `# ${service}\n\nrows: ${rows.length}\n\nfirst-2 sample:\n\n\`\`\`json\n${JSON.stringify(sample, null, 2)}\n\`\`\`\n`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
