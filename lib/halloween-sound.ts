'use client'

import { useSyncExternalStore } from 'react'

export type GameSound = 'pumpkin' | 'candy' | 'golden' | 'hit' | 'tick' | 'go' | 'combo' | 'over'

const MUTE_KEY = 'halloween-sound-muted'
const MIN_GAP_MS = 45

let audioCtx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
let loaded = false
const listeners = new Set<() => void>()
const lastPlayed: Partial<Record<GameSound, number>> = {}

function loadMuted() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {}
}

export function isSoundMuted() {
  loadMuted()
  return muted
}

export function setSoundMuted(next: boolean) {
  muted = next
  try {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0')
  } catch {}
  if (master && audioCtx) master.gain.setTargetAtTime(next ? 0 : 0.5, audioCtx.currentTime, 0.02)
  listeners.forEach((listener) => listener())
}

export function useSoundMuted() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isSoundMuted,
    () => false,
  )
}

/** Must be called from a user gesture (click/tap) so mobile browsers allow audio. */
export function unlockAudio() {
  if (typeof window === 'undefined') return
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audioCtx = new Ctor()
    master = audioCtx.createGain()
    master.gain.value = isSoundMuted() ? 0 : 0.5
    master.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume()
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, volume: number, endFreq?: number) {
  if (!audioCtx || !master) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(master)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export function playSound(sound: GameSound) {
  if (!audioCtx || muted || audioCtx.state !== 'running') return
  const nowMs = performance.now()
  if (nowMs - (lastPlayed[sound] ?? 0) < MIN_GAP_MS) return
  lastPlayed[sound] = nowMs

  const t = audioCtx.currentTime
  switch (sound) {
    case 'pumpkin':
      tone(520, t, 0.12, 'triangle', 0.35, 880)
      break
    case 'candy':
      tone(880, t, 0.09, 'square', 0.12, 1320)
      break
    case 'golden':
      ;[660, 880, 1100, 1320].forEach((f, i) => tone(f, t + i * 0.06, 0.14, 'triangle', 0.3))
      break
    case 'combo':
      tone(740, t, 0.1, 'sine', 0.25)
      tone(1110, t + 0.08, 0.16, 'sine', 0.25)
      break
    case 'hit':
      tone(220, t, 0.32, 'sawtooth', 0.28, 60)
      tone(140, t, 0.28, 'square', 0.12, 50)
      break
    case 'tick':
      tone(440, t, 0.12, 'sine', 0.3)
      break
    case 'go':
      tone(880, t, 0.25, 'sine', 0.35)
      break
    case 'over':
      ;[392, 330, 262, 196].forEach((f, i) => tone(f, t + i * 0.14, 0.24, 'triangle', 0.3))
      break
  }
}
