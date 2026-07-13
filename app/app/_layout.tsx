import { Stack, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/theme";

/**
 * Global error boundary: any render/runtime error in a screen shows this
 * friendly recovery UI instead of a white screen.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={errStyles.container}>
      <Text style={errStyles.title}>Algo deu errado</Text>
      <Text style={errStyles.message}>
        O app encontrou um erro inesperado. Toque abaixo para tentar de novo.
      </Text>
      <Text style={errStyles.detail} numberOfLines={3}>
        {error.message}
      </Text>
      <Pressable onPress={retry} style={({ pressed }) => [errStyles.button, pressed && { opacity: 0.85 }]}>
        <Text style={errStyles.buttonText}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}

const errStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  message: { color: colors.textMuted, fontSize: 15, textAlign: "center", lineHeight: 21 },
  detail: { color: colors.danger, fontSize: 12, textAlign: "center" },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "700" },
});

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
