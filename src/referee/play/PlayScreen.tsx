import { useCallback, useState } from 'react';
import mark from '../../../assets/brand/mark.svg';
import { getBoard } from '../../engine/board.ts';
import { options, planTargets } from '../../engine/select.ts';
import type { EventInput, GameEvent, GameState, PlotId, Step, Team } from '../../engine/types.ts';
import type { RefereeStore } from '../../state/referee-store.ts';
import { Button } from '../../ui/Button.tsx';
import { TeamSymbol } from '../../ui/TeamBadge.tsx';
import { formatNumber } from '../../ui/number.ts';
import { openDisplayWindow } from '../open-display.ts';
import { AuctionPanel } from './AuctionPanel.tsx';
import { BuildPanel } from './BuildPanel.tsx';
import { AnnouncePanel, DayEndPanel } from './EndPanels.tsx';
import { FlatMap } from './FlatMap.tsx';
import { logEntries, todaysEvents } from './log.ts';
import './play.css';
import { RequestPanels } from './QuestionPanels.tsx';
import { TeamBar } from './TeamBar.tsx';
import { useTimerEnd } from './use-timer-end.ts';

const STEPS: { label: string; steps: Step[] }[] = [
  { label: 'طلب البناء', steps: ['question', 'asking'] },
  { label: 'التصاريح', steps: ['answer'] },
  { label: 'البناء', steps: ['build'] },
  { label: 'المزادات', steps: ['auctions', 'dayEnd'] },
];

type Props = { store: RefereeStore; state: GameState; events: readonly GameEvent[] };

/** The referee's play screen (R03–R13): top bar, teams, the flat map, and one panel for the step. */
export function PlayScreen({ store, state, events }: Props) {
  // What the referee is picking (bridge mode, plan plots) belongs to one turn or decision:
  // when the step, the turn or the pending decision changes, it starts afresh.
  const modeKey = `${state.step}|${state.turn}|${state.pending?.kind ?? ''}`;
  const [mode, setMode] = useState({ key: modeKey, bridge: false, picked: [] as PlotId[] });
  const { bridge, picked } = mode.key === modeKey ? mode : { bridge: false, picked: [] as PlotId[] };
  const setBridge = (on: boolean) => setMode({ key: modeKey, bridge: on, picked });
  const setPicked = (plots: PlotId[]) => setMode({ key: modeKey, bridge, picked: plots });
  const [logOpen, setLogOpen] = useState(false);

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

  // «إنهاء المسابقة» works at the end of a day; before the last day it asks first.
  const endGame = () => {
    if (state.day < state.days && !window.confirm('باقي أيام في المسابقة. تنهيها الحين وتنتقل للإعلان؟')) return;
    act({ type: 'game/end' });
  };

  const { choices, chooser, onPick } = mapChoices(state, bridge, picked, setPicked, act);

  const panel = (() => {
    switch (state.step) {
      case 'question':
      case 'asking':
      case 'answer':
        return <RequestPanels state={state} act={act} />;
      case 'build':
        return <BuildPanel state={state} act={act} bridge={bridge} setBridge={setBridge} planPicked={picked} />;
      case 'auctions':
        return <AuctionPanel state={state} act={act} />;
      case 'dayEnd':
        return <DayEndPanel state={state} act={act} today={todaysEvents(events)} />;
      case 'announce':
        return <AnnouncePanel state={state} act={act} onNew={() => store.end()} />;
      default:
        return null;
    }
  })();

  return (
    <div className="play">
      <header className="top-bar">
        <h1 className="top-bar-title">
          <img src={mark} alt="" />
          اليوم {formatNumber(state.day)} من {formatNumber(state.days)}
        </h1>
        {state.step !== 'announce' ? (
          <nav className="step-bar" aria-label="الخطوة">
            {STEPS.map((s) => (
              <span key={s.label} className="step" aria-current={s.steps.includes(state.step) ? 'step' : undefined}>
                {s.label}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="top-bar-actions">
          {state.step !== 'announce' ? (
            <Button icon="flag" disabled={state.step !== 'dayEnd'} onClick={endGame}>
              إنهاء المسابقة
            </Button>
          ) : null}
          <Button icon="tv" aria-label="فتح شاشة العرض" onClick={openDisplayWindow} />
          <Button icon="log" aria-pressed={logOpen} onClick={() => setLogOpen(!logOpen)}>
            السجل
          </Button>
          <Button icon="undo" disabled={events.length === 0} onClick={() => store.undo()}>
            تراجع
          </Button>
        </div>
      </header>

      <main className="play-body">
        <aside className="play-side">{panel}</aside>
        <section className="play-board">
          <TeamBar state={state} act={act} />
          <FlatMap state={state} choices={choices} chooser={chooser} picked={new Set(picked)} onPick={onPick} />
        </section>
      </main>

      {logOpen ? (
        <aside className="log" aria-label="السجل">
          <header className="panel-head">
            <h2>السجل</h2>
            <button type="button" className="link-button" onClick={() => setLogOpen(false)}>
              إغلاق
            </button>
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

type MapChoices = { choices: Set<PlotId>; chooser: Team | null; onPick: (id: PlotId) => void };

/** Which plots the referee can press now, and what pressing one does. */
function mapChoices(
  state: GameState,
  bridge: boolean,
  picked: PlotId[],
  setPicked: (plots: PlotId[]) => void,
  act: (event: EventInput) => void,
): MapChoices {
  const none: MapChoices = { choices: new Set(), chooser: null, onPick: () => {} };
  const pending = state.pending;

  if (pending?.kind === 'plan') {
    // Placing a plan: two of the team's own plots, not its base, without a plan.
    const board = getBoard(state.setup.size);
    const own = board.ids.filter(
      (id) => state.plots[id]?.owner === pending.team && !board.plots[id]?.base && !state.plots[id]?.plan,
    );
    return {
      choices: new Set(own),
      chooser: pending.team,
      onPick: (id) =>
        setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id].slice(-2)),
    };
  }
  if (pending?.kind === 'planTake') {
    return {
      choices: new Set(planTargets(state, pending.from, pending.plot)),
      chooser: pending.team,
      onPick: (id) => act({ type: 'plan/take', team: pending.team, plot: id }),
    };
  }
  if (state.step !== 'build' || pending || !state.turn || state.teams[state.turn].moves === 0) return none;

  const team = state.turn;
  const o = options(state, team);
  if (bridge) {
    return {
      choices: new Set(o.bridge),
      chooser: team,
      onPick: (id) => act({ type: 'build', team, plot: id, via: 'bridge' }),
    };
  }
  return {
    choices: new Set([...o.build, ...o.auction]),
    chooser: team,
    onPick: (id) =>
      act(o.build.includes(id) ? { type: 'build', team, plot: id } : { type: 'auction/declare', team, plot: id }),
  };
}
