import { canUseCard } from '../../engine/select.ts';
import { TEAMS, type EventInput, type GameState, type PlotId } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { countOf, MOVE_NOUN, plotName } from '../../ui/names.ts';
import { formatNumber } from '../../ui/number.ts';
import { TeamName } from '../../ui/TeamBadge.tsx';
import { TeamTile, TeamTileButton } from '../../ui/TeamTile.tsx';
import { Decision } from './Decision.tsx';

type Props = { state: GameState; act: (event: EventInput) => void; planPicked: PlotId[] };

/** R06–R07, R09: the build order and the team in turn, or a decision that has to come first. */
export function BuildBody(props: Props) {
  const { state } = props;
  if (state.pending?.kind === 'fence') return <FenceDecision {...props} />;
  if (state.pending?.kind === 'plan') return <PlanPlacement {...props} />;
  if (state.pending?.kind === 'inspector') return <InspectorDecision {...props} />;
  return <TurnOrder {...props} />;
}

/**
 * The order as team tiles: the team in turn is filled with its colour; the teams done fade. The referee
 * presses a plot on the map to build or bid. The crane, and passing a turn with no moves, sit under it.
 */
function TurnOrder({ state, act }: Props) {
  const names = state.setup.teams;
  const turn = state.turn;
  const moves = turn ? state.teams[turn].moves : 0;
  const crane = !!turn && canUseCard(state, turn, 'crane');

  return (
    <>
      <ol className="build-order">
        {state.order.map((team, i) => {
          const status = i < state.turnIndex ? 'done' : team === turn ? 'turn' : 'waiting';
          const permit = state.permits.includes(team);
          return (
            <li key={team} className="build-row" data-status={status} data-team={team}>
              <TeamTile team={team} height={48} filled={status === 'turn'}>
                <span className="team-tile-name">{names[team].name}</span>
                {status === 'turn' ? (
                  <strong className="build-state">{moves > 0 ? countOf(moves, MOVE_NOUN) : 'بلا حركات'}</strong>
                ) : !permit ? (
                  <span className="build-state build-note">بدون تصريح</span>
                ) : status === 'done' ? (
                  <span className="build-state" aria-label="انتهى دوره">
                    <Icon name="check" size={18} />
                  </span>
                ) : null}
              </TeamTile>
            </li>
          );
        })}
      </ol>
      {turn && (crane || moves === 0) ? (
        <div className="step-actions">
          {crane ? (
            <Button icon="crane" onClick={() => act({ type: 'card/crane', team: turn })}>
              رافعة
            </Button>
          ) : null}
          {moves === 0 ? <Button onClick={() => act({ type: 'turn/pass', team: turn })}>تمرير</Button> : null}
        </div>
      ) : null}
    </>
  );
}

/** R07: an auction was just declared on a team that holds a fence. */
function FenceDecision({ state, act }: Props) {
  if (state.pending?.kind !== 'fence') return null;
  const auction = state.auctions[state.pending.auction]!;
  const names = state.setup.teams;
  return (
    <>
      <Decision card="fence" title="السياج">
        <TeamName team={auction.bidder} name={names[auction.bidder].name} /> يزايد على أرض{' '}
        <TeamName team={auction.defender} name={names[auction.defender].name} />، ولديه سياج.
      </Decision>
      <div className="step-actions">
        <Button variant="primary" icon="fence" onClick={() => act({ type: 'card/fence', auction: auction.id })}>
          استخدم
        </Button>
        <Button onClick={() => act({ type: 'fence/skip', auction: auction.id })}>لا تستخدم</Button>
      </div>
    </>
  );
}

/**
 * R09: the team took a plan; the referee presses two of its plots on the map. Each plot picked wears the
 * plan and its number on the map, and fills its slot here.
 */
function PlanPlacement({ state, act, planPicked }: Props) {
  if (state.pending?.kind !== 'plan') return null;
  const team = state.pending.team;
  return (
    <>
      <Decision card="plan" title="المخطط السري">
        <TeamName team={team} name={state.setup.teams[team].name} /> أخذ المخطط. اختر قطعتين من أرضه على الخريطة.
      </Decision>
      <ol className="plan-slots" aria-label="قطعتا المخطط">
        {[0, 1].map((i) => {
          const plot = planPicked[i];
          return (
            <li key={i} className="plan-slot" data-filled={plot ? true : undefined}>
              <span className="plan-slot-number">{formatNumber(i + 1)}</span>
              {plot ? (
                <>
                  <Icon name="plan" size={18} />
                  {plotName(plot)}
                </>
              ) : (
                'لم تُختر'
              )}
            </li>
          );
        })}
      </ol>
      <div className="step-actions">
        <Button
          variant="primary"
          disabled={planPicked.length !== 2}
          onClick={() => act({ type: 'card/plan', team, plots: [planPicked[0]!, planPicked[1]!] })}
        >
          تأكيد المخطط
        </Button>
      </div>
    </>
  );
}

/** The team took the inspector, and uses it at once: the referee picks the team whose missions it sees. */
function InspectorDecision({ state, act }: Props) {
  if (state.pending?.kind !== 'inspector') return null;
  const team = state.pending.team;
  const names = state.setup.teams;
  return (
    <>
      <Decision card="inspector" title="مفتش البلدية">
        <TeamName team={team} name={names[team].name} /> أخذ مفتش البلدية. اختر الحي الذي تُكشف مشاريعه.
      </Decision>
      <div className="inspector-targets">
        {TEAMS.filter((t) => t !== team).map((target) => (
          <TeamTileButton
            key={target}
            team={target}
            height={52}
            onClick={() => act({ type: 'card/inspector', team, target })}
          >
            <span className="team-tile-name">{names[target].name}</span>
          </TeamTileButton>
        ))}
      </div>
    </>
  );
}
