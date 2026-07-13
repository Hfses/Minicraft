import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RoomSummary } from "@crafttogether/shared";
import { Avatar, Badge, Button, Card, PlayersBar } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import { getPlayerName, setPlayerName } from "@/state/session";
import { api, prewarmBackend } from "@/api/client";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getPlayerName().then(setName);
    prewarmBackend();
  }, []);

  const loadRooms = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const list = await api.listRooms();
      setRooms(list.rooms);
    } catch {
      // Server may still be waking up (free tier); the list stays empty quietly.
    } finally {
      setLoadingRooms(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  // Refresh the list every time the user comes back to this screen.
  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, [loadRooms]),
  );

  const persistName = (value: string) => {
    setName(value);
    setPlayerName(value);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRooms(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Profile header */}
        <Pressable style={styles.profileRow} onPress={() => setEditingName(true)}>
          <Avatar name={name || "?"} size={48} />
          <View style={styles.profileInfo}>
            {editingName ? (
              <TextInput
                value={name}
                onChangeText={persistName}
                onBlur={() => setEditingName(false)}
                autoFocus
                placeholder="Seu nome no jogo"
                placeholderTextColor={colors.textMuted}
                style={styles.nameInput}
                maxLength={32}
                returnKeyType="done"
                onSubmitEditing={() => setEditingName(false)}
              />
            ) : (
              <>
                <Text style={styles.profileName}>{name || "Toque para definir seu nome"}</Text>
                <Text style={styles.profileHint}>Toque para editar</Text>
              </>
            )}
          </View>
          <Link href="/friends" style={styles.friendsLink}>
            <Text style={styles.friendsLinkText}>Amigos</Text>
          </Link>
        </Pressable>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => router.push("/create")}
            style={({ pressed }) => [styles.actionCard, styles.actionPrimary, pressed && styles.pressed]}
          >
            <Text style={styles.actionTitle}>Criar sala</Text>
            <Text style={styles.actionDesc}>Hospede seu mundo</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/rooms")}
            style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
          >
            <Text style={styles.actionTitle}>Entrar por código</Text>
            <Text style={styles.actionDesc}>Recebeu um código?</Text>
          </Pressable>
        </View>

        {/* Public rooms list (Multiplayer Master style) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Salas públicas</Text>
          <Text style={styles.refresh} onPress={() => loadRooms(true)}>
            Atualizar
          </Text>
        </View>

        {loadingRooms ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        ) : rooms.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>Nenhuma sala aberta agora</Text>
            <Text style={styles.emptyDesc}>
              Seja o primeiro! Crie uma sala e chame seus amigos para jogar.
            </Text>
            <Button label="Criar a primeira sala" onPress={() => router.push("/create")} />
          </Card>
        ) : (
          rooms.map((room) => {
            const full = room.guestCount >= room.maxGuests;
            return (
              <Pressable
                key={room.id}
                onPress={() => router.push({ pathname: "/rooms", params: { code: room.code } })}
                style={({ pressed }) => [styles.roomCard, pressed && styles.pressed]}
              >
                <Avatar name={room.hostName} size={44} />
                <View style={styles.roomInfo}>
                  <View style={styles.roomTopRow}>
                    <Text style={styles.roomName} numberOfLines={1}>
                      {room.name}
                    </Text>
                    <Badge
                      label={full ? "CHEIA" : "ABERTA"}
                      color={full ? colors.danger : colors.primaryDark}
                    />
                  </View>
                  <Text style={styles.roomHost} numberOfLines={1}>
                    Host: {room.hostName}
                  </Text>
                  <PlayersBar current={room.guestCount + 1} max={room.maxGuests + 1} />
                </View>
              </Pressable>
            );
          })
        )}

        <Link href="/guide" style={styles.guideLink}>
          <Text style={styles.guideText}>Como funciona? Ver o guia passo a passo</Text>
        </Link>

        <Text style={styles.disclaimerText}>
          App não-oficial. Não afiliado à Mojang/Microsoft. Use o seu Minecraft legalmente
          adquirido.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  pressed: { opacity: 0.85 },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { color: colors.text, fontSize: 18, fontWeight: "800" },
  profileHint: { color: colors.textMuted, fontSize: 12 },
  nameInput: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    borderBottomColor: colors.primary,
    borderBottomWidth: 1,
    paddingVertical: 2,
  },
  friendsLink: { paddingVertical: 6, paddingHorizontal: 10 },
  friendsLinkText: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: spacing.md },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  actionPrimary: { backgroundColor: colors.primaryDark, borderColor: colors.primary },
  actionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  actionDesc: { color: colors.textMuted, fontSize: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  refresh: { color: colors.accent, fontSize: 14, fontWeight: "700", padding: spacing.xs },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptyDesc: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  roomCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  roomInfo: { flex: 1, gap: 4 },
  roomTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  roomName: { color: colors.text, fontSize: 16, fontWeight: "800", flex: 1 },
  roomHost: { color: colors.textMuted, fontSize: 13 },
  guideLink: { paddingVertical: spacing.sm, alignSelf: "center" },
  guideText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  disclaimerText: { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 17 },
});
