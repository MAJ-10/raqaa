import { demoInitial, demoReduce, demoSetup, type DemoEvent, type DemoSetup, type DemoState } from '../state/demo.ts';
import { loadGame } from '../state/persist.ts';
import { RefereeStore } from '../state/referee-store.ts';

let store: RefereeStore<DemoSetup, DemoState, DemoEvent> | undefined;

/** The referee window's single store, created on first use from the saved competition if there is one. */
export function getRefereeStore(): RefereeStore<DemoSetup, DemoState, DemoEvent> {
  if (!store) {
    const saved = loadGame<DemoSetup, DemoEvent>();
    store = new RefereeStore({
      setup: saved?.setup ?? demoSetup,
      initial: demoInitial,
      reduce: demoReduce,
      events: saved?.events,
    });
  }
  return store;
}
