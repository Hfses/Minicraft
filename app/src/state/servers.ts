import { readJson, writeJson } from "./storage";

/**
 * Saved Minecraft Bedrock servers (Multiplayer Master style server list).
 * Stored locally on the device; live status (ping/players) is fetched at
 * runtime by src/net/serverPing.ts and never persisted.
 */

export interface SavedServer {
  id: string;
  name: string;
  address: string;
  port: number;
  favorite: boolean;
  addedAt: number;
}

const KEY = "ct.servers.v1";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Well-known public Bedrock servers pre-seeded on first run. */
const DEFAULT_SERVERS: Omit<SavedServer, "id" | "addedAt">[] = [
  { name: "The Hive", address: "geo.hivebedrock.network", port: 19132, favorite: false },
  { name: "CubeCraft", address: "mco.cubecraft.net", port: 19132, favorite: false },
  { name: "Lifeboat", address: "mco.lbsg.net", port: 19132, favorite: false },
  { name: "Galaxite", address: "play.galaxite.net", port: 19132, favorite: false },
];

export async function listServers(): Promise<SavedServer[]> {
  const existing = await readJson<SavedServer[] | null>(KEY, null);
  if (existing) return existing;
  // First run: seed with well-known servers so the tab isn't empty.
  const seeded = DEFAULT_SERVERS.map((s) => ({ ...s, id: makeId(), addedAt: Date.now() }));
  await writeJson(KEY, seeded);
  return seeded;
}

export async function addServer(input: {
  name: string;
  address: string;
  port?: number;
}): Promise<SavedServer> {
  const servers = await listServers();
  const server: SavedServer = {
    id: makeId(),
    name: input.name.trim().slice(0, 48) || input.address,
    address: input.address.trim(),
    port: input.port && input.port > 0 && input.port <= 65535 ? input.port : 19132,
    favorite: false,
    addedAt: Date.now(),
  };
  await writeJson(KEY, [server, ...servers]);
  return server;
}

export async function removeServer(id: string): Promise<SavedServer[]> {
  const next = (await listServers()).filter((s) => s.id !== id);
  await writeJson(KEY, next);
  return next;
}

export async function toggleFavorite(id: string): Promise<SavedServer[]> {
  const next = (await listServers()).map((s) =>
    s.id === id ? { ...s, favorite: !s.favorite } : s,
  );
  await writeJson(KEY, next);
  return next;
}
