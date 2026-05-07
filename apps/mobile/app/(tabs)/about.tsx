import { ScrollView, View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLang } from "../../src/lib/lang-store";
import { colors, font, space } from "../../src/lib/theme";

export default function AboutScreen() {
  const [lang] = useLang();
  const intro =
    lang === "ko"
      ? "외국인이 따릉이를 타고 어디로 가는지, 그 주변에 어떤 행사·먹을거리·날씨가 있는지를 한 화면에 모은 작은 가이드입니다."
      : "A small, opinionated guide for foreign visitors who want to explore Seoul on a Ttareungi (public bike).";
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>About seoulRide</Text>
        <Text style={styles.intro}>{intro}</Text>

        <Text style={styles.label}>{lang === "ko" ? "데이터 출처" : "Data sources"}</Text>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Item text="Bike rentals by foreigners — Seoul Open Data Plaza" />
          <Item text="Cultural events / public reservations — Seoul Open Data Plaza" />
          <Item text="Sejong Center performances — Seoul Open Data Plaza" />
          <Item text="Consumption / food activity — Seoul Open Data Plaza (estimate-based)" />
          <Item text="Weather forecast — KMA apihub (단기예보)" />
          <Item text="Map tiles — © OpenStreetMap (web fallback)" />
        </View>

        <Text style={styles.label}>{lang === "ko" ? "유의사항" : "Notes"}</Text>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          <Item text={lang === "ko" ? "음식 추천은 자치구 단위 추정 신호 + 큐레이션입니다 (개별 식당 정보 아님)." : "Food recommendations are directional — district-level signals plus curated category labels, not specific restaurants."} />
          <Item text={lang === "ko" ? "영문 데이터셋과 매칭되지 않은 행사 제목은 한국어 원어로 표시됩니다." : "Korean event titles without an English match are shown in their original Korean form (look for the small ⓘ)."} />
          <Item text={lang === "ko" ? "거리는 직선 거리입니다. 한강·언덕을 끼고 도는 길을 감안해 여유를 두세요." : "Distance is straight-line. Plan a few extra minutes for hills and rivers."} />
        </View>

        <Text style={styles.footer}>
          {lang === "ko" ? "공공데이터 기반. 서울시·기상청과 무관한 비공식 앱입니다." : "Built on public data. Not affiliated with the City of Seoul or KMA."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Item({ text }: { text: string }) {
  return <Text style={styles.li}>• {text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, paddingBottom: space["2xl"] * 2 },
  h1: { fontSize: font.size["2xl"], fontWeight: font.weight.semibold, color: colors.text },
  intro: { color: colors.textMuted, marginTop: space.sm, fontSize: font.size.base, lineHeight: 22 },
  label: {
    marginTop: space.xl,
    fontSize: font.size.xxs,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: font.weight.semibold,
  },
  li: { color: colors.text, fontSize: font.size.sm, lineHeight: 22 },
  footer: { marginTop: space["2xl"], color: colors.textSubtle, fontSize: font.size.xs, textAlign: "center" },
});
