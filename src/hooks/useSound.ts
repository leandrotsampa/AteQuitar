import { createSoundPlayer, type SoundName } from '../lib/sound';
import { getUiPrefs } from './useUiPrefs';

// Um único tocador para o app inteiro, sempre lendo a preferência atual
const player = createSoundPlayer(getUiPrefs);

export function playSound(name: SoundName): void {
  player.play(name);
}

// Todo botão faz um "tick" ao ser clicado, a não ser que o próprio clique já tenha tocado um som
// (sucesso, exclusão...) ou que o botão peça silêncio com data-silent
const CLICKABLE = 'button, a[href], [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"]';
export function installClickSounds(): () => void {
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.(CLICKABLE);
    if (!el || el.closest('[data-silent]') || el.matches(':disabled, [aria-disabled="true"]')) return;
    if (player.playedWithin(50)) return;
    player.play('tick');
  };
  // Na fase de bolha do documento: roda depois dos cliques do React, que podem ter tocado outro som
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
