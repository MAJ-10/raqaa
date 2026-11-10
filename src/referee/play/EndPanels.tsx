import { useState } from 'react';
import { announcement, ranking } from '../../engine/missions.ts';
import { isMapFull, population } from '../../engine/select.ts';
import { TEAMS, type EventInput, type GameState, type Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Confirm } from '../../ui/Confirm.tsx';
import { Stepper } from '../../ui/fields.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { MissionArt } from '../../ui/MissionArt.tsx';
import { MISSION_NAMES } from '../../ui/names.ts';
import { formatNumber } from '../../ui/number.ts';
import { TeamBadge } from '../../ui/TeamBadge.tsx';
import { TeamTile } from '../../ui/TeamTile.tsx';

type Props = { state: GameState; act: (event: EventInput) => void };

/**
 * R10: the end of a day: the day's tally, then the next day, or on the last day, extend or announce.
 * Ending before the last day is a small action here, and asks first.
 */
export function DayEndBody({ state, act, gains }: Props & { gains: Record<Team, number> | null }) {
  const [extra, setExtra] = useState(2);
  const [ending, setEnding] = useState(false);
  const last = state.day >= state.days;

  return (
    <>
      {gains ? <DayTally state={state} gains={gains} /> : null}
      {isMapFull(state) ? <p className="step-note">امتلأت الخريطة</p> : null}
      {last ? (
        <>
          <div className="extend-row">
            <span className="extend-label">تمديد</span>
            <Stepper label="أيام التمديد" value={extra} min={1} max={30} onChange={setExtra} />
            <Button onClick={() => act({ type: 'days/extend', count: extra })}>تمديد</Button>
          </div>
          <div className="step-actions">
            <Button variant="primary" icon="crown" onClick={() => act({ type: 'game/end' })}>
              الإعلان
            </Button>
          </div>
        </>
      ) : ending ? (
        <Confirm
          text="تنتهي المسابقة الآن قبل آخر يوم، وتنتقل إلى الإعلان."
          confirm="إنهاء المسابقة"
          onConfirm={() => act({ type: 'game/end' })}
          onCancel={() => setEnding(false)}
        />
      ) : (
        <>
          <div className="step-actions">
            <Button variant="primary" onClick={() => act({ type: 'day/end' })}>
              اليوم التالي
            </Button>
          </div>
          <button type="button" className="text-button end-game" onClick={() => setEnding(true)}>
            إنهاء المسابقة
          </button>
        </>
      )}
    </>
  );
}

/** What each team gained today, the most first: in green when it grew, in red when it lost. */
function DayTally({ state, gains }: { state: GameState; gains: Record<Team, number> }) {
  const order = [...TEAMS].sort((a, b) => gains[b] - gains[a]);
  return (
    <section className="day-tally" aria-label="حصيلة اليوم">
      <h3 className="section-label">حصيلة اليوم</h3>
      <ol className="tally-list">
        {order.map((team) => {
          const gain = gains[team];
          return (
            <li key={team}>
              <TeamTile team={team} height={44}>
                <span className="team-tile-name">{state.setup.teams[team].name}</span>
                {gain === 0 ? (
                  <span className="tally-same">لم يتغير</span>
                ) : (
                  <strong className="tally-gain" data-sign={gain > 0 ? 'up' : 'down'} dir="ltr">
                    {formatNumber(gain, { sign: true })}
                  </strong>
                )}
              </TeamTile>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Each part of the announcement, with its icon from the identity. */
const HEADS: Record<'population' | 'mission' | 'podium', [string, string]> = {
  population: ['سكان الخريطة', 'house'],
  mission: ['المشاريع', 'envelope'],
  podium: ['عمدة الرقعة', 'crown'],
};

/** R13: the announcement, one step at a time; then a new competition, after asking. */
export function AnnouncePanel({ state, act, onNew }: Props & { onNew: () => void }) {
  const [starting, setStarting] = useState(false);
  const steps = announcement(state);
  const step = steps[state.announce]!;
  const names = state.setup.teams;
  const lastStep = state.announce >= steps.length - 1;

  const [title, icon] = HEADS[step.kind];

  return (
    <section className="announce" aria-label="الإعلان">
      <header className="announce-head">
        <h2>الإعلان</h2>
        <span className="announce-count">
          {formatNumber(state.announce + 1)} من {formatNumber(steps.length)}
        </span>
      </header>
      <div className="announce-card">
        <div className="track-head">
          <span className="track-marker" aria-hidden="true">
            <Icon name={icon} size={18} />
          </span>
          <h3 className="announce-title">{title}</h3>
        </div>
        {step.kind === 'population' ? (
          <ul className="announce-list">
            {TEAMS.map((team) => (
              <li key={team}>
                <TeamTile team={team} height={48}>
                  <span className="team-tile-name">{names[team].name}</span>
                  <strong>{formatNumber(population(state, team))}</strong>
                </TeamTile>
              </li>
            ))}
          </ul>
        ) : null}
        {step.kind === 'mission' ? (
          <div className="announce-mission">
            <MissionArt mission={step.result.mission} team={step.team} />
            <div className="announce-mission-main">
              <TeamBadge team={step.team} name={names[step.team].name} size={24} />
              <p>{MISSION_NAMES[step.result.mission]}</p>
            </div>
            <strong data-done={step.result.done || undefined}>
              {step.result.done ? 'نجح' : 'فشل'}
              <span dir="ltr">{formatNumber(step.result.points * 100, { sign: true })}</span>
            </strong>
          </div>
        ) : null}
        {step.kind === 'podium' ? (
          <ol className="announce-list">
            {ranking(state).map((row) => (
              <li key={row.team}>
                <span className="announce-rank">{formatNumber(row.rank)}</span>
                <TeamTile team={row.team} height={48} filled={row.rank === 1}>
                  <span className="team-tile-name">{names[row.team].name}</span>
                  <strong>{formatNumber(row.score * 100)}</strong>
                </TeamTile>
              </li>
            ))}
          </ol>
        ) : null}
        {lastStep && starting ? (
          <Confirm
            text="تُحذف هذه المسابقة، وتبدأ مسابقة جديدة من الصفحة الأولى."
            confirm="مسابقة جديدة"
            onConfirm={onNew}
            onCancel={() => setStarting(false)}
          />
        ) : (
          <div className="step-actions">
            {lastStep ? (
              <Button variant="primary" icon="plus" onClick={() => setStarting(true)}>
                مسابقة جديدة
              </Button>
            ) : (
              <Button variant="primary" onClick={() => act({ type: 'announce/next' })}>
                التالي
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
