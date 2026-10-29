import { getPref, setPref } from '../lib/prefs';

// O que o tutorial já mostrou: boas-vindas feitas e os passos vistos (por id).
// Passo com id novo numa versão futura aparece sozinho, como novidade.
export interface TourState {
  welcomed: boolean;
  seen: string[];
}

export const emptyTourState: TourState = { welcomed: false, seen: [] };

export type TourPlan = { kind: 'welcome' } | { kind: 'news'; ids: string[] } | { kind: 'none' };

export function planTour(stepIds: string[], state: TourState): TourPlan {
  if (!state.welcomed) return { kind: 'welcome' };
  const unseen = stepIds.filter((id) => !state.seen.includes(id));
  return unseen.length > 0 ? { kind: 'news', ids: unseen } : { kind: 'none' };
}

// Ao entrar numa tela: primeira vez mostra os passos dela; depois, só passos novos.
// Antes das boas-vindas nada aparece (a primeira abertura decide se a pessoa quer o tutorial)
export type ScreenTourPlan = { kind: 'intro' | 'news'; ids: string[] } | { kind: 'none' };

export function planScreenTour(screenIds: string[], state: TourState): ScreenTourPlan {
  if (!state.welcomed) return { kind: 'none' };
  const unseen = screenIds.filter((id) => !state.seen.includes(id));
  if (unseen.length === 0) return { kind: 'none' };
  return { kind: unseen.length < screenIds.length ? 'news' : 'intro', ids: unseen };
}

// Terminou (ou fechou) o tour: estes passos não voltam sozinhos
export function completeTour(state: TourState, ids: string[]): TourState {
  return { welcomed: true, seen: [...new Set([...state.seen, ...ids])] };
}

// "Explorar sozinho": conta como visto, para só as novidades futuras aparecerem
export const skipTour = completeTour;

// Passos vistos fora das telas do app (ex.: o cadastro): não contam como as boas-vindas
export function markSeen(state: TourState, ids: string[]): TourState {
  return { welcomed: state.welcomed, seen: [...new Set([...state.seen, ...ids])] };
}

export function parseTourState(raw: string | null): TourState {
  if (!raw) return emptyTourState;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.welcomed !== 'boolean' || !Array.isArray(v.seen)) return emptyTourState;
    return { welcomed: v.welcomed, seen: v.seen.filter((s: unknown): s is string => typeof s === 'string') };
  } catch {
    return emptyTourState;
  }
}

// O que já foi visto fica com as preferências, no próprio banco. O registro guarda a data de criação
// dos dados: dados novos ("Apagar tudo e recomeçar") mostram os tutoriais de novo
const PREF = 'tour';
let boundDataId: string | null = null;

const ownerOf = (raw: string | null): unknown => {
  try {
    return raw ? (JSON.parse(raw) as { dataId?: unknown })?.dataId : undefined;
  } catch {
    return undefined;
  }
};

// Até a 1.2.1 o registro ficava no localStorage (um por banco na 1.2.1, um só antes): na primeira
// abertura de cada banco ele passa para cá e sai de lá
function legacyTourState(dataId: string, hasData: boolean): TourState | null {
  try {
    const OLD = 'atequitar_tour_v1';
    const own = localStorage.getItem(`${OLD}:${dataId}`);
    if (own) {
      localStorage.removeItem(`${OLD}:${dataId}`);
      return parseTourState(own);
    }
    const single = localStorage.getItem(OLD);
    const owner = ownerOf(single);
    // O registro único vale para o banco dono dele e, sem dono (versões mais antigas), para dados
    // que já têm financiamento
    if (single && (owner === dataId || (typeof owner !== 'string' && hasData))) {
      localStorage.removeItem(OLD);
      return parseTourState(single);
    }
  } catch {
    // Sem localStorage: nada a migrar
  }
  return null;
}

export function bindTourToData(dataId: string, hasData: boolean) {
  boundDataId = dataId;
  const raw = getPref(PREF);
  if (ownerOf(raw) === dataId) return;
  // Sem registro neste banco: o das versões anteriores; com registro de outros dados, recomeçou
  const state = raw ? emptyTourState : (legacyTourState(dataId, hasData) ?? emptyTourState);
  setPref(PREF, JSON.stringify({ ...state, dataId }));
}

export function loadTourState(): TourState {
  return parseTourState(getPref(PREF));
}

export function saveTourState(state: TourState) {
  setPref(PREF, JSON.stringify({ ...state, ...(boundDataId ? { dataId: boundDataId } : {}) }));
}
