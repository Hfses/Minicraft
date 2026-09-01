import AsyncStorage from "@react-native-async-storage/async-storage";
const FAVORITES = "ct.favoriteRooms";
const RECENT = "ct.recentRooms";
async function read(key: string): Promise<string[]> { try { const raw = await AsyncStorage.getItem(key); const value = raw ? JSON.parse(raw) : []; return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; } }
async function write(key: string, value: string[]) { try { await AsyncStorage.setItem(key, JSON.stringify([...new Set(value)].slice(0, 30))); } catch { /* armazenamento opcional */ } }
export const library = { getFavorites: () => read(FAVORITES), getRecent: () => read(RECENT), async toggleFavorite(id: string) { const current = await read(FAVORITES); const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]; await write(FAVORITES, next); return next; }, async addRecent(id: string) { const current = await read(RECENT); const next = [id, ...current.filter((item) => item !== id)]; await write(RECENT, next); return next; } };
