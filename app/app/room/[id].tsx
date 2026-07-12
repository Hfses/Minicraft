import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import type { RelayEndpoint, RoomSummary, SignalServerMessage } from "@crafttogether/shared";
import { Button, Card, Screen, Subtitle, Title } from "@/components/ui";
import { colors, spacing } from "@/theme";
import { api } from "@/api/client";
import { SignalingClient } from "@/net/signaling";
import { UdpProxy } from "@/net/udpProxy";
import { clearActiveSession, getActiveSession } from "@/state/active";

interface PeerRow {
  name: string;
  role: string;
}

export default function RoomScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = getActiveSession();

  const [room, setRoom] = useState<RoomSummary | null>(session?.room ?? null);
  const [peers, setPeers] = useState<PeerRow[]>([]);
  const [connState, setConnState] = useState<"idle" | "linking" | "ready">("idle");
  const [log, setLog] = useState<string>("");

  const signalingRef = useRef<SignalingClient | null>(null);
  const proxiesRef = useRef<UdpProxy[]>([]);

  useEffect(() => {
    if (!session || !id) return;

    const appendLog = (line: string) => setLog((prev) => `${line}\n${prev}`.slice(0, 800));

    // Guest starts its local proxy immediately (host proxies start per guest).
    if (session.role === "guest" && session.relay) {
      const proxy = new UdpProxy(session.relay, { mode: "guest", localPort: session.localPort });
      proxy.onStatus = (s) => {
        if (s.running) setConnState("ready");
        if (s.lastError) appendLog(`erro: ${s.lastError}`);
      };
      proxy.start().then(() => appendLog("Proxy local pronto. Adicione o servidor no Minecraft."));
      proxiesRef.current.push(proxy);
      setConnState("linking");
    }

    const client = new SignalingClient(id, session.token, session.role);
    signalingRef.current = client;
    client.on((msg: SignalServerMessage) => {
      switch (msg.type) {
        case "welcome":
        case "room-update":
          setRoom(msg.room);
          break;
        case "peer-joined":
          setPeers((p) => [...p, { name: msg.name, role: msg.role }]);
          appendLog(`${msg.name} entrou.`);
          break;
        case "peer-left":
          setPeers((p) => p.filter((x) => x.name !== msg.name));
          appendLog(`${msg.name} saiu.`);
          break;
        case "relay-ready":
          // Host receives a dedicated relay endpoint per guest; bridge to the local world.
          if (session.role === "host") startHostProxy(msg.relay, appendLog);
          break;
        case "host-left":
          Alert.alert("Sala encerrada", "O host saiu da sala.");
          leave();
          break;
        case "error":
          appendLog(`erro: ${msg.message}`);
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

  const startHostProxy = (relay: RelayEndpoint, appendLog: (l: string) => void) => {
    const proxy = new UdpProxy(relay, { mode: "host" });
    proxy.onStatus = (s) => {
      if (s.running) setConnState("ready");
      if (s.lastError) appendLog(`erro: ${s.lastError}`);
    };
    proxy.start().then(() => appendLog("Ponte de um amigo conectada ao seu mundo."));
    proxiesRef.current.push(proxy);
    setConnState("linking");
  };

  const copyCode = async () => {
    if (room) {
      await Clipboard.setStringAsync(room.code);
      Alert.alert("Copiado", `Código ${room.code} copiado.`);
    }
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

  const isHost = session.role === "host";
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
          {connState === "ready"
            ? "● Ponte ativa"
            : connState === "linking"
              ? "● Conectando…"
              : "○ Aguardando"}
        </Text>
      </Card>

      {isHost ? (
        <Card>
          <Text style={styles.label}>Você é o host — faça isto no Minecraft:</Text>
          <Text style={styles.step}>1. Abra o seu mundo.</Text>
          <Text style={styles.step}>
            2. Nas configurações do mundo, ligue "Visível para jogadores da LAN".
          </Text>
          <Text style={styles.step}>3. Compartilhe o código acima com seu amigo.</Text>
          <Text style={styles.hint}>
            Quando um amigo entrar pelo app, a ponte para o seu mundo é criada
            automaticamente.
          </Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.label}>Para entrar — faça isto no Minecraft:</Text>
          <Text style={styles.step}>1. Vá na aba "Servidores" → "Adicionar servidor".</Text>
          <Text style={styles.step}>
            2. Endereço: <Text style={styles.mono}>{serverAddress.split(":")[0]}</Text>
          </Text>
          <Text style={styles.step}>
            3. Porta: <Text style={styles.mono}>{session.localPort}</Text>
          </Text>
          <Text style={styles.step}>4. Salve e toque em "Jogar".</Text>
          <Button
            label="Copiar endereço"
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(serverAddress);
              Alert.alert("Copiado", `${serverAddress} copiado.`);
            }}
          />
        </Card>
      )}

      <Card>
        <Text style={styles.label}>Na sala ({room.guestCount + 1})</Text>
        <Text style={styles.peer}>👑 {room.hostName} (host)</Text>
        {peers
          .filter((p) => p.role !== "host")
          .map((p, i) => (
            <Text key={`${p.name}-${i}`} style={styles.peer}>
              🎮 {p.name}
            </Text>
          ))}
      </Card>

      {log.length > 0 && (
        <Card>
          <Text style={styles.label}>Registro</Text>
          <Text style={styles.log}>{log}</Text>
        </Card>
      )}

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
  log: { color: colors.textMuted, fontSize: 12, fontFamily: "monospace" as const },
});
