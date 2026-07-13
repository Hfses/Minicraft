import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar, Button, Card } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import {
  addServer,
  listServers,
  removeServer,
  toggleFavorite,
  type SavedServer,
} from "@/state/servers";
import { pingServer, type ServerStatus } from "@/net/serverPing";
import { discoverLanWorlds, type LanWorld } from "@/net/lanDiscovery";

type StatusMap = Record<string, ServerStatus | undefined>;

export default function Servers() {
  const [servers, setServers] = useState<SavedServer[]>([]);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [lan, setLan] = useState<LanWorld[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPort, setNewPort] = useState("19132");

  const pingAll = useCallback((list: SavedServer[]) => {
    for (const s of list) {
      pingServer(s.address, s.port).then((status) => {
        setStatuses((prev) => ({ ...prev, [s.id]: status }));
      });
    }
  }, []);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const list = await listServers();
      setServers(list);
      pingAll(list);
      try {
        setLan(await discoverLanWorlds());
      } catch {
        setLan([]);
      }
      if (isRefresh) setRefreshing(false);
    },
    [pingAll],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? servers.filter(
          (s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q),
        )
      : servers;
    // Favorites first, then online first, then by name.
    return [...base].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      const sa = statuses[a.id]?.status === "online" ? 0 : 1;
      const sb = statuses[b.id]?.status === "online" ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name);
    });
  }, [servers, search, statuses]);

  const submitAdd = async () => {
    const address = newAddress.trim();
    if (!address) return;
    const port = Number.parseInt(newPort, 10) || 19132;
    await addServer({ name: newName.trim() || address, address, port });
    setNewName("");
    setNewAddress("");
    setNewPort("19132");
    setAdding(false);
    load();
  };

  const confirmRemove = (server: SavedServer) => {
    Alert.alert("Remover servidor", `Remover "${server.name}" da lista?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => setServers(await removeServer(server.id)),
      },
    ]);
  };

  const udpUnavailable = Object.values(statuses).some((s) => s?.status === "unavailable");

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Search + add */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Pesquisar servidores"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
          </View>
          <Pressable
            onPress={() => setAdding((v) => !v)}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
            accessibilityLabel="Adicionar servidor"
          >
            <MaterialCommunityIcons
              name={adding ? "close" : "plus"}
              size={24}
              color={colors.text}
            />
          </Pressable>
        </View>

        {adding && (
          <Card>
            <Text style={styles.label}>Adicionar servidor</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Nome (opcional)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={48}
            />
            <View style={styles.addRow}>
              <TextInput
                value={newAddress}
                onChangeText={setNewAddress}
                placeholder="Endereço (ex: play.meuserver.com)"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { flex: 2 }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                value={newPort}
                onChangeText={setNewPort}
                placeholder="Porta"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { flex: 1 }]}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <Button label="Salvar servidor" onPress={submitAdd} disabled={!newAddress.trim()} />
          </Card>
        )}

        {udpUnavailable && (
          <Text style={styles.hint}>
            O ping ao vivo precisa do módulo de rede — instale o APK de release para ver o
            status dos servidores.
          </Text>
        )}

        {/* LAN worlds */}
        {lan.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Na sua Wi-Fi</Text>
            {lan.map((w) => (
              <View key={`${w.address}:${w.port}`} style={styles.serverCard}>
                <MaterialCommunityIcons name="wifi" size={28} color={colors.online} />
                <View style={styles.serverInfo}>
                  <Text style={styles.serverName} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <Text style={styles.meta}>
                    {w.address}:{w.port}
                    {w.players != null ? ` · ${w.players}/${w.maxPlayers ?? "?"} jogadores` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Saved servers */}
        <Text style={styles.sectionTitle}>Meus servidores ({filtered.length})</Text>
        {filtered.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>Nenhum servidor</Text>
            <Text style={styles.meta}>
              Toque no + acima para adicionar um servidor Bedrock pelo endereço.
            </Text>
          </Card>
        ) : (
          filtered.map((server) => {
            const st = statuses[server.id];
            const online = st?.status === "online";
            return (
              <Pressable
                key={server.id}
                onLongPress={() => confirmRemove(server)}
                style={({ pressed }) => [styles.serverCard, pressed && styles.pressed]}
              >
                <Avatar name={server.name} size={44} />
                <View style={styles.serverInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.serverName} numberOfLines={1}>
                      {server.name}
                    </Text>
                    {st ? (
                      st.status === "online" ? (
                        <Text style={styles.pingOk}>{st.pingMs} ms</Text>
                      ) : st.status === "offline" ? (
                        <Text style={styles.pingBad}>offline</Text>
                      ) : null
                    ) : (
                      <Text style={styles.meta}>…</Text>
                    )}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {st?.motd ?? `${server.address}:${server.port}`}
                  </Text>
                  {online && st?.players != null && (
                    <Text style={styles.metaStrong}>
                      {st.players}/{st.maxPlayers ?? "?"} jogadores
                      {st.version ? ` · v${st.version}` : ""}
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={async () => setServers(await toggleFavorite(server.id))}
                  hitSlop={8}
                  accessibilityLabel={server.favorite ? "Desfavoritar" : "Favoritar"}
                >
                  <MaterialCommunityIcons
                    name={server.favorite ? "star" : "star-outline"}
                    size={24}
                    color={server.favorite ? colors.gold : colors.textMuted}
                  />
                </Pressable>
              </Pressable>
            );
          })
        )}

        <Text style={styles.hint}>
          Segure um servidor para remover. Puxe para baixo para atualizar o ping.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  pressed: { opacity: 0.85 },
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 12 },
  addBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.md,
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { color: colors.textMuted, fontSize: 13 },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  addRow: { flexDirection: "row", gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  serverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  serverInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  serverName: { color: colors.text, fontSize: 16, fontWeight: "800", flex: 1 },
  meta: { color: colors.textMuted, fontSize: 13 },
  metaStrong: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  pingOk: { color: colors.online, fontSize: 13, fontWeight: "800" },
  pingBad: { color: colors.danger, fontSize: 13, fontWeight: "700" },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 17 },
});
