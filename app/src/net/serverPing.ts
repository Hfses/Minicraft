import { loadDgram } from "./udp";

/**
 * Pings a single Minecraft Bedrock server with a RakNet "Unconnected Ping"
 * and parses the "Unconnected Pong" reply — the same handshake the game uses
 * on the server list screen. Returns MOTD, player counts, version and RTT.
 *
 * Requires the native UDP module; in builds without it (e.g. Expo Go) the
 * result is { status: "unavailable" } and the UI shows a hint instead.
 */

export interface ServerStatus {
  status: "online" | "offline" | "unavailable";
  pingMs?: number;
  motd?: string;
  version?: string;
  players?: number;
  maxPlayers?: number;
}

const MAGIC = Uint8Array.from([
  0x00, 0xff, 0xff, 0x00, 0xfe, 0xfe, 0xfe, 0xfe, 0xfd, 0xfd, 0xfd, 0xfd, 0x12, 0x34, 0x56, 0x78,
]);
const ID_UNCONNECTED_PING = 0x01;
const ID_UNCONNECTED_PONG = 0x1c;

function buildPing(): Uint8Array {
  const buf = new Uint8Array(1 + 8 + MAGIC.length + 8);
  const view = new DataView(buf.buffer);
  buf[0] = ID_UNCONNECTED_PING;
  view.setUint32(5, (Date.now() >>> 0) & 0xffffffff, false);
  buf.set(MAGIC, 9);
  view.setUint32(9 + MAGIC.length, 0x43524146, false);
  view.setUint32(9 + MAGIC.length + 4, 0x54474852, false);
  return buf;
}

function parsePong(msg: Uint8Array): Omit<ServerStatus, "status" | "pingMs"> | null {
  if (msg.length < 35 || msg[0] !== ID_UNCONNECTED_PONG) return null;
  const view = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  const strLen = view.getUint16(33, false);
  if (msg.length < 35 + strLen) return null;
  const id = new TextDecoder().decode(msg.subarray(35, 35 + strLen));
  // MCPE;<motd>;<protocol>;<version>;<players>;<max>;<serverId>;<world>;...
  const parts = id.split(";");
  const players = Number.parseInt(parts[4] ?? "", 10);
  const maxPlayers = Number.parseInt(parts[5] ?? "", 10);
  return {
    motd: parts[1]?.trim() || undefined,
    version: parts[3]?.trim() || undefined,
    players: Number.isFinite(players) ? players : undefined,
    maxPlayers: Number.isFinite(maxPlayers) ? maxPlayers : undefined,
  };
}

interface PingSocket {
  bind(port: number, address?: string, cb?: () => void): void;
  on(event: "message", cb: (msg: Buffer) => void): void;
  send(msg: Uint8Array, offset: number, length: number, port: number, address: string): void;
  close(cb?: () => void): void;
}

export function pingServer(
  address: string,
  port: number,
  timeoutMs = 4000,
): Promise<ServerStatus> {
  const dgram = loadDgram();
  if (!dgram) return Promise.resolve({ status: "unavailable" });

  return new Promise((resolve) => {
    let socket: PingSocket | null = null;
    let done = false;
    const started = Date.now();

    const finish = (result: ServerStatus) => {
      if (done) return;
      done = true;
      try {
        socket?.close();
      } catch {
        // ignore
      }
      resolve(result);
    };

    try {
      socket = dgram.createSocket({ type: "udp4" }) as unknown as PingSocket;
    } catch {
      finish({ status: "unavailable" });
      return;
    }

    socket.on("message", (msg) => {
      const info = parsePong(new Uint8Array(msg));
      if (info) finish({ status: "online", pingMs: Date.now() - started, ...info });
    });

    socket.bind(0, "0.0.0.0", () => {
      try {
        const ping = buildPing();
        socket?.send(ping, 0, ping.length, port, address);
      } catch {
        finish({ status: "offline" });
      }
      setTimeout(() => finish({ status: "offline" }), timeoutMs);
    });
  });
}
