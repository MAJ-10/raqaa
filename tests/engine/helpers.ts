import { Play, sampleSetup } from '../../src/engine/scenarios.ts';
import type { Card, GameState, PlotId, Setup, Team } from '../../src/engine/types.ts';

type Owned = PlotId | [PlotId, number];

/** A deep copy of a state that tests may change. The setup never changes, so it is shared. */
export function copyState(state: GameState): GameState {
  return { ...structuredClone({ ...state, setup: undefined }), setup: state.setup };
}

/**
 * Returns a copy of the state with plots given to teams, as if they were built long ago
 * (or on the given day). Any card on those plots is removed.
 */
export function arrange(state: GameState, owners: Partial<Record<Team, Owned[]>>): GameState {
  const s = copyState(state);
  for (const [team, plots] of Object.entries(owners) as [Team, Owned[]][]) {
    for (const entry of plots) {
      const [id, since] = typeof entry === 'string' ? [entry, null] : entry;
      const plot = s.plots[id];
      if (!plot) throw new Error(`No plot ${id}`);
      plot.owner = team;
      plot.since = since;
      plot.card = null;
    }
  }
  return s;
}

/** Returns a copy of the state where the team holds these cards. */
export function give(state: GameState, team: Team, cards: Card[]): GameState {
  const s = copyState(state);
  s.teams[team].cards.push(...cards);
  return s;
}

/** A started game (day 1, question ready) with plots arranged before anything else happens. */
export function startWith(owners: Partial<Record<Team, Owned[]>> = {}, setup: Setup = sampleSetup()): Play {
  const play = new Play(setup).do({ type: 'game/start' });
  play.state = arrange(play.state, owners);
  return play;
}
