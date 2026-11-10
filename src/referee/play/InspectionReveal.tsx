import { useEffect, useRef } from 'react';
import type { GameState, Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { CardArt } from '../../ui/CardArt.tsx';
import { MissionArt } from '../../ui/MissionArt.tsx';
import { MISSION_NAMES } from '../../ui/names.ts';
import { TeamName } from '../../ui/TeamBadge.tsx';

type Props = { state: GameState; team: Team; target: Team; onClose: () => void };

/**
 * What the inspector shows, in a window over the referee screen: the other team's missions with their
 * pictures, for the team that took it. The referee closes it when the team has seen them.
 */
export function InspectionReveal({ state, team, target, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const names = state.setup.teams;

  return (
    <dialog ref={dialog} className="reveal" data-team={target} onClose={onClose} aria-label={`مشاريع ${names[target].name}`}>
      <header className="reveal-head">
        <CardArt card="inspector" />
        <div className="reveal-title">
          <h2>
            مشاريع <TeamName team={target} name={names[target].name} />
          </h2>
          <p>
            يراها <TeamName team={team} name={names[team].name} /> وحده
          </p>
        </div>
      </header>
      <ul className="reveal-missions">
        {names[target].missions.map((mission) => (
          <li key={mission}>
            <MissionArt mission={mission} team={target} />
            <span>{MISSION_NAMES[mission]}</span>
          </li>
        ))}
      </ul>
      <footer className="reveal-foot">
        <Button variant="primary" icon="check" onClick={() => dialog.current?.close()}>
          تم
        </Button>
      </footer>
    </dialog>
  );
}
