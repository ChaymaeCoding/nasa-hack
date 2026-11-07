import { TelemetryPacket, TrajectoryPoint, PilotCommand } from '../types/telemetry';

type TelemetryListener = (telemetry: TelemetryPacket) => void;
type ConnectionStatusListener = (connected: boolean, mode: 'WEBSOCKET' | 'STANDALONE') => void;

class TelemetryStore {
  private currentTelemetry: TelemetryPacket | null = null;
  private trajectoryHistory: TrajectoryPoint[] = [];
  private maxHistoryLength = 400;

  private telemetryListeners: Set<TelemetryListener> = new Set();
  private connectionListeners: Set<ConnectionStatusListener> = new Set();

  private isConnected = false;
  private connectionMode: 'WEBSOCKET' | 'STANDALONE' = 'STANDALONE';

  private activeCommand: PilotCommand = {
    mode: 'AI',
    throttle: 0.0,
    gimbal_pitch: 0.0,
    gimbal_yaw: 0.0,
    rcs_roll: 0.0,
    disturbance_vector: [0.0, 0.0]
  };

  public getTelemetry(): TelemetryPacket | null {
    return this.currentTelemetry;
  }

  public getTrajectoryHistory(): TrajectoryPoint[] {
    return this.trajectoryHistory;
  }

  public getConnectionStatus(): { connected: boolean; mode: 'WEBSOCKET' | 'STANDALONE' } {
    return {
      connected: this.isConnected,
      mode: this.connectionMode
    };
  }

  public getPilotCommand(): PilotCommand {
    return this.activeCommand;
  }

  public setPilotCommand(cmd: Partial<PilotCommand>): void {
    this.activeCommand = { ...this.activeCommand, ...cmd };
  }

  public setConnectionStatus(connected: boolean, mode: 'WEBSOCKET' | 'STANDALONE'): void {
    this.isConnected = connected;
    this.connectionMode = mode;
    this.connectionListeners.forEach(listener => listener(connected, mode));
  }

  public publishTelemetry(packet: TelemetryPacket): void {
    this.currentTelemetry = packet;

    // Append to trajectory history buffer
    this.trajectoryHistory.push({
      time: packet.timestamp,
      x: packet.position.x,
      y: packet.position.y,
      altitude: packet.position.z,
      vz: packet.velocity.vz,
      tilt: packet.euler.tilt
    });

    if (this.trajectoryHistory.length > this.maxHistoryLength) {
      this.trajectoryHistory.shift();
    }

    // Distribute to all subscribers
    this.telemetryListeners.forEach(listener => listener(packet));
  }

  public subscribeTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    if (this.currentTelemetry) {
      listener(this.currentTelemetry);
    }
    return () => {
      this.telemetryListeners.delete(listener);
    };
  }

  public subscribeConnection(listener: ConnectionStatusListener): () => void {
    this.connectionListeners.add(listener);
    listener(this.isConnected, this.connectionMode);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  public resetHistory(): void {
    this.trajectoryHistory = [];
  }
}

export const telemetryStore = new TelemetryStore();
