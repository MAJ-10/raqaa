import { useEffect, useRef } from 'react';
import { MISSION_LEVEL, MISSION_REWARD, type Level } from '../engine/missions.ts';
import { MISSIONS, type Mission, type Team } from '../engine/types.ts';
import { LIMITS } from '../state/setup.ts';
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { MissionArt } from '../ui/MissionArt.tsx';
import { LEVEL_NAMES, MISSION_NAMES, TEAM_COLOUR } from '../ui/names.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamSymbol } from '../ui/TeamBadge.tsx';

const LEVELS: Level[] = ['easy', 'medium', 'hard'];

type Props = {
  team: Team;
  name: string;
  chosen: Mission[];
  onChange: (missions: Mission[]) => void;
  onClose: () => void;
};

/**
 * A dialog to pick a team's secret missions, from one to three. Each level says what it adds to the
 * team's population on success and takes away on failure; each mission shows its picture.
 */
export function MissionPicker({ team, name, chosen, onChange, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const toggle = (mission: Mission) =>
    onChange(chosen.includes(mission) ? chosen.filter((m) => m !== mission) : [...chosen, mission]);
  const full = chosen.length >= LIMITS.missions.max;
  const title = name || `الحي ${TEAM_COLOUR[team]}`;

  return (
    <dialog ref={dialog} className="mission-picker" onClose={onClose} aria-label={`مشاريع ${title}`}>
      <header className="mission-picker-head">
        <TeamSymbol team={team} size={36} />
        <h2>{title}</h2>
      </header>
      {LEVELS.map((level) => (
        <section key={level} className="mission-level">
          <header className="mission-level-head">
            <h3>{LEVEL_NAMES[level]}</h3>
            <span className="mission-reward" data-result="done">
              نجاح <span dir="ltr">{formatNumber(MISSION_REWARD[level].done * 100, { sign: true })}</span>
            </span>
            <span className="mission-reward" data-result="failed">
              فشل <span dir="ltr">{formatNumber(MISSION_REWARD[level].failed * 100, { sign: true })}</span>
            </span>
          </header>
          <div className="mission-options">
            {MISSIONS.filter((m) => MISSION_LEVEL[m] === level).map((mission) => {
              const on = chosen.includes(mission);
              return (
                <button
                  key={mission}
                  type="button"
                  className="mission-option"
                  data-team={team}
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(mission)}
                >
                  <MissionArt mission={mission} team={team} />
                  <span className="mission-option-name">{MISSION_NAMES[mission]}</span>
                  <Icon name="check" size={16} className="mission-option-check" />
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
