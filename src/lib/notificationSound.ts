/** Synthesised double-ding bell using Web Audio API — no external file needed. */
export function playAssistanceBell(): void {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();

    const bell = (freq: number, when: number, vol = 0.45) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + 1.4);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + 1.5);
    };

    // First ding: F#6 + faint overtone
    bell(1480, 0, 0.45);
    bell(1976, 0, 0.12);

    // Second ding (slight interval): C#6 + faint overtone
    bell(1108, 0.38, 0.38);
    bell(1480, 0.38, 0.10);
  } catch {
    // Silently ignore — AudioContext may be blocked until first user interaction
  }
}
