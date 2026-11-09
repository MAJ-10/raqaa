import { canUseCard, options } from '../../engine/select.ts';
import type { EventInput, GameState, PlotId } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { countOf, MOVE_NOUN } from '../../ui/names.ts';
import { formatNumber } from '../../ui/number.ts';
import { TeamBadge } from '../../ui/TeamBadge.tsx';

type Props = {
  state: GameState;
  act: (event: EventInput) => void;
  bridge: boolean;
  setBridge: (on: boolean) => void;
  planPicked: PlotId[];
};

/** R06: build order and the team in turn. The referee presses a plot on the map to build or bid. */
export function BuildPanel(props: Props) {
  const { state } = props;
  if (state.pending?.kind === 'fence') return <FencePanel {...props} />;
  if (state.pending?.kind === 'plan') return <PlanPanel {...props} />;
  return <TurnPanel {...props} />;
}

function TurnPanel({ state, act, bridge, setBridge }: Props) {
  const names = state.setup.teams;
  const turn = state.turn;
  const moves = turn ? state.teams[turn].moves : 0;
  const bridgeReady = !!turn && moves > 0 && canUseCard(state, turn, 'bridge') && options(state, turn).bridge.length > 0;

  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>البناء</h2>
      </header>
      <ol className="build-order">
        {state.order.map((team, i) => {
          const status = i < state.turnIndex ? 'done' : team === turn ? 'turn' : 'waiting';
          return (
            <li key={team} className="build-row" data-status={status} data-team={team}>
              <span className="build-index">{formatNumber(i + 1)}</span>
              <TeamBadge team={team} name={names[team].name} size={30} />
              {status === 'done' ? (
                <span className="build-done" aria-label="انتهى دوره">
                  <Icon name="check" size={18} />
                </span>
              ) : null}
              {status === 'turn' ? (
                <strong className="build-moves">{moves > 0 ? countOf(moves, MOVE_NOUN) : 'بدون حركة'}</strong>
              ) : null}
              {status === 'waiting' && !state.permits.includes(team) ? (
                <span className="build-note">بدون تصريح</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {turn ? (
        <footer className="panel-actions">
          {canUseCard(state, turn, 'crane') ? (
            <Button icon="crane" onClick={() => act({ type: 'card/crane', team: turn })}>
              رافعة
            </Button>
          ) : null}
          {bridgeReady ? (
            <Button icon="bridge" aria-pressed={bridge} onClick={() => setBridge(!bridge)}>
              جسر
            </Button>
          ) : null}
          {moves === 0 ? <Button onClick={() => act({ type: 'turn/pass', team: turn })}>تمرير</Button> : null}
        </footer>
      ) : null}
    </section>
  );
}

/** R07: the moment an auction is declared on a team with a fence. */
function FencePanel({ state, act }: Props) {
  if (state.pending?.kind !== 'fence') return null;
  const auction = state.auctions[state.pending.auction]!;
  const names = state.setup.teams;
  return (
    <section className="card panel" data-team={auction.defender}>
      <header className="panel-head">
        <h2>السياج</h2>
      </header>
      <p className="panel-text">
        {names[auction.bidder].name} يزايد على أرض {names[auction.defender].name}، وعنده سياج.
      </p>
      <footer className="panel-actions">
        <Button variant="primary" icon="fence" onClick={() => act({ type: 'card/fence', auction: auction.id })}>
          استخدم السياج
        </Button>
        <Button onClick={() => act({ type: 'fence/skip', auction: auction.id })}>بدون سياج</Button>
      </footer>
    </section>
  );
}

/** R09: the team took a plan; the referee presses two of its plots on the map. */
function PlanPanel({ state, act, planPicked }: Props) {
  if (state.pending?.kind !== 'plan') return null;
  const team = state.pending.team;
  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>المخطط السري</h2>
      </header>
      <TeamBadge team={team} name={state.setup.teams[team].name} size={30} />
      <p className="panel-text">اختر قطعتين من أرضه على الخريطة.</p>
      <footer className="panel-actions">
        <Button
          variant="primary"
          disabled={planPicked.length !== 2}
          onClick={() => act({ type: 'card/plan', team, plots: [planPicked[0]!, planPicked[1]!] })}
        >
          تأكيد
        </Button>
      </footer>
    </section>
  );
}
