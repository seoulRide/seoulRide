import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useLang } from "../../src/lib/lang-store";
import { t } from "../../src/lib/i18n";
import { colors, font } from "../../src/lib/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        fontSize: font.size.xs,
        color: focused ? colors.text : colors.textMuted,
        fontWeight: focused ? font.weight.semibold : font.weight.regular,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const [lang] = useLang();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home", lang),
          tabBarIcon: ({ focused }) => <TabIcon label={"🚲 " + t("nav.home", lang)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: t("nav.events", lang),
          tabBarIcon: ({ focused }) => <TabIcon label={"🎟 " + t("nav.events", lang)} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: t("nav.about", lang),
          tabBarIcon: ({ focused }) => <TabIcon label={"ⓘ " + t("nav.about", lang)} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
