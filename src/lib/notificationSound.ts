/** Short metallic “ting” for customer assistance alerts (Web Audio — no asset file). */

type AudioContextCtor = typeof AudioContext;

let sharedCtx: AudioContext | null = null;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  );
}

function getSharedContext(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

function scheduleTing(ctx: AudioContext): void {
  const ting = (freq: number, when: number, vol: number, duration = 0.55) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.02);
  };

  // Bright double-ting (F#6 → C#6)
  ting(1480, 0, 0.5, 0.65);
  ting(2220, 0, 0.14, 0.35);
  ting(1109, 0.28, 0.42, 0.7);
  ting(1661, 0.28, 0.1, 0.35);
}

/**
 * Browsers suspend AudioContext until a user gesture. Call after any
 * click/key so later WS-driven assistance alerts can make sound.
 */
export function unlockAssistanceAudio(): void {
  const ctx = getSharedContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }
}

/** Keep audio unlockable while the staff shell is mounted. */
export function bindAssistanceAudioUnlock(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const onGesture = () => {
    unlockAssistanceAudio();
  };

  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture);
  window.addEventListener('touchstart', onGesture, { passive: true });

  return () => {
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
    window.removeEventListener('touchstart', onGesture);
  };
}

/** Play the assistance ting; resumes a suspended context before scheduling. */
export function playAssistanceBell(): void {
  try {
    const ctx = getSharedContext();
    if (!ctx) return;

    const play = () => {
      try {
        scheduleTing(ctx);
      } catch {
        // ignore oscillator races
      }
    };

    if (ctx.state === 'suspended') {
      void ctx.resume().then(play).catch(() => {});
      return;
    }
    play();
  } catch {
    // AudioContext may still be blocked until first user interaction
  }
}
