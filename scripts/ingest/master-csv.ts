import { promises as fs } from "node:fs";
import path from "node:path";
import iconv from "iconv-lite";
import { PATHS } from "../lib/env.ts";
import { toGuEn } from "../lib/gu-mapping.ts";

async function main() {
  const csvPath = path.join(PATHS.raw, "서울시 공공자전거 따릉이 대여소 마스터 정보.csv");
  const buf = await fs.readFile(csvPath);
  // try utf-8 first, fall back to cp949
  let text: string;
  try {
    text = buf.toString("utf8");
    if (text.includes("�")) throw new Error("utf8 has replacement chars");
  } catch {
    text = iconv.decode(buf, "cp949");
  }
  if (text.includes("�")) text = iconv.decode(buf, "cp949");

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines[0]);
  console.log("header:", header);

  const idxOf = (...keys: string[]) => {
    for (const k of keys) {
      const i = header.findIndex((h) => h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };

  const idxNo   = idxOf("대여소_ID", "대여소번호", "대여소 ID", "STATION_ID");
  const idxAddr1 = idxOf("주소1");
  const idxAddr2 = idxOf("주소2");
  const idxName = idxOf("대여소명", "대여소 명", "STATION_NAME");
  const idxLat  = idxOf("위도", "LAT");
  const idxLng  = idxOf("경도", "LNG", "LON");
  const idxGu   = idxOf("자치구");

  let dropped = 0;
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 3) continue;
    const station_no_raw = (cols[idxNo] ?? "").trim();
    const lat = parseFloat(cols[idxLat] ?? "");
    const lng = parseFloat(cols[idxLng] ?? "");
    // 미설치/철거 대여소는 lat=0,lng=0
    if (!station_no_raw || !isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) {
      dropped++;
      continue;
    }
    const addr1 = (cols[idxAddr1] ?? "").trim();
    const addr2 = (cols[idxAddr2] ?? "").trim();
    const gu_ko = (idxGu >= 0 ? (cols[idxGu] ?? "").trim() : "") || guFromAddr(addr1);
    const station_name_ko =
      (idxName >= 0 ? (cols[idxName] ?? "").trim() : "") ||
      addr2 ||
      addr1.replace(/^서울특별시\s+\S+\s+/, "");
    rows.push({
      station_no: station_no_raw,
      station_no_norm: station_no_raw.replace(/[^0-9]/g, ""),
      station_name_ko,
      station_name_en: null,
      lat, lng,
      gu_ko,
      gu_en: toGuEn(gu_ko),
      address: addr1 + (addr2 ? " " + addr2 : ""),
    });
  }
  console.log(`dropped ${dropped} rows (no coords / no id)`);

  const out = path.join(PATHS.workspace, "01_ingest", "station_master.normalized.json");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(rows), "utf8");
  console.log(`station_master → ${rows.length} rows`);
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function guFromAddr(addr: string): string {
  // \b doesn't anchor reliably between Korean chars and whitespace; use lookahead for whitespace/end
  const m = addr.match(/(\S{1,4}구)(?=\s|$)/);
  return m ? m[1] : "";
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
