import type { ActionDef, GameToHost } from './types'

export interface DevPanelCallbacks {
  actions: ActionDef[]
  defaultInitData?: unknown
  onInit: (data: unknown) => void
  onAction: (name: string, params: Record<string, unknown>) => void
  getState: () => Record<string, unknown>
}

export interface DevPanel {
  onGameMessage(msg: GameToHost): void
  destroy(): void
}

export function createDevPanel(cb: DevPanelCallbacks): DevPanel {
  const panel = document.createElement('div')
  panel.id = 'game-dev-panel'

  // --- Build action buttons HTML ---
  let actionsHTML = ''
  for (const a of cb.actions) {
    const paramEntries = Object.entries(a.params ?? {})
    const inputs = paramEntries
      .map(([p, t]) => `<input data-action="${a.name}" data-param="${p}" placeholder="${p} (${t})" />`)
      .join('')
    const tag = a.godMode ? ' <span class="god">GOD</span>' : ''
    actionsHTML += `<div class="action-row"><button class="action-btn" data-action="${a.name}">${a.name}${tag}</button>${inputs}</div>`
  }

  panel.innerHTML = `
    <h3>Init Data</h3>
    <textarea id="dp-init">${JSON.stringify(cb.defaultInitData ?? {}, null, 2)}</textarea>
    <button id="dp-init-btn">Init Game</button>

    <h3>Actions</h3>
    <div id="dp-actions">${actionsHTML}</div>

    <h3>State</h3>
    <pre id="dp-state">{}</pre>
    <button id="dp-refresh">Refresh</button>

    <h3>Events</h3>
    <div id="dp-events"></div>
  `
  // Wrap existing body content + panel in a flex container
  const wrapper = document.createElement('div')
  wrapper.id = 'game-dev-wrapper'
  while (document.body.firstChild) wrapper.appendChild(document.body.firstChild)
  document.body.appendChild(wrapper)
  wrapper.appendChild(panel)

  // --- Inject styles ---
  const style = document.createElement('style')
  style.textContent = `
    #game-dev-wrapper {
      display: flex; height: 100vh; overflow: hidden;
    }
    #game-dev-wrapper > *:first-child {
      flex: 1; overflow: auto;
    }
    #game-dev-panel {
      width: 320px; flex-shrink: 0;
      background: #1a1a2e; color: #ddd; font-family: monospace; font-size: 12px;
      overflow-y: auto; padding: 12px; border-left: 2px solid #333;
    }
    #game-dev-panel h3 { margin: 12px 0 4px; color: #7c8aff; font-size: 13px; }
    #game-dev-panel textarea, #game-dev-panel input {
      width: 100%; background: #0d1117; color: #eee; border: 1px solid #333;
      padding: 4px 6px; font-family: monospace; font-size: 11px; border-radius: 4px; margin: 2px 0;
    }
    #game-dev-panel textarea { min-height: 80px; resize: vertical; }
    #game-dev-panel button {
      background: #2d4a7a; color: #eee; border: none; padding: 4px 10px;
      cursor: pointer; border-radius: 4px; font-size: 11px; margin: 2px 0;
    }
    #game-dev-panel button:hover { background: #3d5a9a; }
    #game-dev-panel .action-btn { background: #4a2d7a; }
    #game-dev-panel .action-btn:hover { background: #5a3d9a; }
    #game-dev-panel .action-row { margin-bottom: 6px; }
    #game-dev-panel pre {
      background: #0d1117; padding: 6px; border-radius: 4px; margin: 4px 0;
      max-height: 200px; overflow: auto; white-space: pre-wrap; word-break: break-all;
    }
    #game-dev-panel #dp-events {
      max-height: 150px; overflow-y: auto; background: #0d1117;
      padding: 6px; border-radius: 4px; margin: 4px 0;
    }
    #game-dev-panel .ev { margin: 2px 0; border-bottom: 1px solid #222; padding: 2px 0; }
    #game-dev-panel .ev-type { color: #f0a; }
    #game-dev-panel .god { color: #f55; font-size: 9px; }
  `
  document.head.appendChild(style)

  // --- Wire up ---
  const $ = (sel: string) => panel.querySelector(sel)!

  $('#dp-init-btn').addEventListener('click', () => {
    try {
      cb.onInit(JSON.parse(($('#dp-init') as HTMLTextAreaElement).value))
    } catch (e) {
      alert('Invalid JSON: ' + e)
    }
  })

  panel.querySelectorAll('button.action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = (btn as HTMLElement).dataset.action!
      const params: Record<string, unknown> = {}
      panel.querySelectorAll<HTMLInputElement>(`input[data-action="${name}"]`).forEach((inp) => {
        const val = inp.value
        try { params[inp.dataset.param!] = JSON.parse(val) } catch { params[inp.dataset.param!] = val }
      })
      cb.onAction(name, params)
    })
  })

  $('#dp-refresh').addEventListener('click', refreshState)

  const stateEl = $('#dp-state') as HTMLPreElement
  const eventsEl = $('#dp-events') as HTMLDivElement

  function refreshState() {
    stateEl.textContent = JSON.stringify(cb.getState(), null, 2)
  }

  function addEvent(msg: GameToHost) {
    const div = document.createElement('div')
    div.className = 'ev'
    const payload = msg.type === 'state' ? msg.state : msg.type === 'event' ? msg.data : msg
    div.innerHTML = `<span class="ev-type">${msg.type}</span> ${JSON.stringify(payload)}`
    eventsEl.prepend(div)
    while (eventsEl.children.length > 50) eventsEl.lastChild?.remove()
  }

  return {
    onGameMessage(msg: GameToHost) {
      addEvent(msg)
      if (msg.type === 'state') refreshState()
    },
    destroy() {
      panel.remove()
      style.remove()
      // Unwrap children back to body
      while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild)
      wrapper.remove()
    },
  }
}
