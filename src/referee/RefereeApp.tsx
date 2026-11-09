import { useSyncExternalStore } from 'react';
import { defaultSetup } from '../state/setup.ts';
import { IntroScreen } from './IntroScreen.tsx';
import { SetupScreen } from './SetupScreen.tsx';
import { StartedScreen } from './StartedScreen.tsx';
import { getRefereeStore } from './store.ts';

/** The referee window: the intro page, the setup, or the competition. */
export function RefereeApp() {
  const store = getRefereeStore();
  const { state } = useSyncExternalStore(store.subscribe, store.getView);

  if (!state) return <IntroScreen onCreate={() => store.create(defaultSetup())} />;
  if (state.step === 'setup') return <SetupScreen store={store} setup={state.setup} />;
  return <StartedScreen store={store} state={state} />;
}
