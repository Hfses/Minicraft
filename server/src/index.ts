import { loadConfig } from "./config.js";
import { RoomStore } from "./store.js";
import { RelayServer } from "./relay.js";
import { SignalingHub } from "./signaling.js";
import { buildHttpServer } from "./http.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const store = new RoomStore(config.sessionTtlSeconds);
  const relay = new RelayServer();
  const hub = new SignalingHub(store);

  const app = buildHttpServer({ config, store, relay, hub });
  await app.listen({ port: config.port, host: "0.0.0.0" });

  // Route WebSocket upgrades: /ws -> signaling, /relay -> relay.
  app.server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url ?? "", "http://localhost").pathname;
    if (pathname === "/ws") hub.handleUpgrade(request, socket, head);
    else if (pathname === "/relay") relay.handleUpgrade(request, socket, head);
    else socket.destroy();
  });

  console.log(`[http] REST + ws://.../ws + ws://.../relay on :${config.port}`);

  const sweepTimer = setInterval(() => {
    const closed = store.sweepExpired();
    for (const room of closed) hub.notifyHostLeft(room);
  }, 30_000);
  sweepTimer.unref();

  const shutdown = async () => {
    clearInterval(sweepTimer);
    hub.close();
    relay.close();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("fatal", err);
  process.exit(1);
});
