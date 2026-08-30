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
  /** O(1) reverse lookup, kept in sync with byToken/byRoom (see register/onClose/onKick). */
  private bySocket = new Map<WebSocket, Conn>();

  constructor(
    private readonly store: RoomStore,
    private readonly relay: RelayServer,
  ) {
    this.wss = new WebSocketServer({ noServer: true });
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => this.handleConnection(ws));
  }
