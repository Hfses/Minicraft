import type {
  PeerRole,
  SignalClientMessage,
  SignalServerMessage,
} from "@crafttogether/shared";
import { WS_URL } from "@/config";

type Listener = (msg: SignalServerMessage) => void;

/**
 * Thin WebSocket client for the signaling channel. It carries room state and
 * relay-ready notifications — never game traffic.
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private closedByUser = false;

  constructor(
    private readonly roomId: string,
    private readonly token: string,
    private readonly role: PeerRole,
  ) {}

  connect(): void {
    this.closedByUser = false;
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.send({ type: "hello", token: this.token, role: this.role, roomId: this.roomId });
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), 20_000);
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
      if (!this.closedByUser) {
        // Simple reconnect after a short delay.
        setTimeout(() => this.connect(), 2000);
      }
    };
    ws.onerror = () => ws.close();
  }

  private send(msg: SignalClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
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
    this.send({ type: "leave" });
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }
}
