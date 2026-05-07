import { ScrollView, View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { eventsByStation } from "../../src/lib/data";
import { EventCard } from "../../src/components/EventCard";
import { useLang } from "../../src/lib/lang-store";
import { colors, font, space } from "../../src/lib/theme";
import type { EventEntry } from "../../src/lib/types";

const ORDER: EventEntry["category"][] = ["festival", "concert", "exhibition", "performance", "experience"];

export default function EventsScreen() {
  const [lang] = useLang();

  // Flatten unique events; keep closest-distance occurrence
  const map = new Map<string, EventEntry>();
  for (const sid in eventsByStation) {
    for (const e of eventsByStation[sid]) {
      const exist = map.get(e.id);
      if (!exist || e.distance_km < exist.distance_km) map.set(e.id, e);
    }
  }
  const all = [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
  const byCat: Record<string, EventEntry[]> = {};
  for (const e of all) (byCat[e.category] ??= []).push(e);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>{lang === "ko" ? "행사 모아보기" : "All events"}</Text>
        <Text style={styles.sub}>
          {lang === "ko"
            ? `인기 대여소 주변 ${all.length}개의 행사를 카테고리별로 정리`
            : `${all.length} distinct events grouped by category, near the most foreigner-rented stations.`}
        </Text>
        {ORDER.map((cat) =>
          byCat[cat] ? (
            <View key={cat} style={{ marginTop: space.xl }}>
              <Text style={styles.sectionLabel}>{cat} · {byCat[cat].length}</Text>
              <View style={{ gap: space.sm }}>
                {byCat[cat].slice(0, 30).map((e) => <EventCard key={e.id} event={e} lang={lang} />)}
              </View>
            </View>
          ) : null,
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: space.lg, paddingBottom: space["2xl"] * 2 },
  h1: { fontSize: font.size["2xl"], fontWeight: font.weight.semibold, color: colors.text },
  sub: { color: colors.textMuted, marginTop: space.xs, fontSize: font.size.sm },
  sectionLabel: {
    marginBottom: space.md,
    fontSize: font.size.xxs,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    fontWeight: font.weight.semibold,
  },
});
