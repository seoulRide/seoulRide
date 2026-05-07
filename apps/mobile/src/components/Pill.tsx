import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, font, radius, space } from "../lib/theme";

export function Pill({ children, tone = "neutral", style }: { children: React.ReactNode; tone?: "neutral" | "accent" | "warn"; style?: ViewStyle }) {
  const tones = {
    neutral: { bg: colors.pillBg, fg: colors.pillText, border: "transparent" },
    accent: { bg: colors.accentBg, fg: "#065f46", border: "transparent" },
    warn: { bg: colors.spike, fg: colors.spikeText, border: "transparent" },
  } as const;
  const c = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }, style]}>
      <Text style={[styles.text, { color: c.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: font.size.xxs,
    fontWeight: font.weight.medium,
    letterSpacing: 0.4,
  },
});
