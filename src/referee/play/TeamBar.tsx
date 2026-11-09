import { useState } from 'react';
import { canUseCard, population } from '../../engine/select.ts';
import { TEAMS, type EventInput, type GameState, type Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { CARD_NAMES, CARD_WHEN, MISSION_NAMES } from '../../ui/names.ts';
import { formatNumber } from '../../ui/number.ts';
import { TeamBadge, TeamSymbol } from '../../ui/TeamBadge.tsx';

type Props = { state: GameState; act: (event: EventInput) => void };

/** The four teams above the map: name, population and cards. Pressing a team opens its inventory. */
export function TeamBar({ state, act }: Props) {
  const [open, setOpen] = useState<Team | null>(null);
  const names = state.setup.teams;

  return (
    <div className="team-bar">
      {TEAMS.map((team) => (
        <div key={team} className="team-card-wrap">
          <button
            type="button"
            className="team-card"
            data-team={team}
            data-turn={state.turn === team || undefined}
            aria-expanded={open === team}
            onClick={() => setOpen(open === team ? null : team)}
          >
            <TeamSymbol team={team} size={36} />
            <span className="team-card-text">
              <span className="team-card-name">{names[team].name}</span>
              <span className="team-card-cards">
                {state.teams[team].cards.map((card, i) => (
                  <Icon key={i} name={card} size={16} />
                ))}
              </span>
            </span>
            <span className="team-card-population">{formatNumber(population(state, team))}</span>
          </button>
          {open === team ? <Inventory state={state} team={team} act={act} onClose={() => setOpen(null)} /> : null}
        </div>
      ))}
    </div>
  );
}

function Inventory({ state, team, act, onClose }: Props & { team: Team; onClose: () => void }) {
  const [choosing, setChoosing] = useState(false);
  const [seen, setSeen] = useState<Team | null>(null);
  const names = state.setup.teams;
  const cards = state.teams[team].cards;
  const canInspect = canUseCard(state, team, 'inspector') && !state.pending && state.step !== 'announce';

  return (
    <div className="inventory" role="dialog" aria-label={`مخزون ${names[team].name}`}>
      <header className="inventory-head">
        <TeamBadge team={team} name={names[team].name} size={32} />
        <button type="button" className="link-button" onClick={onClose}>
          إغلاق
        </button>
      </header>
      {cards.length === 0 ? <p className="inventory-empty">ما عنده بطاقات</p> : null}
      <div className="inventory-cards">
        {cards.map((card, i) => {
          const usable = card === 'inspector' && canInspect;
          return (
            <button
              key={i}
              type="button"
              className="inventory-card"
              disabled={!usable}
              aria-pressed={usable && choosing}
              onClick={() => setChoosing(!choosing)}
            >
              <Icon name={card} size={22} />
              <strong>{CARD_NAMES[card]}</strong>
              <span>{CARD_WHEN[card]}</span>
            </button>
          );
        })}
      </div>
      {choosing ? (
        <div className="inventory-targets">
          {TEAMS.filter((t) => t !== team).map((target) => (
            <Button
              key={target}
              onClick={() => {
                act({ type: 'card/inspector', team, target });
                setChoosing(false);
                setSeen(target);
              }}
            >
              <TeamBadge team={target} name={names[target].name} size={24} />
            </Button>
          ))}
        </div>
      ) : null}
      {seen ? (
        <div className="inventory-missions" data-team={seen}>
          <strong>مشاريع {names[seen].name}</strong>
          <ul>
            {names[seen].missions.map((m) => (
              <li key={m}>{MISSION_NAMES[m]}</li>
            ))}
          </ul>
          <Button onClick={() => setSeen(null)}>إخفاء</Button>
        </div>
      ) : null}
    </div>
  );
}
