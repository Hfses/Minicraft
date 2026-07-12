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
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`API ${status}: ${code}`);
  }
}

/** Thrown when the backend can't be reached (network error or timeout). */
export class NetworkError extends Error {
  constructor(message = "network_error") {
    super(message);
  }
}

async function fetchWithTimeout(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } catch (e) {
    // Abort or connection failure both surface as an unreachable backend.
    throw new NetworkError(e instanceof Error ? e.message : "network_error");
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const res = await fetchWithTimeout(
    path,
    { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } },
    timeoutMs,
  );
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

/**
 * Free hosts (Render) sleep when idle and take up to ~1 min to wake on the first
 * request. Ping /health repeatedly until it answers so the create/join flow can
 * show a "waking up" state instead of appearing frozen.
 *
 * onAttempt lets the UI report progress. Rejects with NetworkError if the server
 * never answers within maxWaitMs.
 */
export async function wakeBackend(opts?: {
  maxWaitMs?: number;
  onAttempt?: (attempt: number) => void;
}): Promise<void> {
  const maxWaitMs = opts?.maxWaitMs ?? 70000;
  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    opts?.onAttempt?.(attempt);
    try {
      const res = await fetchWithTimeout("/health", { method: "GET" }, 12000);
      if (res.ok) return;
    } catch {
      // server still asleep / unreachable — keep trying until the deadline
    }
    if (Date.now() >= deadline) throw new NetworkError("server_unreachable");
    await new Promise((r) => setTimeout(r, 3000));
  }
}

/** Fire-and-forget wake (e.g. on app open); never throws. */
export function prewarmBackend(): void {
  wakeBackend({ maxWaitMs: 60000 }).catch(() => {
    /* best effort */
  });
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
