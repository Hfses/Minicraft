import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Avatar, Card, Screen } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import { getFriendCode, getPlayerName, setPlayerName } from "@/state/session";
import { getStats, listHistory, type HistoryEntry, type ProfileStats } from "@/state/history";

function formatWhen(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h atrás`;
  const days = Math.floor(hours / 24);
  return `${days} d atrás`;
}

export default function Profile() {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [stats, setStats] = useState<ProfileStats>({ hosted: 0, joined: 0, total: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getPlayerName().then(setName);
      getFriendCode().then(setCode);
      getStats().then(setStats);
      listHistory().then(setHistory);
    }, []),
  );

  const persistName = (value: string) => {
    setName(value);
    setPlayerName(value);
  };

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copiado", "Seu código de amigo foi copiado.");
  };

  return (
    <Screen>
      {/* Identity */}
      <Card>
        <View style={styles.identityRow}>
          <Avatar name={name || "?"} size={64} />
          <View style={styles.identityInfo}>
            {editing ? (
              <TextInput
                value={name}
                onChangeText={persistName}
                onBlur={() => setEditing(false)}
                autoFocus
                placeholder="Seu nome no jogo"
                placeholderTextColor={colors.textMuted}
                style={styles.nameInput}
                maxLength={32}
                returnKeyType="done"
                onSubmitEditing={() => setEditing(false)}
              />
            ) : (
              <Pressable onPress={() => setEditing(true)}>
                <Text style={styles.name}>{name || "Toque para definir seu nome"}</Text>
                <Text style={styles.hintSmall}>Toque para editar o nome</Text>
              </Pressable>
            )}
          </View>
        </View>
        <Pressable onPress={copyCode} style={styles.codeRow} accessibilityLabel="Copiar código de amigo">
          <View style={styles.codeInfo}>
            <Text style={styles.label}>Código de amigo</Text>
            <Text style={styles.code}>{code}</Text>
          </View>
          <MaterialCommunityIcons name="content-copy" size={20} color={colors.accent} />
        </Pressable>
      </Card>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.hosted}</Text>
          <Text style={styles.statLabel}>Salas criadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.joined}</Text>
          <Text style={styles.statLabel}>Salas visitadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total de jogos</Text>
        </View>
      </View>

      {/* History */}
      <Text style={styles.sectionTitle}>Histórico de conexões</Text>
      {history.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>Nada por aqui ainda</Text>
          <Text style={styles.meta}>
            Crie ou entre em uma sala e ela aparece aqui automaticamente.
          </Text>
        </Card>
      ) : (
        history.slice(0, 20).map((h, i) => (
          <View key={`${h.at}-${i}`} style={styles.historyRow}>
            <MaterialCommunityIcons
              name={h.kind === "hosted" ? "crown" : "login"}
              size={22}
              color={h.kind === "hosted" ? colors.gold : colors.accent}
            />
            <View style={styles.historyInfo}>
              <Text style={styles.historyName} numberOfLines={1}>
                {h.roomName}
              </Text>
              <Text style={styles.meta}>
                {h.kind === "hosted" ? "Você hospedou" : "Você entrou"} · código {h.code}
              </Text>
            </View>
            <Text style={styles.when}>{formatWhen(h.at)}</Text>
          </View>
        ))
      )}

      <Link href="/guide" style={styles.guideLink}>
        <Text style={styles.guideText}>Como jogar junto? Ver o guia</Text>
      </Link>

      <Text style={styles.disclaimer}>
        App não-oficial. Não afiliado à Mojang/Microsoft.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  identityInfo: { flex: 1 },
  name: { color: colors.text, fontSize: 22, fontWeight: "800" },
  hintSmall: { color: colors.textMuted, fontSize: 12 },
  nameInput: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    borderBottomColor: colors.primary,
    borderBottomWidth: 1,
    paddingVertical: 2,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  codeInfo: { gap: 2 },
  label: { color: colors.textMuted, fontSize: 12 },
  code: { color: colors.accent, fontSize: 22, fontWeight: "900", letterSpacing: 3 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  statValue: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  statLabel: { color: colors.textMuted, fontSize: 11, textAlign: "center" },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  historyInfo: { flex: 1, gap: 2 },
  historyName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  when: { color: colors.textMuted, fontSize: 12 },
  guideLink: { alignSelf: "center", paddingVertical: spacing.sm },
  guideText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  disclaimer: { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 17 },
});
