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

const KEY = 'atequitar_tour_v1';

// O que já foi visto vale para os dados de agora, com um registro para cada banco (pela data de
// criação dele): dois portáteis em pastas diferentes dividem o armazenamento do navegador, mas não
// os tutoriais. Dados novos (banco excluído ou "Apagar tudo e recomeçar") mostram os tutoriais de novo
let boundDataId: string | null = null;
const keyOf = (dataId: string | null) => (dataId ? `${KEY}:${dataId}` : KEY);

export function bindTourToData(dataId: string, hasData: boolean) {
  boundDataId = dataId;
  try {
    if (localStorage.getItem(keyOf(dataId))) return;
    // Registro único das versões anteriores: vale para o banco dono dele e, sem dono (versões mais
    // antigas), para dados que já têm financiamento; banco vazio começa do zero
    const raw = localStorage.getItem(KEY);
    const owner = raw ? (JSON.parse(raw) as { dataId?: unknown })?.dataId : undefined;
    const keep = owner === dataId || (typeof owner !== 'string' && hasData);
    localStorage.setItem(keyOf(dataId), JSON.stringify(keep ? parseTourState(raw) : emptyTourState));
  } catch {
    // Sem armazenamento: o tutorial segue como se fosse a primeira vez
  }
}

export function loadTourState(): TourState {
  try {
    return parseTourState(localStorage.getItem(keyOf(boundDataId)));
  } catch {
    return emptyTourState;
  }
}

export function saveTourState(state: TourState) {
  try {
    localStorage.setItem(keyOf(boundDataId), JSON.stringify(state));
  } catch {
    // Sem armazenamento: o tutorial só volta a aparecer na próxima abertura
  }
}
