// Phase 1 demo: a counter that proves the two windows stay in sync and survive reopening.
// The rules engine (src/engine) replaces it in Phase 2.

export type DemoSetup = { kind: 'demo' };
export type DemoState = { count: number };
export type DemoEvent = { type: 'demo/add'; amount: number; at: number };

export const demoSetup: DemoSetup = { kind: 'demo' };
export const demoInitial: DemoState = { count: 0 };

export function demoReduce(state: DemoState, event: DemoEvent): DemoState {
  return { count: state.count + event.amount };
}
