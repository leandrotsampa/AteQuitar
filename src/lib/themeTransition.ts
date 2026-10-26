import { prefersReducedMotion } from './motion';

// Troca de tema revelada por um círculo que nasce no botão clicado (View Transitions API)

type ViewTransitionLike = { ready: Promise<void>; finished: Promise<void>; skipTransition: () => void };
type DocumentWithTransitions = Document & { startViewTransition?: (cb: () => void) => ViewTransitionLike };

let current: ViewTransitionLike | null = null;

// Raio que cobre a tela inteira a partir de (x, y)
export function wipeRadius(x: number, y: number, w: number, h: number): number {
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

export function runThemeWipe(origin: HTMLElement | null, apply: () => void): void {
  const doc = document as DocumentWithTransitions;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    apply();
    return;
  }

  // Clique durante uma troca em andamento: encerra a anterior para o tema não dessincronizar
  current?.skipTransition();

  const root = doc.documentElement;
  const w = root.clientWidth;
  const h = root.clientHeight;
  let x = w / 2;
  let y = h / 2;
  if (origin) {
    const r = origin.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  const end = wipeRadius(x, y, w, h);

  const transition = doc.startViewTransition.call(doc, apply);
  current = transition;
  transition.finished.then(
    () => {
      if (current === transition) current = null;
    },
    () => {}
  );
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
      );
    })
    .catch(() => {});
}
