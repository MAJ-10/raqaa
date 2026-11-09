import logo from '../../assets/brand/logo-horizontal.svg';
import { TEAMS, type GameEvent, type GameState } from '../engine/types.ts';
import { TeamBadge } from '../ui/TeamBadge.tsx';
import './display.css';
import { Stage } from './Stage.tsx';
import { useRefereeSnapshot } from './use-referee.ts';

// Phase 3: the logo, and the team names once a competition exists. The real display states come in Phase 5.
export function DisplayApp() {
  const snapshot = useRefereeSnapshot<GameState | null, GameEvent>();
  const state = snapshot?.state ?? null;

  return (
    <Stage>
      <div className="display-start">
        <img className="display-logo" src={logo} alt="رقعة" />
        {state ? (
          <ul className="display-teams" data-testid="display-teams">
            {TEAMS.map((team) => (
              <li key={team}>
                <TeamBadge team={team} name={state.setup.teams[team].name} size={56} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Stage>
  );
}
