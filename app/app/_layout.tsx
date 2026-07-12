import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "800" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "CraftTogether" }} />
        <Stack.Screen name="create" options={{ title: "Criar sala" }} />
        <Stack.Screen name="rooms" options={{ title: "Encontrar salas" }} />
        <Stack.Screen name="room/[id]" options={{ title: "Sala" }} />
        <Stack.Screen name="friends" options={{ title: "Amigos" }} />
        <Stack.Screen name="guide" options={{ title: "Como jogar junto" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
