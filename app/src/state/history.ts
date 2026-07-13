import { readJson, writeJson } from "./storage";

/**
 * Connection history: every room the player hosted or joined. Powers the
 * profile stats and the "recent" section. Capped so storage stays small.
 */

export interface HistoryEntry {
  kind: "hosted" | "joined";
  roomName: string;
  code: string;
  at: number;
}

const KEY = "ct.history.v1";
const MAX_ENTRIES = 50;

export async function listHistory(): Promise<HistoryEntry[]> {
  return readJson<HistoryEntry[]>(KEY, []);
}

export async function recordHistory(entry: Omit<HistoryEntry, "at">): Promise<void> {
  const history = await listHistory();
  const next = [{ ...entry, at: Date.now() }, ...history].slice(0, MAX_ENTRIES);
  await writeJson(KEY, next);
}

export interface ProfileStats {
  hosted: number;
  joined: number;
  total: number;
}

export async function getStats(): Promise<ProfileStats> {
  const history = await listHistory();
  const hosted = history.filter((h) => h.kind === "hosted").length;
  return { hosted, joined: history.length - hosted, total: history.length };
}
