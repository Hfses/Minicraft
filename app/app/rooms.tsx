import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { isValidRoomCode, normalizeRoomCode, type RoomSummary } from "@crafttogether/shared";
import { Avatar, Badge, Button, Card, PlayersBar, Screen, Subtitle, Title } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import { api, ApiError, NetworkError, wakeBackend } from "@/api/client";
import { getPlayerName } from "@/state/session";
import { setActiveSession } from "@/state/active";
import { discoverLanWorlds, type LanWorld } from "@/net/lanDiscovery";

const GUEST_LOCAL_PORT = 19140;

export default function Rooms() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [lan, setLan] = useState<LanWorld[]>([]);
  const [code, setCode] = useState(params.code ? String(params.code).toUpperCase() : "");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Wake the free-tier server first (cold start ~1 min) so the list loads.
      setStatusMsg("Conectando ao servidor… (pode levar até 1 min na 1ª vez)");
      await wakeBackend();
      setStatusMsg(null);
      const list = await api.listRooms();
      setRooms(list.rooms);
    } catch (e) {
      setStatusMsg(null);
      setError(
        e instanceof NetworkError
          ? "Não consegui falar com o servidor. Cheque a internet e toque em Atualizar."
          : "Não foi possível carregar as salas.",
      );
    } finally {
      setLoading(false);
    }
    // LAN scan runs independently and may be empty on many networks.
    try {
      setLan(await discoverLanWorlds());
    } catch {
      setLan([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const join = async (joinCode: string) => {
    const normalized = normalizeRoomCode(joinCode);
    if (!isValidRoomCode(normalized)) {
      setError("Código inválido. São 6 caracteres.");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      setStatusMsg("Conectando ao servidor…");
      await wakeBackend();
      setStatusMsg("Entrando na sala…");
      const guestName = (await getPlayerName()) || "Amigo";
      const res = await api.joinRoom({ code: normalized, guestName });
      setActiveSession({
        role: "guest",
        room: res.room,
        token: res.guestToken,
        relay: res.relay,
        localPort: GUEST_LOCAL_PORT,
      });
      router.replace(`/room/${res.room.id}`);
    } catch (e) {
      const msg =
        e instanceof NetworkError
          ? "Não consegui falar com o servidor. Tente de novo."
          : e instanceof ApiError
            ? e.code === "room_not_found"
              ? "Sala não encontrada."
              : e.code === "room_full"
                ? "A sala está cheia."
                : "Não foi possível entrar."
            : "Não foi possível entrar.";
      setError(msg);
    } finally {
      setStatusMsg(null);
      setJoining(false);
    }
  };

  return (
    <Screen>
      <Title>Encontrar salas</Title>

      <Card>
        <Text style={styles.label}>Entrar por código</Text>
        <View style={styles.row}>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="Ex: K7Q2MP"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            maxLength={6}
            style={[styles.input, { flex: 1 }]}
          />
          <Button label="Entrar" onPress={() => join(code)} loading={joining} />
        </View>
      </Card>

      {statusMsg && <Text style={styles.status}>{statusMsg}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.header}>
        <Subtitle>Salas públicas</Subtitle>
        <Text style={styles.refresh} onPress={refresh}>
          Atualizar
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : rooms.length === 0 ? (
        <Text style={styles.empty}>Nenhuma sala pública no momento. Crie a sua!</Text>
      ) : (
        rooms.map((room) => {
          const full = room.guestCount >= room.maxGuests;
          return (
            <Pressable
              key={room.id}
              onPress={() => !full && join(room.code)}
              disabled={full || joining}
              style={({ pressed }) => [styles.roomCard, pressed && { opacity: 0.85 }, full && { opacity: 0.6 }]}
            >
              <Avatar name={room.hostName} size={44} />
              <View style={styles.roomInfo}>
                <View style={styles.roomTopRow}>
                  <Text style={styles.roomName} numberOfLines={1}>
                    {room.name}
                  </Text>
                  <Badge
                    label={full ? "CHEIA" : "ENTRAR"}
                    color={full ? colors.danger : colors.primaryDark}
                  />
                </View>
                <Text style={styles.meta}>Host: {room.hostName} · Código {room.code}</Text>
                <PlayersBar current={room.guestCount + 1} max={room.maxGuests + 1} />
              </View>
            </Pressable>
          );
        })
      )}

      {lan.length > 0 && (
        <>
          <Subtitle>Na sua Wi-Fi (LAN)</Subtitle>
          {lan.map((w) => (
            <Card key={`${w.address}:${w.port}`}>
              <Text style={styles.roomName}>{w.name}</Text>
              <Text style={styles.meta}>
                {w.address}:{w.port}
                {w.players != null ? ` · ${w.players}/${w.maxPlayers ?? "?"}` : ""}
              </Text>
              <Text style={styles.hint}>
                Na mesma Wi-Fi você já pode abrir o Minecraft e este mundo aparece na
                aba Amigos — sem precisar do relay.
              </Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  refresh: { color: colors.accent, fontWeight: "600" },
  empty: { color: colors.textMuted, fontStyle: "italic" },
  roomName: { color: colors.text, fontSize: 16, fontWeight: "800", flex: 1 },
  meta: { color: colors.textMuted, fontSize: 13 },
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
  status: { color: colors.accent, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14 },
});
