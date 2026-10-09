let audioContext: AudioContext | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return null
    audioContext = new AudioContextClass()
  }
  return audioContext
}

// Browsers block audio until the user interacts with the page, so the context is resumed on the first gesture.
export function unlockNotificationSound() {
  const context = getAudioContext()
  if (context?.state === 'suspended') void context.resume()
}

export function playNewOrderSound() {
  const context = getAudioContext()
  if (!context) return
  if (context.state === 'suspended') void context.resume()

  const notes = [
    { frequency: 880, start: 0 },
    { frequency: 1174.66, start: 0.14 },
    { frequency: 1567.98, start: 0.28 },
  ]
  const now = context.currentTime

  for (const note of notes) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = note.frequency
    gain.gain.setValueAtTime(0.0001, now + note.start)
    gain.gain.exponentialRampToValueAtTime(0.35, now + note.start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + 0.45)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now + note.start)
    oscillator.stop(now + note.start + 0.5)
  }
}
