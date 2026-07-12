/**
 * Shared protocol between the CraftTogether app and server.
 *
 * Nothing here touches Minecraft content. The relay only forwards opaque UDP
 * datagrams (RakNet packets produced by each player's own game) between two
 * peers that agreed to connect via a room code.
 */

/** Default UDP port a Minecraft Bedrock world broadcasts / listens on for LAN. */
export const BEDROCK_DEFAULT_PORT = 19132;

/** Length of a human-shareable room code (base32, no ambiguous chars). */
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

/**
 * Generate a room code from a source of random bytes. The caller provides the
 * randomness so this stays a pure function (easy to test, no platform deps).
 */
export function roomCodeFromBytes(bytes: Uint8Array, length = ROOM_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i % bytes.length] % ROOM_CODE_ALPHABET.length];
  }
  return out;
}

export function isValidRoomCode(code: string): boolean {
  if (typeof code !== "string" || code.length !== ROOM_CODE_LENGTH) return false;
  const upper = code.toUpperCase();
  for (const ch of upper) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export type RoomVisibility = "public" | "private";
export type PeerRole = "host" | "guest";

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  hostName: string;
  visibility: RoomVisibility;
  guestCount: number;
  maxGuests: number;
  createdAt: number;
}

/** WebSocket path where on-device proxies connect to the relay. */
export const RELAY_PATH = "/relay";

export interface RelayEndpoint {
  /**
   * Opaque per-peer session token. The proxy connects to
   * `${wsBase}${RELAY_PATH}?token=<token>` and the relay pipes messages to the
   * paired peer. Transport is WebSocket (TCP) so the backend needs no UDP/public
   * IP and hosts free anywhere.
   */
  token: string;
}

// ---- REST payloads ----

export interface CreateRoomRequest {
  name: string;
  hostName: string;
  visibility: RoomVisibility;
  maxGuests?: number;
}

export interface CreateRoomResponse {
  room: RoomSummary;
  /** Relay endpoint the host's proxy uses. */
  relay: RelayEndpoint;
  /** Token the host keeps to manage/refresh the room. */
  hostToken: string;
}

export interface JoinRoomRequest {
  code: string;
  guestName: string;
}

export interface JoinRoomResponse {
  room: RoomSummary;
  /** Relay endpoint the guest's proxy uses. */
  relay: RelayEndpoint;
  /** Token the guest keeps for presence/leave. */
  guestToken: string;
}

export interface ListRoomsResponse {
  rooms: RoomSummary[];
}

// ---- WebSocket signaling ----

/** Public identity of a peer in a room (safe to show/act on; not a secret token). */
export interface PeerInfo {
  peerId: string;
  name: string;
  role: PeerRole;
}

/** Stable public id used for the host in rosters and events. */
export const HOST_PEER_ID = "host";

export type SignalClientMessage =
  | { type: "hello"; token: string; role: PeerRole; roomId: string }
  | { type: "chat"; text: string }
  | { type: "kick"; peerId: string }
  | { type: "ping" }
  | { type: "leave" };

export type SignalServerMessage =
  | { type: "welcome"; room: RoomSummary; role: PeerRole; peerId: string; peers: PeerInfo[] }
  | { type: "room-update"; room: RoomSummary }
  | { type: "peer-joined"; peer: PeerInfo }
  | { type: "peer-left"; peer: PeerInfo }
  | { type: "chat"; from: string; peerId: string; text: string; ts: number }
  | { type: "relay-ready"; relay: RelayEndpoint }
  | { type: "kicked" }
  | { type: "host-left" }
  | { type: "pong" }
  | { type: "error"; message: string };
