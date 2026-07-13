import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { avatarColor, colors, radius, spacing } from "@/theme";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    variant === "primary" ? colors.primary : variant === "danger" ? colors.danger : colors.card;
  const borderColor = variant === "secondary" ? colors.cardBorder : "transparent";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Blocky avatar with the first letter of the name (Multiplayer Master style). */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radius.sm, backgroundColor: avatarColor(name) },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.45 }]}>{letter}</Text>
    </View>
  );
}

/** Small status badge, e.g. ABERTA / CHEIA / HOST. */
export function Badge({
  label,
  color = colors.primaryDark,
}: {
  label: string;
  color?: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

/** Player occupancy bar, e.g. 3/8 players. */
export function PlayersBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(1, current / max) : 0;
  return (
    <View style={styles.playersBarWrap}>
      <View style={styles.playersBarTrack}>
        <View
          style={[
            styles.playersBarFill,
            { width: `${Math.round(pct * 100)}%` },
            pct >= 1 && { backgroundColor: colors.danger },
          ]}
        />
      </View>
      <Text style={styles.playersBarText}>
        {current}/{max}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 21 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#0b1210", fontWeight: "900" },
  badge: {
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  playersBarWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playersBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  playersBarFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  playersBarText: { color: colors.textMuted, fontSize: 13, fontWeight: "700", minWidth: 34, textAlign: "right" },
});
