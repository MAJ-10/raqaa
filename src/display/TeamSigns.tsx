import tokens from '../../assets/tokens.json';
import { TEAMS, type GameState, type Team } from '../engine/types.ts';
import { CountUp } from '../ui/CountUp.tsx';
import { Icon } from '../ui/Icon.tsx';
import { formatNumber } from '../ui/number.ts';
import { TeamTile } from '../ui/TeamTile.tsx';
import { TileFrame } from './TileFrame.tsx';
import { signLook, type DisplayWindow } from './windows.ts';

/** Which corner of the stage each team's boards hang in (the corner of its base on the map). */
const CORNER = tokens.teamCorner as Record<Team, string>;

/**
 * Each team's boards at its corner of the stage: its name on a team tile, with the identity's dashed
 * frame inside it, that fills with the team's colour while the team plays (no arrow, no turn number);
 * and under it, hung on two posts, a white board with its population and the cards it holds, or its
 * player's number while an individual question is on screen. In the last days the population hides and
 * only the cards stay. Behind a window, the boards of teams with no part in it fade.
 */
export function TeamSigns({ state, shown }: { state: GameState; shown: DisplayWindow | null }) {
  return (
    <div className="signs" data-testid="display-teams">
      {TEAMS.map((team) => {
        const look = signLook(state, team, shown);
        const cards = state.teams[team].cards;
        const number = look.board && 'number' in look.board ? look.board.number : null;
        return (
          <div key={team} className="sign" data-corner={CORNER[team]} data-team={team} data-faded={look.faded || undefined}>
            <TeamTile team={team} height={66} filled={look.filled} className="sign-name">
              <span className="team-tile-name">{state.setup.teams[team].name}</span>
              <TileFrame />
            </TeamTile>
            <span className="sign-posts" aria-hidden="true" />
            <div className="sign-board">
              {number !== null ? (
                <span className="sign-number">رقم {formatNumber(number)}</span>
              ) : (
                <>
                  {look.board && 'population' in look.board ? (
                    <span className="sign-population">
                      <Icon name="house" size={22} />
                      <CountUp value={look.board.population} />
                    </span>
                  ) : null}
                  {cards.length > 0 ? (
                    <span className="sign-cards">
                      {cards.map((card, i) => (
                        <Icon key={i} name={card} size={24} />
                      ))}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
