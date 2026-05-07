import { Platform, View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { PopularStation } from "../lib/types";
import { Lang } from "../lib/i18n";
import { colors, font, radius, rentIntensityColor, space } from "../lib/theme";

// react-native-maps requires native modules — on web we render a fallback list
let MapComponents: any = null;
if (Platform.OS !== "web") {
  // Lazy require so web bundle doesn't try to resolve native code.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapComponents = require("react-native-maps");
}

export function SeoulMap({ stations, lang }: { stations: PopularStation[]; lang: Lang }) {
  const router = useRouter();
  const max = Math.max(...stations.map((s) => s.rent_total), 1);

  if (Platform.OS === "web" || !MapComponents) {
    // Web fallback: simple ranked list (Expo web doesn't support react-native-maps natively).
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackHint}>
          {lang === "ko"
            ? "지도는 iOS/Android 앱에서 표시됩니다. 웹에서는 카드 목록을 사용하세요."
            : "Map is available on iOS/Android. On web, use the cards below."}
        </Text>
      </View>
    );
  }

  const { default: MapView, Marker, PROVIDER_DEFAULT } = MapComponents;
  return (
    <View style={styles.mapWrap}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={{ latitude: 37.5665, longitude: 126.978, latitudeDelta: 0.18, longitudeDelta: 0.22 }}
      >
        {stations.map((s) => {
          const intensity = s.rent_total / max;
          const color = rentIntensityColor(intensity);
          return (
            <Marker
              key={s.station_no}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              onPress={() => router.push({ pathname: "/station/[id]", params: { id: s.station_no } })}
              title={`#${s.rank_overall} ${s.station_name_ko}`}
              description={`${s.gu_en ?? s.gu_ko} · ${s.rent_total} rentals`}
              pinColor={color}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 400,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  map: { flex: 1 },
  fallback: {
    height: 220,
    backgroundColor: colors.pillBg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    padding: space.lg,
  },
  fallbackHint: { color: colors.textMuted, fontSize: font.size.sm, textAlign: "center", lineHeight: 20 },
});
