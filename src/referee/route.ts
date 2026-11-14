// Which page the referee window shows besides the competition itself, from its address: the landing page
// (no hash, or «#landing» to see it while a competition is saved) or the setup («#setup»). The setup is
// a page of its own in the window's history, so the browser's «back» returns to the landing page, and the
// site opened again from its link shows the landing page, the setup kept for «إنشاء غرفة».

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Follows the address: the browser's back and forward, and the moves below. */
export function watchRoute(changed: () => void): () => void {
  listeners.add(changed);
  addEventListener('hashchange', changed);
  addEventListener('popstate', changed);
  return () => {
    listeners.delete(changed);
    removeEventListener('hashchange', changed);
    removeEventListener('popstate', changed);
  };
}

export const route = () => location.hash;

const plain = () => location.pathname + location.search;

/** To the setup, as a new page in the history, so «back» comes back to the landing page. */
export function toSetup(): void {
  if (location.hash === '#setup') return;
  history.pushState({ raqaa: 'setup' }, '', `${plain()}#setup`);
  notify();
}

/** Back to the landing page: back through the history when the setup came from it, otherwise in place. */
export function toLanding(): void {
  if ((history.state as { raqaa?: string } | null)?.raqaa === 'setup') {
    history.back();
    return;
  }
  history.replaceState(null, '', plain());
  notify();
}

/** The plain address, in place: the competition shows, whatever page the address named. */
export function toCompetition(): void {
  if (!location.hash) return;
  history.replaceState(null, '', plain());
  notify();
}
