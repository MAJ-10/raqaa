import { useSyncExternalStore } from 'react';
import type { Setup } from '../engine/types.ts';
import { Landing } from '../landing/Landing.tsx';
import { defaultSetup, demoSetup } from '../state/setup.ts';
import { PlayScreen } from './play/PlayScreen.tsx';
import { SetupScreen } from './SetupScreen.tsx';
import { getRefereeStore } from './store.ts';

/** «#landing» shows the landing page even while a competition is saved, to look at the page itself. */
const atLanding = () => location.hash === '#landing';

const watchHash = (changed: () => void) => {
  addEventListener('hashchange', changed);
  return () => removeEventListener('hashchange', changed);
};

/**
 * An action of the landing page opened at «#landing»: a new competition from this setup, unless one is
 * saved, which it never replaces; then the referee window shows it. The saved competition is only read
 * here, on the click, so looking at the page changes nothing.
 */
function open(setup: () => Setup): void {
  const store = getRefereeStore();
  if (!store.getView().state) store.create(setup());
  location.hash = '';
}

/** The referee window: the landing page at its own address, or else the referee's screens. */
export function RefereeApp() {
  const landing = useSyncExternalStore(watchHash, atLanding);
  if (landing) return <Landing onCreate={() => open(defaultSetup)} onDemo={() => open(demoSetup)} />;
  return <RefereeScreens />;
}

/** The landing page when no competition is saved, the setup, or the competition. */
function RefereeScreens() {
  const store = getRefereeStore();
  const { state, events } = useSyncExternalStore(store.subscribe, store.getView);
  if (!state) return <Landing onCreate={() => store.create(defaultSetup())} onDemo={() => store.create(demoSetup())} />;
  if (state.step === 'setup') return <SetupScreen store={store} setup={state.setup} />;
  return <PlayScreen store={store} state={state} events={events} />;
}
