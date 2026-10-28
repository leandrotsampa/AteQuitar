import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindTourToData, completeTour, emptyTourState, loadTourState, markSeen, parseTourState, planScreenTour, planTour, saveTourState, skipTour } from './tourState';

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

describe('tutorial do cadastro', () => {
  const CAD = ['cad-passos', 'cad-ajuda'];

  it('ver o tutorial do cadastro não pula as boas-vindas do app', () => {
    const viuCadastro = markSeen(emptyTourState, CAD);
    expect(viuCadastro.seen).toEqual(CAD);
    expect(planTour(BASE, viuCadastro)).toEqual({ kind: 'welcome' });
  });

  it('quem já foi recebido continua recebido', () => {
    const recebido = completeTour(emptyTourState, BASE);
    expect(markSeen(recebido, CAD).welcomed).toBe(true);
  });
});

describe('tutoriais ligados aos dados', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('os mesmos dados mantêm o que já foi visto', () => {
    bindTourToData('dados-a', true);
    saveTourState(markSeen(emptyTourState, ['cad-passos']));
    bindTourToData('dados-a', true);
    expect(loadTourState().seen).toEqual(['cad-passos']);
  });

  it('dados novos (banco excluído ou recomeçar) mostram os tutoriais de novo', () => {
    bindTourToData('dados-a', true);
    saveTourState(completeTour(emptyTourState, ['casa', 'cad-passos']));
    bindTourToData('dados-b', false);
    expect(loadTourState()).toEqual(emptyTourState);
  });

  it('dois bancos (portáteis em pastas diferentes) guardam cada um o que já viu', () => {
    bindTourToData('dados-a', true);
    saveTourState(completeTour(emptyTourState, ['casa']));
    bindTourToData('dados-b', true);
    saveTourState(completeTour(emptyTourState, ['parcela']));
    bindTourToData('dados-a', true);
    expect(loadTourState()).toEqual({ welcomed: true, seen: ['casa'] });
    bindTourToData('dados-b', true);
    expect(loadTourState()).toEqual({ welcomed: true, seen: ['parcela'] });
  });

  it('o registro único da versão anterior continua valendo para o banco dono dele', () => {
    store.set('atequitar_tour_v1', JSON.stringify({ welcomed: true, seen: ['casa'], dataId: 'dados-a' }));
    bindTourToData('dados-a', true);
    expect(loadTourState().seen).toEqual(['casa']);
  });

  it('registro de antes desta versão: fica com quem já tem financiamento, banco vazio começa do zero', () => {
    store.set('atequitar_tour_v1', JSON.stringify({ welcomed: true, seen: ['casa'] }));
    bindTourToData('dados-a', true);
    expect(loadTourState().seen).toEqual(['casa']);
    store.set('atequitar_tour_v1', JSON.stringify({ welcomed: true, seen: ['casa'] }));
    bindTourToData('dados-b', false);
    expect(loadTourState()).toEqual(emptyTourState);
  });
});
