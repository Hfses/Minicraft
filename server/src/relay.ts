import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";

interface PeerState {
  /** Token this peer is paired with; messages are forwarded there. */
  peerToken: string;
  socket?: WebSocket;
}

/**
 * WebSocket relay. It knows nothing about Minecraft or RakNet: it pipes opaque
 * binary messages between exactly two paired tokens. Using WebSocket (TCP) means
 * the backend needs no UDP or dedicated public IP, so it hosts on any free tier
 * and traverses restrictive NATs/firewalls that block UDP.
 *
 * A proxy connects to `/relay?token=<token>`; once both paired proxies are
 * connected, every binary message from one is forwarded verbatim to the other.
 */
export class RelayServer {
  private wss = new WebSocketServer({ noServer: true });
  private peers = new Map<string, PeerState>();

  onForward?: (fromToken: string, bytes: number) => void;

  registerPair(tokenA: string, tokenB: string): void {
    this.peers.set(tokenA, { peerToken: tokenB });
    this.peers.set(tokenB, { peerToken: tokenA });
  }

  unregisterToken(token: string): void {
    const peer = this.peers.get(token);
    peer?.socket?.close();
    this.peers.delete(token);
    if (peer) {
      const other = this.peers.get(peer.peerToken);
      other?.socket?.close();
      this.peers.delete(peer.peerToken);
    }
  }

  hasToken(token: string): boolean {
    return this.peers.has(token);
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const token = new URL(request.url ?? "", "http://localhost").searchParams.get("token");
    if (!token || !this.peers.has(token)) {
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(request, socket, head, (ws) => this.onConnection(ws, token));
  }

  private onConnection(ws: WebSocket, token: string): void {
    const peer = this.peers.get(token);
    if (!peer) {
      ws.close();
      return;
    }
    peer.socket = ws;
    ws.binaryType = "nodebuffer";

    ws.on("message", (data: Buffer, isBinary: boolean) => {
      const dest = this.peers.get(peer.peerToken);
      if (dest?.socket && dest.socket.readyState === dest.socket.OPEN) {
        dest.socket.send(data, { binary: isBinary });
        this.onForward?.(token, (data as Buffer).length);
      }
    });
    ws.on("close", () => {
      if (peer.socket === ws) peer.socket = undefined;
    });
    ws.on("error", () => ws.close());
  }

  close(): void {
    for (const peer of this.peers.values()) peer.socket?.close();
    this.peers.clear();
    this.wss.close();
  }
}
