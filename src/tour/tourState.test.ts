import { describe, expect, it } from 'vitest';
import { completeTour, emptyTourState, parseTourState, planScreenTour, planTour, skipTour } from './tourState';

const BASE = ['casa', 'falta', 'marcos'];

describe('o que o tutorial mostra ao abrir o app', () => {
  it('primeira vez: boas-vindas', () => {
    expect(planTour(BASE, emptyTourState)).toEqual({ kind: 'welcome' });
  });

  it('depois de fazer o tour inteiro: nada', () => {
    expect(planTour(BASE, completeTour(emptyTourState, BASE))).toEqual({ kind: 'none' });
  });

  it('quem pulou o tour também não vê de novo, mas recebe as novidades depois', () => {
    const pulou = skipTour(emptyTourState, BASE);
    expect(planTour(BASE, pulou)).toEqual({ kind: 'none' });
    expect(planTour([...BASE, 'novo-passo'], pulou)).toEqual({ kind: 'news', ids: ['novo-passo'] });
  });

  it('versão nova com um passo novo: mostra só o passo novo', () => {
    const visto = completeTour(emptyTourState, BASE);
    expect(planTour([...BASE, 'novo-passo'], visto)).toEqual({ kind: 'news', ids: ['novo-passo'] });
    expect(planTour([...BASE, 'novo-passo'], completeTour(visto, ['novo-passo']))).toEqual({ kind: 'none' });
  });

  it('estado salvo corrompido ou de outro formato volta ao início', () => {
    expect(parseTourState('não é json')).toEqual(emptyTourState);
    expect(parseTourState(JSON.stringify({ welcomed: 'sim', seen: 3 }))).toEqual(emptyTourState);
    expect(parseTourState(null)).toEqual(emptyTourState);
    expect(parseTourState(JSON.stringify({ welcomed: true, seen: ['a', 1, 'b'] }))).toEqual({ welcomed: true, seen: ['a', 'b'] });
  });
});

describe('mini-tutorial ao entrar numa tela', () => {
  const HIST = ['hist-anos', 'hist-tabela'];
  const welcomed = completeTour(emptyTourState, BASE);

  it('antes das boas-vindas não mostra nada (a primeira abertura cuida disso)', () => {
    expect(planScreenTour(HIST, emptyTourState)).toEqual({ kind: 'none' });
  });

  it('primeira vez na tela: apresentação com todos os passos dela', () => {
    expect(planScreenTour(HIST, welcomed)).toEqual({ kind: 'intro', ids: HIST });
  });

  it('tela já vista com um passo novo: só a novidade', () => {
    const viu = completeTour(welcomed, HIST);
    expect(planScreenTour([...HIST, 'hist-novo'], viu)).toEqual({ kind: 'news', ids: ['hist-novo'] });
    expect(planScreenTour(HIST, viu)).toEqual({ kind: 'none' });
  });

  it('quem escolheu explorar sozinho não recebe as apresentações das telas', () => {
    const pulou = skipTour(emptyTourState, [...BASE, ...HIST]);
    expect(planScreenTour(HIST, pulou)).toEqual({ kind: 'none' });
  });
});
