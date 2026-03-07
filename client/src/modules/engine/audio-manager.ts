/**
 * Game Engine — Audio Manager
 * Web Audio API wrapper for sound effects, music, spatial panning, and volume controls.
 */

import type { Vector2 } from "./types";

interface SoundEntry {
  buffer: AudioBuffer;
}

interface MusicTrack {
  source: AudioBufferSourceNode | null;
  gain: GainNode;
  buffer: AudioBuffer;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sounds = new Map<string, SoundEntry>();
  private currentMusic: MusicTrack | null = null;
  private muted = false;
  private masterVolume = 1;
  private sfxVolume = 1;
  private musicVolume = 0.5;

  // ---- Initialization (lazy) ----

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);

      this.applyVolumes();
    }
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // ---- Load ----

  async load(name: string, url: string): Promise<void> {
    if (this.sounds.has(name)) return;
    const ctx = this.ensureContext();
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.sounds.set(name, { buffer });
    } catch {
      console.warn(`[AudioManager] Failed to load sound: ${name} from ${url}`);
    }
  }

  // ---- Play SFX ----

  play(name: string, opts?: {
    volume?: number;
    pitch?: number;
    pan?: number;
  }): void {
    const entry = this.sounds.get(name);
    if (!entry || this.muted) return;
    const ctx = this.ensureContext();

    const source = ctx.createBufferSource();
    source.buffer = entry.buffer;

    // Pitch variation
    if (opts?.pitch) {
      source.playbackRate.value = opts.pitch;
    }

    // Volume
    const gainNode = ctx.createGain();
    gainNode.gain.value = opts?.volume ?? 1;

    // Panning
    if (opts?.pan !== undefined && opts.pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan));
      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this.sfxGain!);
    } else {
      source.connect(gainNode);
      gainNode.connect(this.sfxGain!);
    }

    source.start();
  }

  /** Play with spatial panning based on world position relative to listener. */
  playSpatial(
    name: string,
    soundPos: Vector2,
    listenerPos: Vector2,
    maxDistance = 1000,
  ): void {
    const dx = soundPos.x - listenerPos.x;
    const dist = Math.abs(dx);
    if (dist > maxDistance) return;

    const volume = 1 - dist / maxDistance;
    const pan = Math.max(-1, Math.min(1, dx / (maxDistance * 0.5)));
    this.play(name, { volume, pan });
  }

  // ---- Music ----

  async playMusic(name: string, opts?: { crossfade?: number }): Promise<void> {
    const entry = this.sounds.get(name);
    if (!entry) return;
    const ctx = this.ensureContext();
    const fadeTime = opts?.crossfade ?? 0.5;

    // Fade out current music
    if (this.currentMusic?.source) {
      const old = this.currentMusic;
      old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeTime);
      setTimeout(() => {
        try { old.source?.stop(); } catch { /* already stopped */ }
      }, fadeTime * 1000);
    }

    // Create new music track
    const source = ctx.createBufferSource();
    source.buffer = entry.buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeTime);

    source.connect(gain);
    gain.connect(this.musicGain!);
    source.start();

    this.currentMusic = { source, gain, buffer: entry.buffer };
  }

  stopMusic(fadeTime = 0.5): void {
    if (!this.currentMusic?.source || !this.ctx) return;
    const old = this.currentMusic;
    this.currentMusic = null;
    if (fadeTime <= 0) {
      try { old.source?.stop(); } catch { /* already stopped */ }
      return;
    }
    old.gain.gain.setValueAtTime(old.gain.gain.value, this.ctx.currentTime);
    old.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeTime);
    setTimeout(() => {
      try { old.source?.stop(); } catch { /* already stopped */ }
    }, fadeTime * 1000);
  }

  // ---- Volume Controls ----

  setMasterVolume(v: number): void {
    this.masterVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    this.applyVolumes();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private applyVolumes(): void {
    const effectiveVolume = this.muted ? 0 : this.masterVolume;
    this.masterGain?.gain.setValueAtTime(effectiveVolume, this.ctx?.currentTime ?? 0);
    this.sfxGain?.gain.setValueAtTime(this.sfxVolume, this.ctx?.currentTime ?? 0);
    this.musicGain?.gain.setValueAtTime(this.musicVolume, this.ctx?.currentTime ?? 0);
  }

  // ---- Cleanup ----

  dispose(): void {
    this.stopMusic(0);
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.sounds.clear();
    this.currentMusic = null;
  }
}
