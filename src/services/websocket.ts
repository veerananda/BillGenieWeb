/**
 * WebSocket Service for Web
 * Ported from BillGenieFrontEnd/src/services/websocket.ts
 * Changes: AsyncStorage → localStorage, EXPO_PUBLIC_* → VITE_*
 */

type WSEvent =
  | 'connected'
  | 'disconnected'
  | 'order_created'
  | 'order_updated'
  | 'order_completed'
  | 'order_cancelled'
  | 'order_item_status_changed'
  | 'order_status_changed'
  | 'table_status_changed'
  | 'checkout_started'
  | 'checkout_cancelled'
  | 'inventory_updated'
  | 'menu_updated';

type WSPayload = Record<string, unknown>;
type EventCallback = (payload: WSPayload) => void;

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'wss://billgenie-api.fly.dev';
const WS_DEBUG = import.meta.env.DEV;
const TOKEN_KEY = 'auth_token';

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;
const PING_INTERVAL_MS = 30000;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<WSEvent, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = false;
  private connecting = false;

  on(event: WSEvent, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off(event: WSEvent, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: WSEvent, payload: WSPayload = {}): void {
    this.listeners.get(event)?.forEach((cb) => {
      try { cb(payload); } catch (e) { console.error('[WS] listener error:', e); }
    });
  }

  connect(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    if (this.connecting || this.ws?.readyState === WebSocket.OPEN) return;

    this.shouldReconnect = true;
    this.connecting = true;

    const url = `${WS_BASE_URL}/ws`;

    try {
      // Prefer Sec-WebSocket-Protocol over ?token= so JWTs are not logged in URLs.
      this.ws = new WebSocket(url, ['billgenie', token]);
    } catch (e) {
      console.error('[WS] failed to create WebSocket:', e);
      this.connecting = false;
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (WS_DEBUG) console.log('[WS] connected');
      this.connecting = false;
      this.reconnectAttempts = 0;
      this.emit('connected');
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        // Backend sends: { type, room_id, timestamp, data: {...} }
        // Mobile WS emits message.data — we do the same.
        const message = JSON.parse(event.data) as { type: WSEvent; data?: WSPayload } & WSPayload;
        if (WS_DEBUG) console.log('[WS] message:', message.type, message.data ?? message);
        if (message?.type) {
          this.emit(message.type, message.data ?? {});
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      console.error('[WS] error — connection failed or dropped');
      this.connecting = false;
    };

    this.ws.onclose = (ev) => {
      if (WS_DEBUG) console.log('[WS] closed — code:', ev.code, 'clean:', ev.wasClean);
      this.connecting = false;
      this.stopPing();
      this.emit('disconnected');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopPing();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  resetReconnectAttempts(): void {
    this.reconnectAttempts = 0;
  }

  /** Close the current socket and open a fresh one — mirrors mobile's forceReconnect. */
  async forceReconnect(): Promise<void> {
    this.shouldReconnect = true;
    this.resetReconnectAttempts();
    this.clearReconnectTimer();
    this.stopPing();

    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      this.connecting = false;
      old.onopen = null;
      old.onmessage = null;
      old.onerror = null;
      old.onclose = null;
      old.close();
    }

    this.connecting = false;
    this.connect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * Math.min(this.reconnectAttempts, 5);
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try { this.ws.send(JSON.stringify({ type: 'ping' })); } catch { /* ignore */ }
      }
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

export const wsService = new WebSocketService();
export default wsService;
