import { useLayoutEffect, useRef } from 'react';
import tokens from '../../assets/tokens.json';
import { TEAMS, type GameState, type Team } from '../engine/types.ts';
import { CountUp } from '../ui/CountUp.tsx';
import { Icon } from '../ui/Icon.tsx';
import { EASE_BOUNCE, motion } from '../ui/motion.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamTile } from '../ui/TeamTile.tsx';
import { TileFrame } from './TileFrame.tsx';
import { RESULT_AT, signLook, type DisplayWindow } from './windows.ts';

/**
 * When the announcement starts, each board counts its population up from nothing, one team after the
 * other, once night has fallen.
 */
const REVEAL_AT = 1100;
const REVEAL_EVERY = 450;
const REVEAL_TIME = 2200;

/** Which corner of the stage each team's boards hang in (the corner of its base on the map). */
const CORNER = tokens.teamCorner as Record<Team, string>;

/**
 * Each team's boards at its corner of the stage: its name on a team tile, with the identity's dashed
 * frame inside it, that fills with the team's colour while the team plays (no arrow, no turn number);
 * and under it, hung on two posts, a white board with its population and the cards it holds, or its
 * player's number while an individual question is on screen. In the last days the population hides and
 * only the cards stay. Behind a window, the boards of teams with no part in it fade. A team with a permit
 * to use has a tick on its name board. When the announcement has just started (`reveal`), the populations
 * count up from nothing.
 */
export function TeamSigns({ state, shown, live, reveal = false }: { state: GameState; shown: DisplayWindow | null; live: boolean; reveal?: boolean }) {
  const announcing = state.step === 'announce';
  return (
    <div className="signs" data-testid="display-teams">
      {TEAMS.map((team, i) => {
        const look = signLook(state, team, shown);
        const cards = state.teams[team].cards;
        const number = look.board && 'number' in look.board ? look.board.number : null;
        return (
          <div key={team} className="sign" data-corner={CORNER[team]} data-team={team} data-faded={look.faded || undefined}>
            <TeamTile team={team} height={66} filled={look.filled} className="sign-name">
              <span className="team-tile-name">{state.setup.teams[team].name}</span>
              <TileFrame />
            </TeamTile>
            {look.permit ? <PermitMark live={live} /> : null}
            <span className="sign-posts" aria-hidden="true" />
            <div className="sign-board">
              {number !== null ? (
                <span className="sign-number">رقم {formatNumber(number)}</span>
              ) : (
                <>
                  {look.board && 'population' in look.board ? (
                    // The announcement draws its own count: from nothing as it starts, then with each mission.
                    <span key={announcing ? 'announce' : 'day'} className="sign-population">
                      <Icon name="house" size={22} />
                      {/* In the announcement, a board counts when its mission's result comes. */}
                      <CountUp
                        value={look.board.population}
                        from={reveal ? 0 : undefined}
                        duration={reveal ? REVEAL_TIME : undefined}
                        delay={reveal ? REVEAL_AT + i * REVEAL_EVERY : shown?.kind === 'mission' ? RESULT_AT : 0}
                      />
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

/** The tick on a team's name board while it has a permit to use: it pops in as the permits' window goes. */
function PermitMark({ live }: { live: boolean }) {
  const mark = useRef<HTMLSpanElement>(null);
  const came = useRef(live);
  useLayoutEffect(() => {
    if (came.current) motion(mark.current, [{ opacity: 0, transform: 'scale(0.2)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: EASE_BOUNCE });
  }, []);
  return (
    <span ref={mark} className="sign-permit" role="img" aria-label="معه تصريح">
      <Icon name="check" size={26} />
    </span>
  );
}
