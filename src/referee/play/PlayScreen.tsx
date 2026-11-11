import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { replay } from '../../engine/reduce.ts';
import { openAuction, options, planPlots, planTargets, population } from '../../engine/select.ts';
import { TEAMS, type EventInput, type GameEvent, type GameState, type PlotId, type Team } from '../../engine/types.ts';
import type { RefereeStore } from '../../state/referee-store.ts';
import { Button } from '../../ui/Button.tsx';
import { Cloud, Skyline } from '../../ui/City.tsx';
import { formatNumber } from '../../ui/number.ts';
import { TeamSymbol } from '../../ui/TeamBadge.tsx';
import { Toolbar, TopBar } from '../../ui/TopBar.tsx';
import { openDisplayWindow } from '../open-display.ts';
import { ScreenNote } from '../ScreenNote.tsx';
import { plotNumbers } from '../../ui/plot-numbers.ts';
import { DayTrack } from './DayTrack.tsx';
import { bannerFor } from './banner.ts';
import { EventBanner } from './EventBanner.tsx';
import { InspectionReveal } from './InspectionReveal.tsx';
import { AnnouncePanel } from './EndPanels.tsx';
import { FlatMap } from './FlatMap.tsx';
import { logEntries, todaysEvents } from './log.ts';
import './play.css';
import './teams.css';
import './map.css';
import './track.css';
import './auction.css';
import './end.css';
import { TeamCorner } from './TeamCorner.tsx';
import { useDemo } from './use-demo.ts';
import { useTimerEnd } from './use-timer-end.ts';

type Props = { store: RefereeStore; state: GameState; events: readonly GameEvent[] };

/** Where each team's card sits: at the corner of its base on the map (coral's base is top right). */
const CORNERS = { top: ['coral', 'blue'], bottom: ['green', 'gold'] } as const satisfies Record<string, readonly Team[]>;

/**
 * The referee's play screen (R03–R13): a quiet top bar, the day's steps on one track at the side, and
 * the map as the stage, with each team's card at the corner of its base.
 */
