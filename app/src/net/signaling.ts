import type {
  PeerRole,
  SignalClientMessage,
  SignalServerMessage,
} from "@crafttogether/shared";
import { WS_URL } from "@/config";

type Listener = (msg: SignalServerMessage) => void;
export type ConnectionState = "connecting" | "open" | "reconnecting" | "offline";
type StateListener = (state: ConnectionState) => void;

const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 20_000;
/** After this many failed attempts in a row, stop retrying automatically and
 *  tell the UI so it can offer a manual "tentar novamente" action instead of
 *  silently retrying forever in the background. */
const MAX_AUTO_RECONNECTS = 8;

/**
 * Thin WebSocket client for the signaling channel. It carries room state and
 * relay-ready notifications — never game traffic.
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private stateListeners = new Set<StateListener>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private reconnectAttempts = 0;
  private state: ConnectionState = "connecting";

  constructor(
    private readonly roomId: string,
    private readonly token: string,
    private readonly role: PeerRole,
  ) {}

  connect(): void {
    this.closedByUser = false;
    this.clearReconnectTimer();
    this.setState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.send({ type: "hello", token: this.token, role: this.role, roomId: this.roomId });
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), 20_000);
      this.reconnectAttempts = 0;
      this.setState("open");
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as SignalServerMessage;
        this.listeners.forEach((l) => l(msg));
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      this.clearPing();
      if (this.closedByUser) return;

      this.reconnectAttempts += 1;
      if (this.reconnectAttempts > MAX_AUTO_RECONNECTS) {
        this.setState("offline");
        return;
      }
      this.setState("reconnecting");
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** (this.reconnectAttempts - 1), RECONNECT_MAX_MS);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  /** Manually retry after the client gave up (state === "offline"). */
  retry(): void {
    this.reconnectAttempts = 0;
    this.connect();
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateListeners.forEach((l) => l(state));
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private send(msg: SignalClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendChat(text: string): void {
    this.send({ type: "chat", text });
  }

  kick(peerId: string): void {
    this.send({ type: "kick", peerId });
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  close(): void {
    this.closedByUser = true;
    this.clearPing();
    this.clearReconnectTimer();
    this.send({ type: "leave" });
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
    this.stateListeners.clear();
  }
}
