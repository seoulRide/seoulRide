import { View, Text, StyleSheet } from "react-native";
import type { FoodEntry } from "../lib/types";
import { Lang } from "../lib/i18n";
import { Pill } from "./Pill";
import { colors, font, radius, space } from "../lib/theme";

export function FoodCard({ food, lang }: { food: FoodEntry; lang: Lang }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pill>{lang === "ko" ? food.gu_ko : food.gu_en ?? food.gu_ko}</Pill>
        <Text style={styles.estimate}>est.</Text>
      </View>
      {food.top_categories.slice(0, 2).map((c) => (
        <View key={c.category} style={styles.category}>
          <Text style={styles.label}>{lang === "ko" ? c.label_ko : c.label_en}</Text>
          <Text style={styles.blurb}>{c.blurb_en}</Text>
        </View>
      ))}
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
    gap: space.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  estimate: { color: colors.textSubtle, fontSize: font.size.xxs, textTransform: "uppercase", letterSpacing: 0.4 },
  category: { gap: 4 },
  label: { fontSize: font.size.base, fontWeight: font.weight.semibold, color: colors.text },
  blurb: { fontSize: font.size.sm, color: colors.textMuted, lineHeight: 20 },
});
