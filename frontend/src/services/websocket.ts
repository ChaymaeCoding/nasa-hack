import { TelemetryPacket, PilotCommand } from '../types/telemetry';
import { telemetryStore } from './telemetryStore';
import { fallbackSimulator } from './fallbackTelemetry';

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private reconnectTimer: number | null = null;
  private shouldConnect = true;

  constructor(url = 'ws://localhost:8000/ws') {
    this.url = url;
  }

  public connect(): void {
    this.shouldConnect = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        telemetryStore.setConnectionStatus(true, 'WEBSOCKET');
        // Stop fallback simulator when live backend is providing data
        fallbackSimulator.stop();
      };

      this.ws.onmessage = (event) => {
        try {
          const packet: TelemetryPacket = JSON.parse(event.data);
          telemetryStore.publishTelemetry(packet);
        } catch {
          // Ignore invalid parse
        }
      };

      this.ws.onerror = () => {
        // Fallback to standalone simulation
        this.activateFallback();
      };

      this.ws.onclose = () => {
        this.activateFallback();
        this.scheduleReconnect();
      };
    } catch {
      this.activateFallback();
      this.scheduleReconnect();
    }
  }

  private activateFallback(): void {
    telemetryStore.setConnectionStatus(false, 'STANDALONE');
    // Ensure standalone simulator is actively running and publishing
    fallbackSimulator.start((packet) => {
      telemetryStore.publishTelemetry(packet);
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldConnect) return;
    if (this.reconnectTimer !== null) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  public sendCommand(command: PilotCommand): void {
    // If backend is connected, transmit over WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    }
    // Always apply to local simulator as well for instant responsiveness
    fallbackSimulator.setPilotCommand(command);
    telemetryStore.setPilotCommand(command);
  }

  public disconnect(): void {
    this.shouldConnect = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
