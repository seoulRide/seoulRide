export const colors = {
  bg: "#fafafa",
  bgElevated: "#ffffff",
  border: "#e4e4e7",
  text: "#0a0a0a",
  textMuted: "#71717a",
  textSubtle: "#a1a1aa",
  accent: "#10b981",
  accentBg: "#d1fae5",
  warn: "#f59e0b",
  danger: "#dc2626",
  spike: "#fef3c7",
  spikeText: "#92400e",
  pillBg: "#f4f4f5",
  pillText: "#27272a",
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 20 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 };
export const font = {
  size: {
    xxs: 10,
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 22,
    "2xl": 28,
    "3xl": 34,
    "4xl": 44,
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
};

export function rideScoreColor(s: number) {
  if (s >= 80) return "#10b981";
  if (s >= 60) return "#34d399";
  if (s >= 40) return "#f59e0b";
  if (s >= 20) return "#fb923c";
  return "#dc2626";
}

export function rentIntensityColor(intensity: number) {
  if (intensity > 0.6) return "#dc2626";
  if (intensity > 0.3) return "#f59e0b";
  return "#10b981";
}
