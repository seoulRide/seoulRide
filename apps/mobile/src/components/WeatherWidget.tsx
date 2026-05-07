import { View, Text, StyleSheet } from "react-native";
import type { WeatherForecast } from "../lib/types";
import { Lang, t } from "../lib/i18n";
import { colors, font, radius, rideScoreColor, space } from "../lib/theme";

export function WeatherWidget({ w, lang }: { w: WeatherForecast; lang: Lang }) {
  const dot = rideScoreColor(w.now.ride_score);
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.gu}>{lang === "ko" ? w.gu_ko : w.gu_en}</Text>
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </View>
      <View style={styles.scoreRow}>
        <Text style={styles.score}>{w.now.ride_score}</Text>
        <Text style={styles.scoreOf}>/ 100</Text>
      </View>
      <Text style={styles.label}>{w.now.label_en}</Text>
      <View style={styles.metricsRow}>
        <Text style={styles.metric}>{w.now.temp_c ?? "?"}°C</Text>
        <Text style={styles.metric}>💧 {w.now.rain_prob ?? 0}%</Text>
        <Text style={styles.metric}>🌬 {w.now.wind_ms ?? 0} m/s</Text>
      </View>
      {w.mocked && (
        <Text style={styles.mockedNote}>{t("weather.mocked", lang)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
    gap: 4,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gu: { color: colors.textMuted, fontSize: font.size.sm },
  dot: { height: 8, width: 8, borderRadius: 999 },
  scoreRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 },
  score: { fontSize: font.size["3xl"], fontWeight: font.weight.bold, color: colors.text, fontVariant: ["tabular-nums"] },
  scoreOf: { color: colors.textMuted, fontSize: font.size.xs },
  label: { fontSize: font.size.sm, color: colors.text, marginTop: 2 },
  metricsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: space.md },
  metric: { color: colors.textMuted, fontSize: font.size.xs, fontVariant: ["tabular-nums"] },
  mockedNote: { color: colors.warn, fontSize: font.size.xxs, marginTop: space.sm, lineHeight: 16 },
});
