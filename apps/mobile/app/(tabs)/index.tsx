import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { popularStations, forecastByGu } from "../../src/lib/data";
import { StationCard } from "../../src/components/StationCard";
import { WeatherWidget } from "../../src/components/WeatherWidget";
import { SeoulMap } from "../../src/components/SeoulMap";
import { useLang } from "../../src/lib/lang-store";
import { t } from "../../src/lib/i18n";
import { colors, font, radius, space } from "../../src/lib/theme";

export default function HomeScreen() {
  const [lang, setLang] = useLang();
  const top = popularStations[0];
  const featuredWeather = top?.gu_en ? forecastByGu[top.gu_en] : Object.values(forecastByGu)[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>
            <Text style={{ color: colors.accent }}>seoul</Text>
            <Text>Ride</Text>
          </Text>
          <Pressable onPress={() => setLang(lang === "en" ? "ko" : "en")} style={styles.langButton}>
            <Text style={styles.langText}>{(lang === "en" ? "ko" : "en").toUpperCase()}</Text>
          </Pressable>
        </View>

        <View style={styles.intro}>
          <Text style={styles.h1}>{t("home.intro_h1", lang)}</Text>
          <Text style={styles.sub}>{t("home.intro_sub", lang)}</Text>
        </View>

        {featuredWeather && (
          <View style={{ marginTop: space.lg }}>
            <WeatherWidget w={featuredWeather} lang={lang} />
          </View>
        )}

        <Text style={styles.sectionLabel}>{t("section.popular", lang)}</Text>
        <SeoulMap stations={popularStations} lang={lang} />

        <Text style={styles.sectionLabel}>Top {Math.min(popularStations.length, 12)}</Text>
        <View style={{ gap: space.md }}>
          <StationCard station={popularStations[0]} lang={lang} hero />
          {popularStations.slice(1, 12).map((s) => (
            <StationCard key={s.station_no} station={s} lang={lang} />
          ))}
        </View>

        <Text style={styles.footer}>{t("footer.sources", lang)}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, paddingBottom: space["2xl"] * 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: font.size.xl, fontWeight: font.weight.bold, color: colors.text },
  langButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  langText: { fontSize: font.size.xxs, fontWeight: font.weight.semibold, letterSpacing: 0.6, color: colors.textMuted },
  intro: { marginTop: space.xl, gap: space.sm },
  h1: { fontSize: font.size["3xl"], fontWeight: font.weight.semibold, color: colors.text, lineHeight: 38 },
  sub: { fontSize: font.size.base, color: colors.textMuted, lineHeight: 22 },
  sectionLabel: {
    marginTop: space.xl,
    marginBottom: space.md,
    fontSize: font.size.xxs,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: font.weight.semibold,
  },
  footer: {
    marginTop: space["2xl"],
    color: colors.textSubtle,
    fontSize: font.size.xs,
    textAlign: "center",
  },
});
