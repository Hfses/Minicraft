import { BEDROCK_DEFAULT_PORT, type RelayEndpoint } from "@crafttogether/shared";
import { RELAY_WS_URL } from "@/config";
import { loadDgram } from "./udp";

export { isUdpAvailable } from "./udp";

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
    const cfg = this.config;

    const dgram = loadDgram();
    if (!dgram) {
      // Build without the native UDP module (e.g. Expo Go): report and bail
      // out instead of crashing the screen.
      this.status.lastError = "udp_unavailable";
      this.emit();
      return;
    }

    // Local UDP side.
    const localSocket = dgram.createSocket({ type: "udp4" }) as unknown as UdpSocket;
    this.localSocket = localSocket;
    localSocket.on("error", (err) => {
      this.status.lastError = err.message;
      this.emit();
    });
    localSocket.on("message", (msg, rinfo) => {
      if (cfg.mode === "guest") {
        // Remember where the game is so replies can go back to it.
        this.lastGameAddr = { address: rinfo.address, port: rinfo.port };
      }
      this.tunnelToRelay(new Uint8Array(msg));
    });

    if (cfg.mode === "guest") {
      await new Promise<void>((resolve) => localSocket.bind(cfg.localPort, "127.0.0.1", () => resolve()));
    } else {
      this.lastGameAddr = {
        address: cfg.gameHost ?? "127.0.0.1",
        port: cfg.gamePort ?? BEDROCK_DEFAULT_PORT,
      };
      await new Promise<void>((resolve) => localSocket.bind(0, "0.0.0.0", () => resolve()));
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
