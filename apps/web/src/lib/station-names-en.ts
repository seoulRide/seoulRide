// English-language display names for the 50 popular bike-share stations.
// Static dict — same pattern as food-blurbs.json. The pipeline data has
// `station_name_en: null` for all stations because the 따릉이 master CSV
// only ships Korean. When that changes upstream, this dict can shrink to
// override-only.
export const STATION_NAMES_EN: Record<string, string> = {
  "ST-1199": "Seoul Forest Management Office",
  "ST-207": "Sogang Univ. Station Exit 2",
  "ST-502": "Seongnae-dong 434-28",
  "ST-474": "Bulgwang Station Exit 8",
  "ST-870": "Guro-gu Gaebong-dong 202-42",
  "ST-2525": "Jeo-dong 2-ga 22-1",
  "ST-2217": "Hongje-dong 295-33",
  "ST-825": "Behind Hansung Univ. Station Exit 6",
  "ST-1210": "Beside Gileum 8-gol Children's Park",
  "ST-387": "Gwangnaru Station Exit 3",
  "ST-113": "Gwangyang Middle School",
  "ST-3010": "Banpo Hangang Park Entrance (Banpo-daero 316)",
  "ST-311": "Cheonghak Building (Omok-ro 344)",
  "ST-565": "Seongbuk-gu Jongam-dong 12-33",
  "ST-369": "Near Cheonggye 8-ga Intersection",
  "ST-475": "Near Yeonsinnae Station Exit 3",
  "ST-212": "Gajwa Happy Housing (Seongam-ro 28)",
  "ST-211": "Mapo-gu Office Station",
  "ST-249": "Near Hanyang Univ. Back Gate Station",
  "ST-312": "Southern District Court Intersection",
  "ST-314": "Sinjeong 3-dong Community Center",
  "ST-321": "Korea SGI Yangcheon Cultural Center",
  "ST-2214": "DMC Raemian e-Pyeonhansesang (Susaek-ro 100)",
  "ST-272": "Sinseol-dong Station Exit 10",
  "ST-106": "Beside E-Mart Bus Stop",
  "ST-3407": "Mok-dong 413-3",
  "ST-353": "Dongnimmun Station Exit 4",
  "ST-3415": "Gangseo Agricultural Wholesale Market",
  "ST-393": "Dapsimni Elementary (beside Hyundai Market)",
  "ST-2219": "SK Rechemble (Seosomun-ro 45)",
  "ST-181": "In front of SK Seorin Building",
  "ST-510": "Banghwa-dong 614-287",
  "ST-853": "Jungnang-gu Muk-dong 20-3",
  "ST-315": "Seoul Immigration Office",
  "ST-182": "Gwanghwamun Citizen's Open Plaza",
  "ST-585": "Sinnae-dong Medical Care Housing",
  "ST-359": "Seongdong-Gwangjin Education Support Office",
  "ST-329": "Geumho Mansion (Seobinggo-dong)",
  "ST-3410": "Eungam-ro 131",
  "ST-111": "Beside Ttukseom Station Exit 5",
  "ST-114": "Gwangjin Medical",
  "ST-609": "Nowon-gu Sanggye-dong 37-7",
  "ST-302": "Dorim Credit Union",
  "ST-829": "Hwagok Station Exit 6",
  "ST-108": "Beside Seoul Forest Station Exit 4",
  "ST-209": "World Cup-ro 25-gil 202",
  "ST-322": "Mokwol Park",
  "ST-347": "Jeongmyeong Academy",
  "ST-398": "Dapsimni Station Exit 1",
  "ST-119": "Sejongno Park",
};

/** Display the station name in the requested language. Falls back to the
 *  English dict, then to the Korean name shipped with the data. */
export function stationDisplayName(
  stationNo: string,
  koName: string,
  enNameFromData: string | null | undefined,
  lang: "ko" | "en",
): string {
  if (lang === "ko") return koName;
  return enNameFromData ?? STATION_NAMES_EN[stationNo] ?? koName;
}
