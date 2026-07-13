import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Avatar, Button, Card, Screen } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import { getFriendCode, getPlayerName } from "@/state/session";
import {
  addFriend,
  listFriends,
  removeFriend,
  toggleFriendFavorite,
  type Friend,
} from "@/state/friends";

export default function Friends() {
  const [myCode, setMyCode] = useState("");
  const [myName, setMyName] = useState("");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  useFocusEffect(
    useCallback(() => {
      getFriendCode().then(setMyCode);
      getPlayerName().then(setMyName);
      listFriends().then(setFriends);
    }, []),
  );

  const shareMyCode = async () => {
    await Clipboard.setStringAsync(myCode);
    Alert.alert("Copiado", "Seu código de amigo foi copiado. Envie para quem quiser jogar.");
  };

  const submitAdd = async () => {
    const name = newName.trim();
    const code = newCode.trim().toUpperCase();
    if (!name || !code) return;
    setFriends(await addFriend({ name, code }));
    setNewName("");
    setNewCode("");
    setAdding(false);
  };

  const confirmRemove = (friend: Friend) => {
    Alert.alert("Remover amigo", `Remover "${friend.name}" da sua lista?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => setFriends(await removeFriend(friend.code)),
      },
    ]);
  };

  const sorted = [...friends].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Screen>
      {/* My identity card */}
      <Card>
        <View style={styles.meRow}>
          <Avatar name={myName || "?"} size={48} />
          <View style={styles.meInfo}>
            <Text style={styles.meName}>{myName || "Defina seu nome no Perfil"}</Text>
            <Text style={styles.meCode}>{myCode}</Text>
          </View>
          <Pressable onPress={shareMyCode} hitSlop={8} accessibilityLabel="Copiar meu código">
            <MaterialCommunityIcons name="share-variant" size={22} color={colors.accent} />
          </Pressable>
        </View>
        <Text style={styles.hint}>
          Compartilhe seu código: seus amigos adicionam você por ele.
        </Text>
      </Card>

      {/* Add friend */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Meus amigos ({friends.length})</Text>
        <Pressable
          onPress={() => setAdding((v) => !v)}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          accessibilityLabel="Adicionar amigo"
        >
          <MaterialCommunityIcons name={adding ? "close" : "account-plus"} size={20} color={colors.text} />
        </Pressable>
      </View>

      {adding && (
        <Card>
          <Text style={styles.label}>Adicionar amigo</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Nome do amigo"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={32}
          />
          <TextInput
            value={newCode}
            onChangeText={(t) => setNewCode(t.toUpperCase())}
            placeholder="Código de amigo (ex: A1B2C3D4)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="characters"
            maxLength={12}
          />
          <Button
            label="Adicionar"
            onPress={submitAdd}
            disabled={!newName.trim() || !newCode.trim()}
          />
        </Card>
      )}

      {sorted.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>Nenhum amigo ainda</Text>
          <Text style={styles.meta}>
            Peça o código de amigo de alguém e toque no botão + acima para adicionar.
          </Text>
        </Card>
      ) : (
        sorted.map((friend) => (
          <Pressable
            key={friend.code}
            onLongPress={() => confirmRemove(friend)}
            style={({ pressed }) => [styles.friendRow, pressed && { opacity: 0.85 }]}
          >
            <Avatar name={friend.name} size={44} />
            <View style={styles.friendInfo}>
              <Text style={styles.friendName} numberOfLines={1}>
                {friend.name}
              </Text>
              <Text style={styles.meta}>Código {friend.code}</Text>
            </View>
            <Pressable
              onPress={async () => setFriends(await toggleFriendFavorite(friend.code))}
              hitSlop={8}
              accessibilityLabel={friend.favorite ? "Desfavoritar amigo" : "Favoritar amigo"}
            >
              <MaterialCommunityIcons
                name={friend.favorite ? "star" : "star-outline"}
                size={24}
                color={friend.favorite ? colors.gold : colors.textMuted}
              />
            </Pressable>
          </Pressable>
        ))
      )}

      <Text style={styles.hint}>
        Segure um amigo para remover. Para jogar juntos: crie uma sala e mande o código
        para eles pela aba Salas.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  meInfo: { flex: 1, gap: 2 },
  meName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  meCode: { color: colors.accent, fontSize: 15, fontWeight: "800", letterSpacing: 2 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  addBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.sm,
    width: 36,
    height: 36,
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
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 13 },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  friendInfo: { flex: 1, gap: 2 },
  friendName: { color: colors.text, fontSize: 16, fontWeight: "800" },
});
