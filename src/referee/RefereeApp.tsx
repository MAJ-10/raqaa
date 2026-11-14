import { useEffect, useSyncExternalStore } from 'react';
import { Landing } from '../landing/Landing.tsx';
import { defaultSetup, demoSetup } from '../state/setup.ts';
import { PlayScreen } from './play/PlayScreen.tsx';
import { route, toCompetition, toLanding, toSetup, watchRoute } from './route.ts';
import { SetupScreen } from './SetupScreen.tsx';
import { getRefereeStore } from './store.ts';

/**
 * The landing page's two actions. «إنشاء غرفة» goes to the setup: the one in progress if there is one,
 * otherwise a new one. «مسابقة تجريبية» starts a new demo setup. A competition that has started is never
 * replaced: either action opens it. The saved competition is only read here, on the click, so looking at
 * the landing page changes nothing.
 */
function begin(kind: 'create' | 'demo'): void {
  const store = getRefereeStore();
  const state = store.getView().state;
  if (state && state.step !== 'setup') {
    toCompetition();
    return;
  }
  if (kind === 'demo') store.create(demoSetup());
  else if (!state || state.setup.demo) store.create(defaultSetup());
  toSetup();
}

const actions = { onCreate: () => begin('create'), onDemo: () => begin('demo') };

/** The referee window: the landing page at its own address, or else the referee's screens. */
export function RefereeApp() {
  const at = useSyncExternalStore(watchRoute, route);
  if (at === '#landing') return <Landing {...actions} />;
  return <RefereeScreens at={at} />;
}

/**
 * The landing page, the setup when the address asks for it, or the competition once it has started. A
 * setup in progress waits behind the landing page until «إنشاء غرفة» opens it again.
 */
function RefereeScreens({ at }: { at: string }) {
  const store = getRefereeStore();
  const { state, events } = useSyncExternalStore(store.subscribe, store.getView);
  const started = state !== null && state.step !== 'setup';
  // Once the competition starts, the address no longer names the setup.
  useEffect(() => {
    if (started && at === '#setup') toCompetition();
  }, [started, at]);

  if (state && started) return <PlayScreen store={store} state={state} events={events} />;
  if (state && at === '#setup') return <SetupScreen store={store} setup={state.setup} onHome={toLanding} />;
  return <Landing {...actions} />;
}