export function PlayScreen({ store, state, events }: Props) {
  // The plots picked for a plan belong to that one decision: when it changes, the pick starts afresh.
  const pickKey = `${state.step}|${state.turn}|${state.pending?.kind ?? ''}`;
  const [pick, setPick] = useState({ key: pickKey, plots: [] as PlotId[] });
  const picked = pick.key === pickKey ? pick.plots : [];
  const setPicked = (plots: PlotId[]) => setPick({ key: pickKey, plots });
  const [logOpen, setLogOpen] = useState(false);
  const muted = useSyncExternalStore(store.subscribe, store.isMuted);
  const [inventory, setInventory] = useState<Team | null>(null);
  // The inspector's window stays until the referee closes it, or does the next thing.
  const [seen, setSeen] = useState<number | null>(null);
  const last = events.at(-1);
  const reveal = last?.type === 'card/inspector' && seen !== last.at ? last : null;

  const act = useCallback(
    (event: EventInput) => {
      try {
        store.dispatch({ ...event, at: Date.now() } as GameEvent);
      } catch (error) {
        // The screen only offers allowed actions, so this would be a bug; the competition stays as it was.
        console.error(error);
      }
    },
    [store],
  );
  useTimerEnd(state, act);
  // A demo plays as soon as it starts; reopened halfway through, it waits for «متابعة».
  const demo = state.setup.demo === true;
  const [playing, setPlaying] = useState(() => demo && events.length <= 1);
  useDemo(playing, state, events, act);

  const { choices, chooser, bridges, onPick } = mapChoices(state, picked, setPicked, act);
  const focus = auctionFocus(state);
  const banner = bannerFor(state, events);
  const today = todaysEvents(events);
  // At the end of the day: what each team gained today, against the map as the day began.
  const gains = useMemo(() => {
    if (state.step !== 'dayEnd') return null;
    const before = replay(state.setup, events.slice(0, events.length - today.length));
    return Object.fromEntries(TEAMS.map((team) => [team, population(state, team) - population(before, team)])) as Record<Team, number>;
  }, [state, events, today.length]);
  const corner = (team: Team, side: 'start' | 'end', place: 'top' | 'bottom') => (
    <TeamCorner
      key={team}
      state={state}
      team={team}
      side={side}
      place={place}
      open={inventory === team}
      onToggle={() => setInventory(inventory === team ? null : team)}
    />
  );

  return (
    <div className="play">
      <TopBar
        title={
          <>
            اليوم{' '}
            <span key={state.day} className="top-bar-day">
              {formatNumber(state.day)}
            </span>{' '}
            <span className="top-bar-of">من {formatNumber(state.days)}</span>
          </>
        }
      >
        <ScreenNote />
        <Toolbar>
          {demo ? (
            <>
              <Button variant="quiet" icon={playing ? 'pause' : 'play'} onClick={() => setPlaying(!playing)}>
                {playing ? 'إيقاف' : 'متابعة'}
              </Button>
              <Button variant="quiet" icon="x" aria-label="إنهاء التجربة" onClick={() => store.end()}>
                إنهاء
              </Button>
            </>
          ) : null}
          <Button variant="quiet" icon="tv" aria-label="فتح شاشة العرض" onClick={openDisplayWindow}>
            شاشة العرض
          </Button>
          <Button variant="quiet" icon={muted ? 'mute' : 'sound'} aria-pressed={muted} onClick={() => store.setMuted(!muted)}>
            كتم الصوت
          </Button>
          <Button variant="quiet" icon="log" aria-pressed={logOpen} onClick={() => setLogOpen(!logOpen)}>
            السجل
          </Button>
          <Button variant="quiet" icon="undo" disabled={events.length === 0} onClick={() => store.undo()}>
            تراجع
          </Button>
        </Toolbar>
      </TopBar>

      <main className="play-body">
        <aside className="play-side">
          {state.step === 'announce' ? (
            <AnnouncePanel state={state} act={act} onNew={() => store.end()} />
          ) : (
            <DayTrack state={state} act={act} today={today} planPicked={picked} gains={gains} />
          )}
        </aside>
        <section className="play-board" aria-label="الخريطة">
          <div className="board-scenery">
            <Cloud className="cloud cloud-1" />
            <Cloud className="cloud cloud-2" />
            <Cloud className="cloud cloud-3" />
            <Cloud className="cloud cloud-4" />
            <Skyline className="skyline" />
          </div>
          <div className="board-frame">
            <div className="corner-row">
              {corner(CORNERS.top[0], 'start', 'top')}
              {corner(CORNERS.top[1], 'end', 'top')}
            </div>
            <FlatMap
              state={state}
              choices={choices}
              chooser={chooser}
              bridges={bridges}
              picked={picked}
              focus={focus}
              numbers={plotNumbers(state)}
              onPick={onPick}
            />
            <div className="corner-row">
              {corner(CORNERS.bottom[0], 'start', 'bottom')}
              {corner(CORNERS.bottom[1], 'end', 'bottom')}
            </div>
          </div>
          {banner ? <EventBanner key={banner.at} banner={banner} name={state.setup.teams[banner.team].name} /> : null}
        </section>
      </main>

      {reveal ? (
        <InspectionReveal key={reveal.at} state={state} team={reveal.team} target={reveal.target} onClose={() => setSeen(reveal.at)} />
      ) : null}

      {logOpen ? (
        <aside className="log" aria-label="السجل">
          <header className="log-head">
            <h2>السجل</h2>
            <Button variant="quiet" icon="x" aria-label="إغلاق السجل" onClick={() => setLogOpen(false)} />
          </header>
          <ol className="log-list">
            {logEntries(events, state).map((entry, i) => (
              <li key={i}>
                <span className="log-day">اليوم {formatNumber(entry.day)}</span>
                {entry.team ? <TeamSymbol team={entry.team} size={22} /> : <span className="log-dot" />}
                <span>{entry.text}</span>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
    </div>
  );
}

/** The plot the map spotlights: the open auction's, or the one whose fence is being decided. */
function auctionFocus(state: GameState): { plot: PlotId; bidder: Team } | null {
  const pending = state.pending;
  const auction = pending?.kind === 'fence' ? state.auctions[pending.auction] : openAuction(state);
  return auction ? { plot: auction.plot, bidder: auction.bidder } : null;
}

type MapChoices = {
  choices: Set<PlotId>;
  chooser: Team | null;
  bridges: Set<PlotId>;
  onPick: (id: PlotId) => void;
};

/**
 * Which plots the referee can press now, and what pressing one does. In a team's turn these are the
 * plots it can build on or bid for, and the plots its bridge reaches when it can use one.
 */
function mapChoices(
  state: GameState,
  picked: PlotId[],
  setPicked: (plots: PlotId[]) => void,
  act: (event: EventInput) => void,
): MapChoices {
  const none: MapChoices = { choices: new Set(), chooser: null, bridges: new Set(), onPick: () => {} };
  const pending = state.pending;

  if (pending?.kind === 'plan') {
    // Placing a plan: two of the team's own plots, not its base, without a plan.
    return {
      ...none,
      choices: new Set(planPlots(state, pending.team)),
      chooser: pending.team,
      onPick: (id) =>
        setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id].slice(-2)),
    };
  }
  if (pending?.kind === 'planTake') {
    return {
      ...none,
      choices: new Set(planTargets(state, pending.from, pending.plot)),
      chooser: pending.team,
      onPick: (id) => act({ type: 'plan/take', team: pending.team, plot: id }),
    };
  }
  if (state.step !== 'build' || pending || !state.turn || state.teams[state.turn].moves === 0) return none;

  // Bridge plots are empty and out of the team's reach, so they never overlap building or bidding.
  const team = state.turn;
  const o = options(state, team);
  const bridges = new Set(o.bridge);
  return {
    choices: new Set([...o.build, ...o.auction, ...o.bridge]),
    chooser: team,
    bridges,
    onPick: (id) =>
      act(
        bridges.has(id)
          ? { type: 'build', team, plot: id, via: 'bridge' }
          : o.build.includes(id)
            ? { type: 'build', team, plot: id }
            : { type: 'auction/declare', team, plot: id },
      ),
  };
}
