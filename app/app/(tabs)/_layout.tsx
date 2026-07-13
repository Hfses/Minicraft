import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/theme";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function tabIcon(name: IconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <MaterialCommunityIcons name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.cardBorder,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Início", headerTitle: "CraftTogether", tabBarIcon: tabIcon("home-variant") }}
      />
      <Tabs.Screen
        name="servers"
        options={{ title: "Servidores", tabBarIcon: tabIcon("server") }}
      />
      <Tabs.Screen
        name="rooms"
        options={{ title: "Salas", tabBarIcon: tabIcon("account-group") }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: "Amigos", tabBarIcon: tabIcon("account-heart") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Perfil", tabBarIcon: tabIcon("account-circle") }}
      />
    </Tabs>
  );
}
