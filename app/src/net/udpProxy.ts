import dgram from "react-native-udp";
import { BEDROCK_DEFAULT_PORT, type RelayEndpoint } from "@crafttogether/shared";
import { RELAY_WS_URL } from "@/config";

/**
 * On-device bridge between the local Minecraft game (UDP/RakNet) and the cloud
 * relay (WebSocket). It forwards opaque datagrams verbatim — it never inspects
 * or changes game content.
 *
 * Local side stays UDP (that's how Minecraft talks); the relay side is a
 * WebSocket so the backend needs no UDP/public IP and hosts on any free tier.
 *
 * Modes:
 *  - "guest": binds a local port. The player adds `127.0.0.1:<localPort>` in the
 *    Minecraft "Servers" tab; packets from the game are tunneled to the relay,
 *    and the host's replies are delivered back to the game.
 *  - "host": talks to the host's own LAN world (127.0.0.1:19132). Messages from
 *    the relay (sent by a guest) are delivered to the game, and the world's
 *    replies are tunneled back.
 */

export type ProxyMode =
  | { mode: "guest"; localPort: number }
  | { mode: "host"; gameHost?: string; gamePort?: number };

export interface ProxyStatus {
  running: boolean;
  bytesUp: number;
  bytesDown: number;
  lastError?: string;
}

interface UdpSocket {
  bind(port: number, address?: string, callback?: () => void): void;
  on(event: "message", cb: (msg: Buffer, rinfo: { address: string; port: number }) => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  send(
    msg: Uint8Array | string,
    offset: number,
    length: number,
    port: number,
    address: string,
    callback?: (err?: Error) => void,
  ): void;
  close(cb?: () => void): void;
}

export class UdpProxy {
  private ws: WebSocket | null = null;
  private localSocket: UdpSocket | null = null;
  private lastGameAddr: { address: string; port: number } | null = null;
  private status: ProxyStatus = { running: false, bytesUp: 0, bytesDown: 0 };

  onStatus?: (status: ProxyStatus) => void;

  constructor(
    private readonly relay: RelayEndpoint,
    private readonly config: ProxyMode,
  ) {}

  private emit(): void {
    this.onStatus?.({ ...this.status });
  }

  private sendToGame(data: Uint8Array): void {
    if (!this.localSocket || !this.lastGameAddr) return;
    this.localSocket.send(data, 0, data.length, this.lastGameAddr.port, this.lastGameAddr.address, (err) => {
      if (err) {
        this.status.lastError = err.message;
        this.emit();
      }
    });
  }

  /**
   * Bind the local UDP socket, rejecting if an "error" event fires before the
   * bind callback does (e.g. EADDRINUSE). Without this, a failed bind left
   * `start()` awaiting a callback that never comes, hanging the whole proxy
   * (and the room screen's "connecting" state) forever with no feedback.
   */
  private bindLocalSocket(socket: UdpSocket, cfg: ProxyMode): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        reject(err);
      };
      socket.on("error", onError);
      // Keep the long-lived error handler used for post-bind failures too.
      socket.on("error", (err) => {
        this.status.lastError = err.message;
        this.emit();
      });

      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      if (cfg.mode === "guest") {
        socket.bind(cfg.localPort, "127.0.0.1", done);
      } else {
        this.lastGameAddr = {
          address: cfg.gameHost ?? "127.0.0.1",
          port: cfg.gamePort ?? BEDROCK_DEFAULT_PORT,
        };
        socket.bind(0, "0.0.0.0", done);
      }
    });
  }

  private tunnelToRelay(msg: Uint8Array): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Copy into a standalone ArrayBuffer so RN sends exactly these bytes.
      const copy = new Uint8Array(msg.length);
      copy.set(msg);
      this.ws.send(copy.buffer);
      this.status.bytesUp += msg.length;
      this.emit();
    }
  }

  async start(): Promise<void> {
    // Guard against double-start (e.g. an effect re-running) leaving a stale
    // socket bound to the same port, which would otherwise make the new bind
    // fail silently.
    if (this.localSocket || this.ws) this.stop();

    const cfg = this.config;

    // Local UDP side.
    const localSocket = dgram.createSocket({ type: "udp4" }) as unknown as UdpSocket;
    this.localSocket = localSocket;
    localSocket.on("message", (msg, rinfo) => {
      if (cfg.mode === "guest") {
        // Remember where the game is so replies can go back to it.
        this.lastGameAddr = { address: rinfo.address, port: rinfo.port };
      }
      this.tunnelToRelay(new Uint8Array(msg));
    });

    try {
      await this.bindLocalSocket(localSocket, cfg);
    } catch (err) {
      // Bind failed (e.g. port already in use) — surface it instead of
      // hanging forever waiting for a bind callback that will never fire,
      // and don't proceed to open the relay socket on top of a dead proxy.
      this.status.lastError =
        err instanceof Error ? err.message : "Não foi possível abrir a conexão local.";
      this.status.running = false;
      this.emit();
      try {
        localSocket.close();
      } catch {
        // ignore
      }
      if (this.localSocket === localSocket) this.localSocket = null;
      return;
    }

    // Relay WebSocket side.
    const ws = new WebSocket(`${RELAY_WS_URL}?token=${encodeURIComponent(this.relay.token)}`);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = () => {
      this.status.running = true;
      this.emit();
    };
    ws.onmessage = (event) => {
      const data = event.data;
      const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : null;
      if (!bytes) return;
      this.status.bytesDown += bytes.length;
      this.sendToGame(bytes);
      this.emit();
    };
    ws.onerror = () => {
      this.status.lastError = "relay connection error";
      this.emit();
    };
    ws.onclose = () => {
      this.status.running = false;
      this.emit();
    };
  }

  getStatus(): ProxyStatus {
    return { ...this.status };
  }

  stop(): void {
    try {
      this.ws?.close();
    } catch {
      // ignore
    }
    this.localSocket?.close();
    this.ws = null;
    this.localSocket = null;
    this.status = { running: false, bytesUp: 0, bytesDown: 0 };
    this.emit();
  }
}
