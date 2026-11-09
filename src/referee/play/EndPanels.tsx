import { useState } from 'react';
import { announcement, ranking } from '../../engine/missions.ts';
import { isMapFull, population } from '../../engine/select.ts';
import { TEAMS, type EventInput, type GameEvent, type GameState } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Stepper } from '../../ui/fields.tsx';
import { countOf, MISSION_NAMES } from '../../ui/names.ts';
import { formatNumber } from '../../ui/number.ts';
import { TeamBadge } from '../../ui/TeamBadge.tsx';

type Props = { state: GameState; act: (event: EventInput) => void };

const BUILDING_NOUN = {
  one: 'مبنى جديد',
  two: 'مبنيان جديدان',
  plural: 'مبانٍ جديدة',
  accusative: 'مبنى جديداً',
  genitive: 'مبنى جديد',
};
const AUCTION_NOUN = { one: 'مزاد واحد', two: 'مزادان', plural: 'مزادات', accusative: 'مزاداً', genitive: 'مزاد' };

/** R10: the end of a day. The next day; or on the last day, extend or announce. */
export function DayEndPanel({ state, act, today }: Props & { today: GameEvent[] }) {
  const [extra, setExtra] = useState(2);
  const last = state.day >= state.days;
  const builds = today.filter((e) => e.type === 'build').length;
  const auctions = state.auctions.filter((a) => a.day === state.day && a.status === 'done');
  const bidderWins = auctions.filter((a) => a.winner === a.bidder).length;

  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>نهاية اليوم {formatNumber(state.day)}</h2>
      </header>
      <p className="summary-line">{builds > 0 ? countOf(builds, BUILDING_NOUN) : 'ما فيه مبانٍ جديدة'}</p>
      <p className="summary-line">
        {auctions.length > 0
          ? `${countOf(auctions.length, AUCTION_NOUN)}، فاز المزايد في ${formatNumber(bidderWins)}`
          : 'ما فيه مزادات'}
      </p>
      {isMapFull(state) ? <p className="panel-warning">الخريطة امتلأت</p> : null}
      {last ? (
        <div className="extend-row">
          <strong>تمديد</strong>
          <Stepper label="أيام التمديد" value={extra} min={1} max={30} onChange={setExtra} />
          <Button onClick={() => act({ type: 'days/extend', count: extra })}>تمديد</Button>
        </div>
      ) : null}
      <footer className="panel-actions">
        {last ? (
          <Button variant="primary" icon="crown" onClick={() => act({ type: 'game/end' })}>
            الإعلان
          </Button>
        ) : (
          <Button variant="primary" onClick={() => act({ type: 'day/end' })}>
            اليوم الجاي
          </Button>
        )}
      </footer>
    </section>
  );
}

/** R13: the announcement, one step at a time; then a new competition. */
export function AnnouncePanel({ state, act, onNew }: Props & { onNew: () => void }) {
  const steps = announcement(state);
  const step = steps[state.announce]!;
  const names = state.setup.teams;
  const lastStep = state.announce >= steps.length - 1;

  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>الإعلان</h2>
      </header>
      {step.kind === 'population' ? (
        <ul className="announce-list">
          <li className="announce-title">سكان الخريطة</li>
          {TEAMS.map((team) => (
            <li key={team}>
              <TeamBadge team={team} name={names[team].name} size={28} />
              <strong>{formatNumber(population(state, team))}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {step.kind === 'mission' ? (
        <div className="announce-mission" data-team={step.team}>
          <TeamBadge team={step.team} name={names[step.team].name} size={32} />
          <p>{MISSION_NAMES[step.result.mission]}</p>
          <strong data-done={step.result.done || undefined}>
            {step.result.done ? 'نجح' : 'فشل'} {formatNumber(step.result.points * 100, { sign: true })}
          </strong>
        </div>
      ) : null}
      {step.kind === 'podium' ? (
        <ol className="announce-list">
          <li className="announce-title">عمدة الرقعة</li>
          {ranking(state).map((row) => (
            <li key={row.team}>
              <span className="build-index">{formatNumber(row.rank)}</span>
              <TeamBadge team={row.team} name={names[row.team].name} size={28} />
              <strong>{formatNumber(row.score * 100)}</strong>
            </li>
          ))}
        </ol>
      ) : null}
      <footer className="panel-actions">
        {lastStep ? (
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              if (window.confirm('تبدأ مسابقة جديدة؟ هذي المسابقة تنمسح.')) onNew();
            }}
          >
            مسابقة جديدة
          </Button>
        ) : (
          <Button variant="primary" onClick={() => act({ type: 'announce/next' })}>
            التالي
          </Button>
        )}
      </footer>
    </section>
  );
}
