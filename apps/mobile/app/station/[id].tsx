import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getStationById, getEventsForStation, getWeatherForGu } from "../../src/lib/data";
import { EventCard } from "../../src/components/EventCard";
import { WeatherWidget } from "../../src/components/WeatherWidget";
import { useLang } from "../../src/lib/lang-store";
import { t } from "../../src/lib/i18n";
import { colors, font, space } from "../../src/lib/theme";

export default function StationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lang] = useLang();
  const router = useRouter();
  const station = getStationById(id);

  if (!station) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={{ padding: space.lg }}>
          <Text style={{ fontSize: font.size.lg, color: colors.text }}>Station not found</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: space.md }}>
            <Text style={{ color: colors.accent }}>← Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const events = getEventsForStation(station.station_no);
  const weather = getWeatherForGu(station.gu_en);
  const gu = lang === "ko" ? station.gu_ko : station.gu_en ?? station.gu_ko;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← {lang === "ko" ? "돌아가기" : "Back"}</Text>
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.metaText}>#{station.rank_overall} · {gu}</Text>
          {station.is_outlier && <Text style={styles.spike}>· spike</Text>}
        </View>
        <Text style={styles.title}>{station.station_name_ko}</Text>
        <Text style={styles.address}>{station.address}</Text>

        {weather && (
          <View style={{ marginTop: space.xl }}>
            <Text style={styles.label}>{t("section.weather", lang)}</Text>
            <View style={{ marginTop: space.sm }}>
              <WeatherWidget w={weather} lang={lang} />
            </View>
          </View>
        )}

        <View style={{ marginTop: space.xl }}>
          <Text style={styles.label}>{t("section.events_nearby", lang)} ({events.length})</Text>
          {events.length === 0 ? (
            <Text style={styles.empty}>{t("empty.no_events", lang)}</Text>
          ) : (
            <View style={{ gap: space.sm, marginTop: space.sm }}>
              {events.slice(0, 20).map((e) => <EventCard key={e.id} event={e} lang={lang} />)}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, paddingBottom: space["2xl"] * 2 },
  backBtn: { alignSelf: "flex-start", marginBottom: space.md },
  backText: { color: colors.accent, fontSize: font.size.sm, fontWeight: font.weight.medium },
  headerMeta: { flexDirection: "row", gap: space.xs },
  metaText: {
    fontSize: font.size.xxs,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: font.weight.semibold,
  },
  spike: {
    fontSize: font.size.xxs,
    color: colors.warn,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: font.weight.semibold,
  },
  title: {
    fontSize: font.size["3xl"],
    fontWeight: font.weight.semibold,
    color: colors.text,
    marginTop: space.xs,
    lineHeight: 38,
  },
  address: { color: colors.textMuted, marginTop: 4, fontSize: font.size.sm },
  statRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm, marginTop: space.lg },
  stat: { fontSize: font.size["4xl"], fontWeight: font.weight.bold, color: colors.text, fontVariant: ["tabular-nums"] },
  statUnit: { color: colors.textMuted, fontSize: font.size.sm },
  label: {
    fontSize: font.size.xxs,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: font.weight.semibold,
  },
  empty: { color: colors.textMuted, fontSize: font.size.sm, marginTop: space.sm },
});
