import { View, Text, StyleSheet, Pressable } from "react-native";
import { Link } from "expo-router";
import type { PopularStation } from "../lib/types";
import { Lang, t } from "../lib/i18n";
import { Pill } from "./Pill";
import { colors, font, radius, space } from "../lib/theme";

export function StationCard({ station, lang, hero = false }: { station: PopularStation; lang: Lang; hero?: boolean }) {
  const gu = lang === "ko" ? station.gu_ko : (station.gu_en ?? station.gu_ko);
  return (
    <Link href={{ pathname: "/station/[id]", params: { id: station.station_no } }} asChild>
      <Pressable style={({ pressed }) => [
        styles.card,
        hero && styles.heroCard,
        pressed && { opacity: 0.7 },
      ]}>
        <View style={styles.row}>
          <View style={[styles.rankBubble, hero && styles.rankBubbleHero]}>
            <Text style={[styles.rankText, hero && styles.rankTextHero]}>{station.rank_overall}</Text>
          </View>
          <Pill>{gu}</Pill>
          <View style={{ flex: 1 }} />
          {station.is_outlier && <Pill tone="warn">{lang === "ko" ? "급증" : "Spike"}</Pill>}
        </View>
        <Text numberOfLines={hero ? 3 : 2} style={[styles.title, hero && styles.titleHero]}>
          {station.station_name_ko}
        </Text>
        <Text numberOfLines={1} style={styles.address}>{station.address}</Text>
        <View style={styles.row}>
          <Text style={[styles.count, hero && styles.countHero]}>{station.rent_total.toLocaleString()}</Text>
          <Text style={styles.unit}>{t("card.rentals", lang)}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
  },
  heroCard: {
    padding: space.xl,
    gap: space.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  rankBubble: {
    backgroundColor: colors.text,
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBubbleHero: {
    backgroundColor: colors.accent,
    width: 38,
    height: 38,
  },
  rankText: { color: "white", fontSize: font.size.xs, fontWeight: font.weight.bold },
  rankTextHero: { fontSize: font.size.base },
  title: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: 22,
  },
  titleHero: {
    fontSize: font.size["2xl"],
    lineHeight: 34,
  },
  address: { color: colors.textSubtle, fontSize: font.size.xs },
  count: {
    color: colors.text,
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    fontVariant: ["tabular-nums"],
  },
  countHero: {
    fontSize: font.size["3xl"],
  },
  unit: { color: colors.textMuted, fontSize: font.size.xs },
});
