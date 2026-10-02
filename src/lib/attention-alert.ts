let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

export async function unlockAttentionSound() {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    await context.resume();
  }
}

export async function playAttentionSound() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    await context.resume();
  }

  const start = context.currentTime;
  const notes = [659.25, 880, 659.25, 987.77];

  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = start + index * 0.14;
    const noteEnd = noteStart + 0.11;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.22, noteStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd);
  });
}