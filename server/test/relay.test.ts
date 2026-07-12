import { afterEach, describe, expect, it } from "vitest";
import http from "node:http";
import { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { RelayServer } from "../src/relay.js";

/**
 * Proves opaque binary messages cross the WebSocket relay end-to-end in both
 * directions, simulating the host-side and guest-side on-device proxies. No
 * Minecraft needed: two WebSocket clients stand in for the two proxies.
 */

function waitOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => ws.on("open", () => resolve()));
}
function onceMessage(ws: WebSocket): Promise<Buffer> {
  return new Promise((resolve) => ws.once("message", (d: Buffer) => resolve(d)));
}

describe("RelayServer (WebSocket)", () => {
  let server: http.Server;
  let relay: RelayServer;
  const clients: WebSocket[] = [];

  async function start(): Promise<number> {
    relay = new RelayServer();
    server = http.createServer();
    server.on("upgrade", (req, socket, head) => {
      if (new URL(req.url ?? "", "http://x").pathname === "/relay") {
        relay.handleUpgrade(req, socket, head);
      } else socket.destroy();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    return (server.address() as AddressInfo).port;
  }

  afterEach(async () => {
    for (const c of clients.splice(0)) c.close();
    relay?.close();
    await new Promise<void>((r) => server?.close(() => r()));
  });

  it("forwards messages between two paired peers in both directions", async () => {
    const port = await start();
    relay.registerPair("guest-tok", "host-tok");

    const guest = new WebSocket(`ws://127.0.0.1:${port}/relay?token=guest-tok`);
    const host = new WebSocket(`ws://127.0.0.1:${port}/relay?token=host-tok`);
    clients.push(guest, host);
    await Promise.all([waitOpen(guest), waitOpen(host)]);

    const hostRecv = onceMessage(host);
    guest.send(Buffer.from("HELLO_FROM_GUEST"));
    expect((await hostRecv).toString()).toBe("HELLO_FROM_GUEST");

    const guestRecv = onceMessage(guest);
    host.send(Buffer.from("WELCOME_FROM_HOST"));
    expect((await guestRecv).toString()).toBe("WELCOME_FROM_HOST");
  });

  it("rejects a connection with an unknown token", async () => {
    const port = await start();
    const stranger = new WebSocket(`ws://127.0.0.1:${port}/relay?token=nope`);
    clients.push(stranger);
    const rejected = await new Promise<boolean>((resolve) => {
      // Destroying the socket surfaces as either 'error' (ECONNRESET) or 'close'.
      stranger.on("error", () => resolve(true));
      stranger.on("close", () => resolve(true));
      stranger.on("open", () => resolve(false));
    });
    expect(rejected).toBe(true);
  });

  it("stops forwarding after a token is unregistered", async () => {
    const port = await start();
    relay.registerPair("a", "b");
    const a = new WebSocket(`ws://127.0.0.1:${port}/relay?token=a`);
    const b = new WebSocket(`ws://127.0.0.1:${port}/relay?token=b`);
    clients.push(a, b);
    await Promise.all([waitOpen(a), waitOpen(b)]);

    let forwarded = false;
    relay.onForward = () => {
      forwarded = true;
    };
    relay.unregisterToken("a");
    await new Promise((r) => setTimeout(r, 30));
    // b's socket was closed by unregister; sending from a (also closed) forwards nothing.
    if (a.readyState === a.OPEN) a.send(Buffer.from("after"));
    await new Promise((r) => setTimeout(r, 30));
    expect(forwarded).toBe(false);
  });
});
