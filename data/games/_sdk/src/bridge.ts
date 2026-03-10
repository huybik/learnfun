import type {
  GameAPI,
  HostToGame,
  GameToHost,
  BridgeConfig,
  GameEndResults,
  MultiplayerGame,
  MultiplayerPeer,
} from './types'
import { createDevPanel, type DevPanel } from './dev-panel'

export class GameBridge {
  private game: GameAPI | null = null
  private devPanel: DevPanel | null = null
  private _prevStateJSON = ''
  private _prevFullStateJSON = ''
  readonly isIframe: boolean

  constructor(private config: BridgeConfig = {}) {
    this.isIframe = window.parent !== window
  }

  /** Connect a game to the bridge. In standalone mode, auto-inits with default data. */
  register(game: GameAPI) {
    this.game = game

    if (this.isIframe) {
      window.addEventListener('message', this.onHostMessage)
      this.sendToHost({ type: 'ready' })
    } else {
      this.devPanel = createDevPanel({
        actions: this.config.actions ?? [],
        defaultInitData: this.config.defaultInitData,
        onInit: (data) => this.game?.init(data),
        onAction: (name, params) => this.game?.handleAction(name, params),
        getState: () => this.game?.getState() ?? {},
      })
      // Auto-init in standalone mode so the game is immediately playable
      if (this.config.defaultInitData) {
        game.init(this.config.defaultInitData)
      }
    }
  }

  private onHostMessage = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    const msg = e.data as HostToGame
    if (!this.game || !msg?.type) return

    try {
      if (msg.type === 'init') {
        this.resetSnapshots()
        this.game.init(msg.data)
      } else if (msg.type === 'action') {
        if (this.handleInternalAction(msg.name, msg.params)) return
        this.game.handleAction(msg.name, msg.params)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[GameBridge]', message)
      this.emitEvent('error', { message })
    }
  }

  private sendToHost(msg: GameToHost) {
    if (this.isIframe) {
      window.parent.postMessage(msg, window.location.origin)
    }
    this.devPanel?.onGameMessage(msg)
  }

  /** Send state snapshot to host. Only sends when state actually changed. */
  updateState(state: Record<string, unknown>) {
    const json = JSON.stringify(state)
    if (json === this._prevStateJSON) return
    this._prevStateJSON = json
    this.sendToHost({ type: 'state', state })
  }

  /** Send a full authoritative snapshot for follower sync. */
  updateFullState(state: unknown) {
    const json = JSON.stringify(state)
    if (json === this._prevFullStateJSON) return
    this._prevFullStateJSON = json
    this.emitEvent('_fullState', { state })
  }

  /** Publish both teacher-facing state and the multiplayer snapshot. */
  syncState(state: Record<string, unknown>, fullState?: unknown) {
    this.updateState(state)
    if (typeof fullState !== 'undefined') {
      this.updateFullState(fullState)
    }
  }

  /** Emit a named event to host. */
  emitEvent(name: string, data: Record<string, unknown> = {}) {
    this.sendToHost({ type: 'event', name, data })
  }

  /** Relay a follower action to the leader. */
  relayAction(name: string, params: Record<string, unknown> = {}) {
    this.emitEvent('_relay', { name, params })
  }

  /** Signal game end to host. */
  endGame(results: GameEndResults) {
    this.sendToHost({ type: 'end', results })
  }

  destroy() {
    window.removeEventListener('message', this.onHostMessage)
    this.devPanel?.destroy()
    this.game?.destroy()
    this.game = null
  }

  private resetSnapshots() {
    this._prevStateJSON = ''
    this._prevFullStateJSON = ''
  }

  private getMultiplayerGame(): MultiplayerGame | null {
    return this.game as (GameAPI & MultiplayerGame) | null
  }

  private handleInternalAction(name: string, params: Record<string, unknown>): boolean {
    const game = this.getMultiplayerGame()

    switch (name) {
      case '_setRole':
        game?.setRole?.(!!params.isFollower)
        return true
      case '_sync':
        game?.applyFullState?.(params.state)
        return true
      case '_getFullState':
        if (typeof game?.getFullState === 'function') {
          this.updateFullState(game.getFullState())
        }
        return true
      case '_peers':
        game?.setPeers?.((params.players as MultiplayerPeer[]) || [])
        return true
      default:
        return false
    }
  }
}
