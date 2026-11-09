import { useSyncExternalStore } from 'react';
import { defaultSetup } from '../state/setup.ts';
import { IntroScreen } from './IntroScreen.tsx';
import { PlayScreen } from './play/PlayScreen.tsx';
import { SetupScreen } from './SetupScreen.tsx';
import { getRefereeStore } from './store.ts';

/** The referee window: the intro page, the setup, or the competition. */
export function RefereeApp() {
  const store = getRefereeStore();
  const { state, events } = useSyncExternalStore(store.subscribe, store.getView);

  if (!state) return <IntroScreen onCreate={() => store.create(defaultSetup())} />;
  if (state.step === 'setup') return <SetupScreen store={store} setup={state.setup} />;
  return <PlayScreen store={store} state={state} events={events} />;
}
