export const GU_KO_TO_EN: Record<string, string> = {
  "강남구": "Gangnam-gu", "강동구": "Gangdong-gu", "강북구": "Gangbuk-gu",
  "강서구": "Gangseo-gu", "관악구": "Gwanak-gu",   "광진구": "Gwangjin-gu",
  "구로구": "Guro-gu",   "금천구": "Geumcheon-gu", "노원구": "Nowon-gu",
  "도봉구": "Dobong-gu", "동대문구": "Dongdaemun-gu", "동작구": "Dongjak-gu",
  "마포구": "Mapo-gu",   "서대문구": "Seodaemun-gu", "서초구": "Seocho-gu",
  "성동구": "Seongdong-gu", "성북구": "Seongbuk-gu", "송파구": "Songpa-gu",
  "양천구": "Yangcheon-gu", "영등포구": "Yeongdeungpo-gu", "용산구": "Yongsan-gu",
  "은평구": "Eunpyeong-gu", "종로구": "Jongno-gu",  "중구": "Jung-gu",
  "중랑구": "Jungnang-gu",
};

export function toGuEn(ko: string | null | undefined): string | null {
  if (!ko) return null;
  return GU_KO_TO_EN[ko.trim()] ?? null;
}

export const URBAN_GU = new Set([
  "Jongno-gu", "Jung-gu", "Mapo-gu", "Yongsan-gu", "Gangnam-gu", "Seocho-gu",
]);
export const SUBURBAN_GU = new Set([
  "Gangseo-gu", "Dobong-gu", "Nowon-gu", "Eunpyeong-gu", "Jungnang-gu",
]);

export function radiusForGu(guEn: string | null): number {
  if (!guEn) return 1.0;
  if (URBAN_GU.has(guEn)) return 0.7;
  if (SUBURBAN_GU.has(guEn)) return 1.5;
  return 1.0;
}
