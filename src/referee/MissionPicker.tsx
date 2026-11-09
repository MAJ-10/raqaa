import { useEffect, useRef } from 'react';
import { MISSION_LEVEL, type Level } from '../engine/missions.ts';
import { MISSIONS, type Mission, type Team } from '../engine/types.ts';
import { LIMITS } from '../state/setup.ts';
import { Button } from '../ui/Button.tsx';
import { LEVEL_NAMES, MISSION_NAMES, TEAM_COLOUR } from '../ui/names.ts';
import { TeamSymbol } from '../ui/TeamBadge.tsx';

const LEVELS: Level[] = ['easy', 'medium', 'hard'];

type Props = {
  team: Team;
  name: string;
  chosen: Mission[];
  onChange: (missions: Mission[]) => void;
  onClose: () => void;
};

/** A dialog to pick a team's secret missions: from one to three. */
export function MissionPicker({ team, name, chosen, onChange, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const toggle = (mission: Mission) =>
    onChange(chosen.includes(mission) ? chosen.filter((m) => m !== mission) : [...chosen, mission]);
  const full = chosen.length >= LIMITS.missions.max;

  return (
    <dialog ref={dialog} className="mission-picker" onClose={onClose} aria-label={`مشاريع ${name || `الحي ${TEAM_COLOUR[team]}`}`}>
      <header className="mission-picker-head">
        <TeamSymbol team={team} size={36} />
        <h2>{name || `الحي ${TEAM_COLOUR[team]}`}</h2>
      </header>
      {LEVELS.map((level) => (
        <section key={level} className="mission-level">
          <h3>{LEVEL_NAMES[level]}</h3>
          <div className="mission-options">
            {MISSIONS.filter((m) => MISSION_LEVEL[m] === level).map((mission) => {
              const on = chosen.includes(mission);
              return (
                <button
                  key={mission}
                  type="button"
                  className="mission-option"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(mission)}
                >
                  {MISSION_NAMES[mission]}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <footer className="mission-picker-foot">
        <Button variant="primary" icon="check" onClick={() => dialog.current?.close()}>
          تم
        </Button>
      </footer>
    </dialog>
  );
}
