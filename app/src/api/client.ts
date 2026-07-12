import type {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ListRoomsResponse,
  RoomSummary,
} from "@crafttogether/shared";
import { API_URL } from "@/config";

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(`API ${status}: ${code}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let code = "unknown_error";
    try {
      const body = await res.json();
      code = body?.error ?? code;
    } catch {
      // ignore body parse errors
    }
    throw new ApiError(res.status, code);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),

  createRoom: (body: CreateRoomRequest) =>
    request<CreateRoomResponse>("/rooms", { method: "POST", body: JSON.stringify(body) }),

  listRooms: () => request<ListRoomsResponse>("/rooms"),

  joinRoom: (body: JoinRoomRequest) =>
    request<JoinRoomResponse>("/rooms/join", { method: "POST", body: JSON.stringify(body) }),

  getRoom: (id: string) => request<{ room: RoomSummary }>(`/rooms/${id}`),

  leave: (token: string) =>
    request<{ ok: boolean }>("/rooms/leave", { method: "POST", body: JSON.stringify({ token }) }),
};
