import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import {
  HOST_PEER_ID,
  type PeerInfo,
  type PeerRole,
  type RelayEndpoint,
  type SignalClientMessage,
  type SignalServerMessage,
} from "@crafttogether/shared";
import type { RoomStore, Room } from "./store.js";
import type { RelayServer } from "./relay.js";

interface Conn {
  socket: WebSocket;
  roomId: string;
  role: PeerRole;
  token: string;
  name: string;
  peerId: string;
}

/**
 * WebSocket signaling hub: room state, relay-ready notifications, in-room chat,
 * and host moderation (kick). It never carries game traffic — that goes over the
 * UDP↔WebSocket relay.
 */
export class SignalingHub {
  private wss: WebSocketServer;
  private byToken = new Map<string, Conn>();
  private byRoom = new Map<string, Set<Conn>>();

  constructor(
    private readonly store: RoomStore,
    private readonly relay: RelayServer,
  ) {
    this.wss = new WebSocketServer({ noServer: true });
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => this.handleConnection(ws));
  }

  private send(socket: WebSocket, msg: SignalServerMessage): void {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
  }

  private handleConnection(socket: WebSocket): void {
    socket.on("message", (raw) => {
      let msg: SignalClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        this.send(socket, { type: "error", message: "invalid_json" });
        return;
      }
      this.onClientMessage(socket, msg);
    });
    socket.on("close", () => this.onClose(socket));
  }

  private peerInfo(conn: Conn): PeerInfo {
    return { peerId: conn.peerId, name: conn.name, role: conn.role };
  }

  private connFor(socket: WebSocket): Conn | undefined {
    for (const conn of this.byToken.values()) {
      if (conn.socket === socket) return conn;
    }
    return undefined;
  }

  private onClientMessage(socket: WebSocket, msg: SignalClientMessage): void {
    switch (msg.type) {
      case "hello":
        this.onHello(socket, msg);
        break;
      case "chat":
        this.onChat(socket, msg.text);
        break;
      case "kick":
        this.onKick(socket, msg.peerId);
        break;
      case "ping":
        this.send(socket, { type: "pong" });
        break;
      case "leave":
        this.onClose(socket);
        break;
      default:
        this.send(socket, { type: "error", message: "unknown_message" });
    }
  }

  private onHello(socket: WebSocket, msg: Extract<SignalClientMessage, { type: "hello" }>): void {
    const resolved = this.store.resolveToken(msg.token);
    if (!resolved || resolved.room.id !== msg.roomId || resolved.role !== msg.role) {
      this.send(socket, { type: "error", message: "auth_failed" });
      socket.close();
      return;
    }
    const { room, role } = resolved;
    const guest = role === "guest" ? room.guests.get(msg.token) : undefined;
    const conn: Conn = {
      socket,
      roomId: room.id,
      role,
      token: msg.token,
      name: role === "host" ? room.hostName : (guest?.name ?? "Amigo"),
      peerId: role === "host" ? HOST_PEER_ID : (guest?.publicId ?? "?"),
    };

    // Roster of peers already connected (before adding self).
    const peers: PeerInfo[] = [...(this.byRoom.get(room.id) ?? [])].map((c) => this.peerInfo(c));

    this.register(conn);
    this.store.touch(room);
    this.send(socket, {
      type: "welcome",
      room: this.store.toSummary(room),
      role,
      peerId: conn.peerId,
      peers,
    });
    this.broadcast(room, { type: "peer-joined", peer: this.peerInfo(conn) }, conn.token);
  }

  private onChat(socket: WebSocket, text: string): void {
    const conn = this.connFor(socket);
    if (!conn || typeof text !== "string") return;
    const clean = text.trim().slice(0, 400);
    if (!clean) return;
    const room = this.store.getRoomById(conn.roomId);
    if (!room) return;
    this.store.touch(room);
    this.broadcast(room, {
      type: "chat",
      from: conn.name,
      peerId: conn.peerId,
      text: clean,
      ts: Date.now(),
    });
  }

  private onKick(socket: WebSocket, peerId: string): void {
    const host = this.connFor(socket);
    if (!host || host.role !== "host") {
      this.send(socket, { type: "error", message: "not_allowed" });
      return;
    }
    const room = this.store.getRoomById(host.roomId);
    if (!room) return;
    const target = [...(this.byRoom.get(room.id) ?? [])].find(
      (c) => c.peerId === peerId && c.role === "guest",
    );
    if (!target) return;

    const removed = this.store.removeGuest(room, target.token);
    if (removed) {
      this.relay.unregisterToken(removed.guestRelayToken);
      this.relay.unregisterToken(removed.hostSideRelayToken);
    }
    this.send(target.socket, { type: "kicked" });
    this.byToken.delete(target.token);
    this.byRoom.get(room.id)?.delete(target);
    target.socket.close();
    this.broadcast(room, { type: "peer-left", peer: this.peerInfo(target) });
    this.broadcastRoomUpdate(room);
  }

  private register(conn: Conn): void {
    this.byToken.set(conn.token, conn);
    let set = this.byRoom.get(conn.roomId);
    if (!set) {
      set = new Set();
      this.byRoom.set(conn.roomId, set);
    }
    set.add(conn);
  }

  private onClose(socket: WebSocket): void {
    const conn = this.connFor(socket);
    if (!conn) return;
    this.byToken.delete(conn.token);
    this.byRoom.get(conn.roomId)?.delete(conn);
    const room = this.store.getRoomById(conn.roomId);
    if (room) this.broadcast(room, { type: "peer-left", peer: this.peerInfo(conn) });
  }

  private broadcast(room: Room, msg: SignalServerMessage, exceptToken?: string): void {
    const set = this.byRoom.get(room.id);
    if (!set) return;
    for (const conn of set) {
      if (exceptToken && conn.token === exceptToken) continue;
      this.send(conn.socket, msg);
    }
  }

  // ---- Called by the HTTP layer ----

  broadcastRoomUpdate(room: Room): void {
    this.broadcast(room, { type: "room-update", room: this.store.toSummary(room) });
  }

  notifyHostRelayReady(room: Room, relay: RelayEndpoint): void {
    const set = this.byRoom.get(room.id);
    if (!set) return;
    for (const conn of set) {
      if (conn.role === "host") this.send(conn.socket, { type: "relay-ready", relay });
    }
  }

  notifyHostLeft(room: Room): void {
    this.broadcast(room, { type: "host-left" });
  }

  close(): void {
    for (const conn of this.byToken.values()) conn.socket.close();
    this.wss.close();
  }
}
