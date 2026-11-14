import { openAuction, population } from '../../engine/select.ts';
import type { GameState, Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { CardArt } from '../../ui/CardArt.tsx';
import { CountUp } from '../../ui/CountUp.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { CARD_NAMES, CARD_POWER, CARD_WHEN } from '../../ui/names.ts';
import { TeamBadge } from '../../ui/TeamBadge.tsx';
import { TeamTileButton } from '../../ui/TeamTile.tsx';

/** The two sides of the open auction say so; the team in turn needs only its colour. */
function roleOf(state: GameState, team: Team): string | null {
  const auction = openAuction(state);
  if (auction?.bidder === team) return 'يزايد';
  if (auction?.defender === team) return 'يدافع';
  return null;
}

type CardProps = {
  state: GameState;
  team: Team;
  open: boolean;
  onToggle: () => void;
  side: 'start' | 'end';
  place: 'top' | 'bottom';
};

/**
 * A team at its corner of the map, as a team tile: symbol, name, cards and population. The team in
 * turn, and the two sides of an open auction, are filled with their colour. Pressing the card opens
 * the team's cards.
 */
export function TeamCorner({ state, team, open, onToggle, side, place }: CardProps) {
  const role = roleOf(state, team);
  const active = role !== null || (state.step === 'build' && !state.pending && state.turn === team);
  return (
    <div className="team-corner" data-side={side} data-place={place}>
      <TeamTileButton team={team} height={68} filled={active} className="team-card" aria-expanded={open} onClick={onToggle}>
        <span className="team-card-text">
          <span className="team-card-name">{state.setup.teams[team].name}</span>
          <span className="team-card-meta">
            {role ? <span className="team-role">{role}</span> : null}
            {state.teams[team].cards.map((card, i) => (
              <Icon key={i} name={card} size={18} />
            ))}
          </span>
        </span>
        <span className="team-card-population">
          <Icon name="house" size={18} />
          <CountUp value={population(state, team)} />
        </span>
      </TeamTileButton>
      {open ? <Inventory state={state} team={team} onClose={onToggle} /> : null}
    </div>
  );
}

/** The cards a team holds, with their pictures, what each does and when it is used. */
function Inventory({ state, team, onClose }: { state: GameState; team: Team; onClose: () => void }) {
  const name = state.setup.teams[team].name;
  const cards = state.teams[team].cards;
  return (
    <div
      className="inventory"
      role="dialog"
      aria-label={`بطاقات ${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <header className="inventory-head">
        <TeamBadge team={team} name={name} size={28} />
        <Button variant="quiet" icon="x" aria-label="إغلاق" onClick={onClose} />
      </header>
      {cards.length === 0 ? (
        <p className="inventory-empty">لا يملك بطاقات</p>
      ) : (
        <ul className="inventory-cards">
          {cards.map((card, i) => (
            <li key={i} className="inventory-card">
              <CardArt card={card} />
              <span className="inventory-card-text">
                <strong>{CARD_NAMES[card]}</strong>
                <span>{CARD_POWER[card]}</span>
                <span>{CARD_WHEN[card]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
