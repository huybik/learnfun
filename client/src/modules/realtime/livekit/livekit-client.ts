/**
 * Browser-side LiveKit connection wrapper.
 * Manages room connection, track publication/subscription, and participant events.
 */

import {
  Room,
  RoomEvent,
  Track,
  ConnectionState,
  type RemoteParticipant,
  type LocalParticipant,
  type RemoteTrackPublication,
  type Participant,
  type RoomOptions,
} from "livekit-client";
import { createLogger } from "@/lib/logger";

const log = createLogger("livekit-client");

export interface LivekitConnectionConfig {
  url: string;
  token: string;
  roomOptions?: Partial<RoomOptions>;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface LivekitConnection {
  room: Room;
  connect: () => Promise<void>;
  disconnect: () => void;
  getConnectionState: () => ConnectionStatus;
  onConnectionChange: (cb: (state: ConnectionStatus) => void) => () => void;
  onParticipantJoined: (cb: (p: RemoteParticipant) => void) => () => void;
  onParticipantLeft: (cb: (p: RemoteParticipant) => void) => () => void;
  onTrackSubscribed: (
    cb: (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => void,
  ) => () => void;
  getLocalParticipant: () => LocalParticipant | undefined;
  getParticipants: () => Participant[];
}

/**
 * Create a LiveKit connection wrapper for the browser.
 * Call connect() to join, disconnect() to leave.
 */
export function createLivekitConnection(config: LivekitConnectionConfig): LivekitConnection {
  const { url, token, roomOptions } = config;

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    ...roomOptions,
  });

  const connectionListeners = new Set<(state: ConnectionStatus) => void>();

  function mapState(state: ConnectionState): ConnectionStatus {
    switch (state) {
      case ConnectionState.Connected:
        return "connected";
      case ConnectionState.Connecting:
        return "connecting";
      case ConnectionState.Reconnecting:
        return "reconnecting";
      default:
        return "disconnected";
    }
  }

  // Broadcast connection state changes
  room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
    const mapped = mapState(state);
    log.info("Connection state changed", { state: mapped });
    connectionListeners.forEach((cb) => cb(mapped));
  });

  async function connect() {
    log.info("Connecting to LiveKit room", { url });
    await room.connect(url, token);
    log.info("Connected to LiveKit room", { roomName: room.name });
  }

  function disconnect() {
    log.info("Disconnecting from LiveKit room");
    room.disconnect();
  }

  function getConnectionState(): ConnectionStatus {
    return mapState(room.state);
  }

  function onConnectionChange(cb: (state: ConnectionStatus) => void): () => void {
    connectionListeners.add(cb);
    return () => {
      connectionListeners.delete(cb);
    };
  }

  function onParticipantJoined(cb: (p: RemoteParticipant) => void): () => void {
    room.on(RoomEvent.ParticipantConnected, cb);
    return () => {
      room.off(RoomEvent.ParticipantConnected, cb);
    };
  }

  function onParticipantLeft(cb: (p: RemoteParticipant) => void): () => void {
    room.on(RoomEvent.ParticipantDisconnected, cb);
    return () => {
      room.off(RoomEvent.ParticipantDisconnected, cb);
    };
  }

  function onTrackSubscribed(
    cb: (track: Track, publication: RemoteTrackPublication, participant: RemoteParticipant) => void,
  ): () => void {
    room.on(RoomEvent.TrackSubscribed, cb);
    return () => {
      room.off(RoomEvent.TrackSubscribed, cb);
    };
  }

  function getLocalParticipant(): LocalParticipant | undefined {
    return room.localParticipant;
  }

  function getParticipants(): Participant[] {
    const all: Participant[] = [];
    if (room.localParticipant) all.push(room.localParticipant);
    room.remoteParticipants.forEach((p) => all.push(p));
    return all;
  }

  return {
    room,
    connect,
    disconnect,
    getConnectionState,
    onConnectionChange,
    onParticipantJoined,
    onParticipantLeft,
    onTrackSubscribed,
    getLocalParticipant,
    getParticipants,
  };
}
