import { View, Text, StyleSheet, Pressable, Linking, Alert } from "react-native";
import type { EventEntry } from "../lib/types";
import { Lang, t } from "../lib/i18n";
import { Pill } from "./Pill";
import { colors, font, radius, space } from "../lib/theme";

const CATEGORY_LABEL: Record<EventEntry["category"], { en: string; ko: string }> = {
  concert: { en: "Concert", ko: "콘서트" },
  exhibition: { en: "Exhibition", ko: "전시" },
  festival: { en: "Festival", ko: "축제" },
  performance: { en: "Performance", ko: "공연" },
  experience: { en: "Experience", ko: "체험" },
};

export function EventCard({ event, lang }: { event: EventEntry; lang: Lang }) {
  const title = lang === "ko" ? event.title_ko : event.title_en;
  const venue = lang === "ko" ? event.venue_ko : event.venue_en;
  const fallback = event.en_fallback === "ko_original" && lang === "en";
  const isFree = event.price === "Free";

  const onPress = async () => {
    if (!event.url) return;
    try {
      const can = await Linking.canOpenURL(event.url);
      if (can) await Linking.openURL(event.url);
    } catch {
      Alert.alert("Cannot open link");
    }
  };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
      <View style={styles.row}>
        <Pill>{CATEGORY_LABEL[event.category][lang]}</Pill>
        <Text style={styles.distance}>{event.distance_km.toFixed(2)} {t("card.distance", lang)}</Text>
        {fallback && <Text style={styles.fallbackHint}>ⓘ</Text>}
      </View>
      <Text numberOfLines={2} style={styles.title}>{title}</Text>
      <Text numberOfLines={1} style={styles.venue}>{venue}</Text>
      <View style={styles.footer}>
        <Text style={styles.date}>
          {event.start.slice(0, 10)}
          {event.end && event.end !== event.start ? ` ~ ${event.end.slice(0, 10)}` : ""}
        </Text>
        <Text style={[styles.price, isFree && styles.priceFree]}>{event.price}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.md,
    gap: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  distance: { color: colors.textMuted, fontSize: font.size.xxs, letterSpacing: 0.4, textTransform: "uppercase" },
  fallbackHint: { color: colors.textSubtle, fontSize: font.size.xs },
  title: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.text,
    marginTop: space.xs,
  },
  venue: { color: colors.textMuted, fontSize: font.size.xs },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: space.xs },
  date: { color: colors.textMuted, fontSize: font.size.xs },
  price: { color: colors.textMuted, fontSize: font.size.xs },
  priceFree: { color: colors.accent, fontWeight: font.weight.semibold },
});
