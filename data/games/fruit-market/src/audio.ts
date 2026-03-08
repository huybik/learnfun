/** Web Audio API sound effects — no external files needed. */

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function play(freq: number, type: OscillatorType, duration: number, volume = 0.3) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + duration)
}

export function sfxPop() {
  play(600, 'sine', 0.1, 0.25)
  setTimeout(() => play(900, 'sine', 0.08, 0.15), 50)
}

export function sfxCorrect() {
  play(523, 'sine', 0.15, 0.3)
  setTimeout(() => play(659, 'sine', 0.15, 0.3), 100)
  setTimeout(() => play(784, 'sine', 0.25, 0.3), 200)
}

export function sfxWrong() {
  play(300, 'square', 0.15, 0.15)
  setTimeout(() => play(250, 'square', 0.25, 0.15), 120)
}

export function sfxWhoosh() {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.2)
  gain.gain.setValueAtTime(0.15, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start()
  osc.stop(c.currentTime + 0.3)
}

export function sfxCoin() {
  play(1200, 'sine', 0.08, 0.2)
  setTimeout(() => play(1600, 'sine', 0.12, 0.2), 60)
}

export function sfxComplete() {
  const notes = [523, 659, 784, 1047]
  notes.forEach((f, i) => setTimeout(() => play(f, 'sine', 0.3, 0.25), i * 120))
}
