import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import type { PeerInfo, RelayEndpoint, RoomSummary, SignalServerMessage } from "@crafttogether/shared";
import { Button, Card, Screen, Subtitle, Title } from "@/components/ui";
import { colors, radius, spacing } from "@/theme";
import { api } from "@/api/client";
import { SignalingClient } from "@/net/signaling";
import { UdpProxy } from "@/net/udpProxy";
import { clearActiveSession, getActiveSession } from "@/state/active";

interface ChatMsg {
  peerId: string;
  from: string;
  text: string;
  ts: number;
}

export default function RoomScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = getActiveSession();

  const [room, setRoom] = useState<RoomSummary | null>(session?.room ?? null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState("");
  const [connState, setConnState] = useState<"idle" | "linking" | "ready">("idle");

  const signalingRef = useRef<SignalingClient | null>(null);
  const proxiesRef = useRef<UdpProxy[]>([]);

  useEffect(() => {
    if (!session || !id) return;

    if (session.role === "guest" && session.relay) {
      const proxy = new UdpProxy(session.relay, { mode: "guest", localPort: session.localPort });
      proxy.onStatus = (s) => {
        if (s.running) setConnState("ready");
      };
      proxy.start();
      proxiesRef.current.push(proxy);
      setConnState("linking");
    }

    const client = new SignalingClient(id, session.token, session.role);
    signalingRef.current = client;
    client.on((msg: SignalServerMessage) => {
      switch (msg.type) {
        case "welcome":
          setRoom(msg.room);
          setPeers(msg.peers);
          break;
        case "room-update":
          setRoom(msg.room);
          break;
        case "peer-joined":
          setPeers((p) => [...p.filter((x) => x.peerId !== msg.peer.peerId), msg.peer]);
          break;
        case "peer-left":
          setPeers((p) => p.filter((x) => x.peerId !== msg.peer.peerId));
          break;
        case "chat":
          setMessages((m) =>
            [...m, { peerId: msg.peerId, from: msg.from, text: msg.text, ts: msg.ts }].slice(-60),
          );
          break;
        case "relay-ready":
          if (session.role === "host") startHostProxy(msg.relay);
          break;
        case "kicked":
          Alert.alert("Você foi removido", "O host removeu você da sala.");
          leave();
          break;
        case "host-left":
          Alert.alert("Sala encerrada", "O host saiu da sala.");
          leave();
          break;
      }
    });
    client.connect();

    return () => {
      signalingRef.current?.close();
      proxiesRef.current.forEach((p) => p.stop());
      proxiesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const startHostProxy = (relay: RelayEndpoint) => {
    const proxy = new UdpProxy(relay, { mode: "host" });
    proxy.onStatus = (s) => {
      if (s.running) setConnState("ready");
    };
    proxy.start();
    proxiesRef.current.push(proxy);
    setConnState("linking");
  };

  const copyCode = async () => {
    if (room) {
      await Clipboard.setStringAsync(room.code);
      Alert.alert("Copiado", `Código ${room.code} copiado.`);
    }
  };

  const isHost = session?.role === "host";

  const openMinecraft = async () => {
    // Guests get a deep link that pre-adds the local proxy as a server in Bedrock.
    const url = isHost
      ? "minecraft://"
      : `minecraft://?addExternalServer=CraftTogether|127.0.0.1:${session?.localPort}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Não consegui abrir o Minecraft",
        "Confira se o Minecraft (Bedrock) está instalado neste aparelho.",
      );
    }
  };

  const sendChat = () => {
    const t = chatText.trim();
    if (!t) return;
    signalingRef.current?.sendChat(t);
    setChatText("");
  };

  const confirmKick = (peer: PeerInfo) => {
    Alert.alert("Expulsar", `Remover ${peer.name} da sala?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Expulsar", style: "destructive", onPress: () => signalingRef.current?.kick(peer.peerId) },
    ]);
  };

  const leave = async () => {
    signalingRef.current?.close();
    proxiesRef.current.forEach((p) => p.stop());
    proxiesRef.current = [];
    if (session) {
      try {
        await api.leave(session.token);
      } catch {
        // best effort
      }
    }
    clearActiveSession();
    router.replace("/");
  };

  if (!session || !room) {
    return (
      <Screen>
        <Title>Sala</Title>
        <Subtitle>Sessão não encontrada. Volte e entre novamente.</Subtitle>
        <Button label="Voltar" onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  const guestPeers = peers.filter((p) => p.role === "guest");
  const serverAddress = `127.0.0.1:${session.localPort}`;

  return (
    <Screen>
      <Title>{room.name}</Title>

      <Card>
        <Text style={styles.label}>Código da sala</Text>
        <Text style={styles.code}>{room.code}</Text>
        <Button label="Copiar código" variant="secondary" onPress={copyCode} />
      </Card>

      <Card>
        <Text style={styles.label}>Status da conexão</Text>
        <Text style={[styles.status, connState === "ready" && { color: colors.primary }]}>
          {connState === "ready" ? "● Ponte ativa" : connState === "linking" ? "● Conectando…" : "○ Aguardando"}
        </Text>
        <Button label="Abrir no Minecraft" onPress={openMinecraft} />
        {!isHost && (
          <Text style={styles.hint}>
            Abre o Minecraft já adicionando o servidor. Se não abrir sozinho, adicione
            manualmente em Servidores: {serverAddress.split(":")[0]} porta {session.localPort}.
          </Text>
        )}
      </Card>

      {isHost ? (
        <Card>
          <Text style={styles.label}>Você é o host — no Minecraft:</Text>
          <Text style={styles.step}>1. Abra o seu mundo.</Text>
          <Text style={styles.step}>2. Ligue "Visível para jogadores da LAN".</Text>
          <Text style={styles.step}>3. Compartilhe o código com seu amigo.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.label}>Se precisar adicionar manualmente:</Text>
          <Text style={styles.step}>
            Servidores → Adicionar servidor → Endereço <Text style={styles.mono}>127.0.0.1</Text>,
            Porta <Text style={styles.mono}>{session.localPort}</Text> → Jogar.
          </Text>
        </Card>
      )}

      <Card>
        <Text style={styles.label}>Na sala ({guestPeers.length + 1})</Text>
        <Text style={styles.peer}>👑 {room.hostName} (host)</Text>
        {guestPeers.map((p) => (
          <View key={p.peerId} style={styles.peerRow}>
            <Text style={styles.peer}>🎮 {p.name}</Text>
            {isHost && (
              <Pressable onPress={() => confirmKick(p)} style={styles.kickBtn}>
                <Text style={styles.kickText}>Expulsar</Text>
              </Pressable>
            )}
          </View>
        ))}
        {guestPeers.length === 0 && <Text style={styles.hint}>Aguardando amigos entrarem…</Text>}
      </Card>

      <Card>
        <Text style={styles.label}>Chat</Text>
        <View style={styles.chatBox}>
          {messages.length === 0 ? (
            <Text style={styles.hint}>Sem mensagens ainda. Diga um oi!</Text>
          ) : (
            messages.map((m, i) => (
              <Text key={`${m.ts}-${i}`} style={styles.chatMsg}>
                <Text style={styles.chatFrom}>{m.from}: </Text>
                {m.text}
              </Text>
            ))
          )}
        </View>
        <View style={styles.chatInputRow}>
          <TextInput
            value={chatText}
            onChangeText={setChatText}
            placeholder="Mensagem…"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { flex: 1 }]}
            maxLength={400}
            onSubmitEditing={sendChat}
            returnKeyType="send"
          />
          <Button label="Enviar" onPress={sendChat} />
        </View>
      </Card>

      <Button label="Sair da sala" variant="danger" onPress={leave} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 13 },
  code: { color: colors.text, fontSize: 40, fontWeight: "900", letterSpacing: 6, textAlign: "center" },
  status: { color: colors.textMuted, fontSize: 16, fontWeight: "700" },
  step: { color: colors.text, fontSize: 15, lineHeight: 22 },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs, lineHeight: 18 },
  mono: { color: colors.accent, fontWeight: "800" },
  peer: { color: colors.text, fontSize: 16 },
  peerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kickBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  kickText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chatBox: { gap: 4, maxHeight: 220 },
  chatMsg: { color: colors.text, fontSize: 15, lineHeight: 20 },
  chatFrom: { color: colors.accent, fontWeight: "700" },
  chatInputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
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
});
