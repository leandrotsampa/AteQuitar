import type { UiPrefs } from '../hooks/useUiPrefs';

// Sons curtos da interface, sintetizados na hora (Web Audio API): sem arquivos de áudio

export type SoundName = 'tick' | 'whoosh' | 'success' | 'delete' | 'warning' | 'celebrate' | 'coin';

interface Note {
  freq: number;
  toFreq?: number; // desliza até esta frequência ao longo da nota
  startMs: number;
  durationMs: number;
}

interface SoundRecipe {
  notes: Note[];
  wave: OscillatorType;
  peakGain: number;
}

const RECIPES: Record<SoundName, SoundRecipe> = {
  tick: { notes: [{ freq: 1800, startMs: 0, durationMs: 25 }], wave: 'sine', peakGain: 0.15 },
  whoosh: { notes: [{ freq: 300, toFreq: 900, startMs: 0, durationMs: 140 }], wave: 'triangle', peakGain: 0.1 },
  success: {
    notes: [
      { freq: 660, startMs: 0, durationMs: 70 },
      { freq: 990, startMs: 60, durationMs: 80 },
    ],
    wave: 'sine',
    peakGain: 0.2,
  },
  delete: { notes: [{ freq: 440, toFreq: 280, startMs: 0, durationMs: 120 }], wave: 'triangle', peakGain: 0.15 },
  // Arpejo de conquista (marco atingido, check-in concluído)
  celebrate: {
    notes: [
      { freq: 523, startMs: 0, durationMs: 90 },
      { freq: 659, startMs: 80, durationMs: 90 },
      { freq: 784, startMs: 160, durationMs: 90 },
      { freq: 1047, startMs: 240, durationMs: 220 },
    ],
    wave: 'sine',
    peakGain: 0.18,
  },
  coin: {
    notes: [
      { freq: 988, startMs: 0, durationMs: 60 },
      { freq: 1319, startMs: 55, durationMs: 140 },
    ],
    wave: 'square',
    peakGain: 0.05,
  },
  warning: {
    notes: [
      { freq: 520, startMs: 0, durationMs: 50 },
      { freq: 520, startMs: 90, durationMs: 50 },
    ],
    wave: 'square',
    peakGain: 0.08,
  },
};


const REPEAT_GAP_MS = 60;
const ATTACK_S = 0.005;

type AudioContextCtor = new () => AudioContext;

export function createSoundPlayer(
  getPrefs: () => UiPrefs,
  env: { AudioContext?: AudioContextCtor; now?: () => number } = {}
): { play(name: SoundName): void; playedWithin(ms: number): boolean } {
  let ctx: AudioContext | null = null;
  let unavailable = false;
  const lastPlayed = new Map<SoundName, number>();
  let lastAny = -Infinity;
  const now = env.now ?? (() => performance.now());

  return {
    // Algum som tocou há pouco (mesmo com o som desligado): o clique já tem o seu
    playedWithin(ms) {
      return now() - lastAny < ms;
    },
    play(name) {
      lastAny = now();
      const prefs = getPrefs();
      if (!prefs.soundEnabled || prefs.soundVolume <= 0 || unavailable) return;

      const t = now();
      const last = lastPlayed.get(name);
      if (last !== undefined && t - last < REPEAT_GAP_MS) return;
      lastPlayed.set(name, t);

      try {
        // Criado só no primeiro som, que sempre vem de um gesto do usuário
        if (!ctx) {
          const Ctor =
            env.AudioContext ??
            (typeof window !== 'undefined'
              ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext)
              : undefined);
          if (!Ctor) {
            unavailable = true;
            return;
          }
          ctx = new Ctor();
        }
        if (ctx.state === 'suspended') void ctx.resume();

        const recipe = RECIPES[name];
        const peak = recipe.peakGain * prefs.soundVolume;
        for (const note of recipe.notes) {
          const start = ctx.currentTime + note.startMs / 1000;
          const end = start + note.durationMs / 1000;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = recipe.wave;
          osc.frequency.setValueAtTime(note.freq, start);
          if (note.toFreq) osc.frequency.exponentialRampToValueAtTime(note.toFreq, end);
          // Ataque curto e queda exponencial: sem estalo no começo nem no fim
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(peak, start + ATTACK_S);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(end + 0.01);
        }
      } catch {
        // Sem áudio disponível: segue em silêncio
        unavailable = true;
      }
    },
  };
}
