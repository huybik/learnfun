import type { GameAPI, HostToGame, GameToHost, BridgeConfig, GameEndResults } from './types'
import { createDevPanel, type DevPanel } from './dev-panel'

export class GameBridge {
  private game: GameAPI | null = null
  private devPanel: DevPanel | null = null
  private _prevStateJSON = ''
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
    const msg = e.data as HostToGame
    if (!this.game || !msg?.type) return

    if (msg.type === 'init') {
      this.game.init(msg.data)
    } else if (msg.type === 'action') {
      this.game.handleAction(msg.name, msg.params)
    }
  }

  private sendToHost(msg: GameToHost) {
    if (this.isIframe) {
      window.parent.postMessage(msg, '*')
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

  /** Emit a named event to host. */
  emitEvent(name: string, data: Record<string, unknown> = {}) {
    this.sendToHost({ type: 'event', name, data })
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
}
