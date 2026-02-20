export type ClientConnectionState = "disconnected" | "connecting" | "connected";

export class RealtimeClient {
  private state: ClientConnectionState = "disconnected";

  getState(): ClientConnectionState {
    return this.state;
  }

  connect(): void {
    this.state = "connecting";
    // Placeholder for websocket wiring.
    this.state = "connected";
  }

  disconnect(): void {
    this.state = "disconnected";
  }
}
