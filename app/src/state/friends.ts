import { readJson, writeJson } from "./storage";

/**
 * Local friends list. Friends are identified by their friend code (each
 * player gets one in src/state/session.ts) plus a display name. Presence
 * (online status) requires accounts/backend and is on the roadmap; the list
 * itself is fully functional offline.
 */

export interface Friend {
  code: string;
  name: string;
  favorite: boolean;
  addedAt: number;
}

const KEY = "ct.friends.v1";

export async function listFriends(): Promise<Friend[]> {
  return readJson<Friend[]>(KEY, []);
}

export async function addFriend(input: { name: string; code: string }): Promise<Friend[]> {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim().slice(0, 32);
  const friends = await listFriends();
  if (friends.some((f) => f.code === code)) return friends;
  const next = [{ code, name, favorite: false, addedAt: Date.now() }, ...friends];
  await writeJson(KEY, next);
  return next;
}

export async function removeFriend(code: string): Promise<Friend[]> {
  const next = (await listFriends()).filter((f) => f.code !== code);
  await writeJson(KEY, next);
  return next;
}

export async function toggleFriendFavorite(code: string): Promise<Friend[]> {
  const next = (await listFriends()).map((f) =>
    f.code === code ? { ...f, favorite: !f.favorite } : f,
  );
  await writeJson(KEY, next);
  return next;
}
