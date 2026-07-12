import { afterEach, describe, expect, it } from "vitest";
import http from "node:http";
import { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import type { SignalServerMessage } from "@crafttogether/shared";
import { RoomStore } from "../src/store.js";
import { RelayServer } from "../src/relay.js";
import { SignalingHub } from "../src/signaling.js";

/** Small helper: buffer incoming messages and await one matching a type. */
function collector(ws: WebSocket) {
  const queue: SignalServerMessage[] = [];
  const waiters: Array<{ type: string; resolve: (m: SignalServerMessage) => void }> = [];
  ws.on("message", (raw: Buffer) => {
    const msg = JSON.parse(raw.toString()) as SignalServerMessage;
    const i = waiters.findIndex((w) => w.type === msg.type);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else queue.push(msg);
  });
  return (type: string, timeoutMs = 2000): Promise<SignalServerMessage> => {
    const i = queue.findIndex((m) => m.type === type);
    if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
      waiters.push({ type, resolve: (m) => (clearTimeout(t), resolve(m)) });
    });
  };
}

function open(ws: WebSocket): Promise<void> {
  return new Promise((r) => ws.on("open", () => r()));
}

describe("Signaling: chat + kick", () => {
  let server: http.Server;
  const sockets: WebSocket[] = [];
  let store: RoomStore;
  let relay: RelayServer;

  async function start() {
    store = new RoomStore(180);
    relay = new RelayServer();
    const hub = new SignalingHub(store, relay);
    server = http.createServer();
    server.on("upgrade", (req, socket, head) => {
      if (new URL(req.url ?? "", "http://x").pathname === "/ws") hub.handleUpgrade(req, socket, head);
      else socket.destroy();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    return (server.address() as AddressInfo).port;
  }

  afterEach(async () => {
    for (const s of sockets.splice(0)) s.close();
    relay?.close();
    await new Promise<void>((r) => server?.close(() => r()));
  });

  it("relays chat between peers and lets the host kick a guest", async () => {
    const port = await start();
    const room = store.createRoom({
      name: "Sala",
      hostName: "Host",
      visibility: "public",
      maxGuests: 4,
    });
    const { session } = store.addGuest(room, "Amigo");

    const hostWs = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const guestWs = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    sockets.push(hostWs, guestWs);
    const hostRecv = collector(hostWs);
    const guestRecv = collector(guestWs);
    await Promise.all([open(hostWs), open(guestWs)]);

    hostWs.send(JSON.stringify({ type: "hello", token: room.hostToken, role: "host", roomId: room.id }));
    await hostRecv("welcome");

    guestWs.send(JSON.stringify({ type: "hello", token: session.guestToken, role: "guest", roomId: room.id }));
    await guestRecv("welcome");

    // Host is told the guest joined, with the guest's public id.
    const joined = await hostRecv("peer-joined");
    expect(joined.type === "peer-joined" && joined.peer.peerId).toBe(session.publicId);

    // Chat from guest reaches the host.
    guestWs.send(JSON.stringify({ type: "chat", text: "olá host" }));
    const chat = await hostRecv("chat");
    expect(chat.type === "chat" && chat.text).toBe("olá host");
    expect(chat.type === "chat" && chat.from).toBe("Amigo");

    // Host kicks the guest.
    hostWs.send(JSON.stringify({ type: "kick", peerId: session.publicId }));
    const kicked = await guestRecv("kicked");
    expect(kicked.type).toBe("kicked");
    // Guest is gone from the room.
    expect(store.getRoomById(room.id)?.guests.size).toBe(0);
    expect(relay.hasToken(session.guestRelayToken)).toBe(false);
  });

  it("ignores a kick from a non-host", async () => {
    const port = await start();
    const room = store.createRoom({
      name: "Sala",
      hostName: "Host",
      visibility: "public",
      maxGuests: 4,
    });
    const a = store.addGuest(room, "A").session;
    const b = store.addGuest(room, "B").session;

    const aWs = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    sockets.push(aWs);
    const aRecv = collector(aWs);
    await open(aWs);
    aWs.send(JSON.stringify({ type: "hello", token: a.guestToken, role: "guest", roomId: room.id }));
    await aRecv("welcome");

    // Guest A tries to kick guest B — must be rejected, B stays.
    aWs.send(JSON.stringify({ type: "kick", peerId: b.publicId }));
    const err = await aRecv("error");
    expect(err.type === "error" && err.message).toBe("not_allowed");
    expect(store.getRoomById(room.id)?.guests.size).toBe(2);
  });
});
