import { createSoundPlayer, type SoundName } from '../lib/sound';
import { getUiPrefs } from './useUiPrefs';

// Um único tocador para o app inteiro, sempre lendo a preferência atual
const player = createSoundPlayer(getUiPrefs);

export function playSound(name: SoundName): void {
  player.play(name);
}

export function useSound(): (name: SoundName) => void {
  return playSound;
}
