/** Every game implements this interface. */
export interface GameAPI {
  /** Initialize game with data from TA (or dev panel). */
  init(data: unknown): void
  /** Handle an action from user or teacher. */
  handleAction(name: string, params: Record<string, unknown>): void
  /** Return current state snapshot. */
  getState(): Record<string, unknown>
  /** Cleanup resources. */
  destroy(): void
}

/** Shared peer payload used by iframe multiplayer games. */
export interface MultiplayerPeer {
  id: string
  name: string
  score: number
  phase: string | null
}

/**
 * Optional hooks for games that participate in leader/follower sync.
 * The SDK owns the reserved multiplayer protocol and calls these hooks when present.
 */
export interface MultiplayerGame {
  setRole?(isFollower: boolean): void
  applyFullState?(state: unknown): void
  getFullState?(): unknown
  setPeers?(players: MultiplayerPeer[]): void
}

// --- Messages between host (iframe parent) and game ---

export type HostToGame =
  | { type: 'init'; data: unknown }
  | { type: 'action'; name: string; params: Record<string, unknown> }

export type GameToHost =
  | { type: 'ready' }
  | { type: 'state'; state: Record<string, unknown> }
  | { type: 'event'; name: string; data: Record<string, unknown> }
  | { type: 'end'; results: GameEndResults }

export interface GameEndResults {
  outcome: 'completed' | 'quit' | 'failed'
  finalScore?: number
  [key: string]: unknown
}

// --- Action definitions (for dev panel & teacher prompt injection) ---

export interface ActionDef {
  name: string
  description?: string
  params?: Record<string, string>
  godMode?: boolean
}

export interface BridgeConfig {
  actions?: ActionDef[]
  defaultInitData?: unknown
}
