import mark from '../../assets/brand/mark.svg';
import { TEAMS, type GameState } from '../engine/types.ts';
import type { RefereeStore } from '../state/referee-store.ts';
import { Button } from '../ui/Button.tsx';
import { countOf, MISSION_NOUN, PLAYER_NOUN, QUESTION_NOUN } from '../ui/names.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamBadge } from '../ui/TeamBadge.tsx';
import { openDisplayWindow } from './open-display.ts';

// Phase 3 stand-in for the referee's play screens (Phase 4): a summary of the started competition.
export function StartedScreen({ store, state }: { store: RefereeStore; state: GameState }) {
  const { setup } = state;
  const end = () => {
    if (window.confirm('إنهاء المسابقة يمسحها نهائياً. متأكد؟')) store.end();
  };

  return (
    <div className="setup">
      <header className="top-bar">
        <h1 className="top-bar-title">
          <img src={mark} alt="" />
          اليوم {formatNumber(state.day)} من {formatNumber(state.days)}
        </h1>
        <div className="top-bar-actions">
          <Button icon="tv" onClick={openDisplayWindow}>
            فتح شاشة العرض
          </Button>
          <Button icon="x" onClick={end}>
            إنهاء المسابقة
          </Button>
        </div>
      </header>
      <main className="setup-body">
        <section className="card setup-teams">
          <h2 className="card-title">الأحياء</h2>
          {TEAMS.map((team) => (
            <div key={team} className="started-team">
              <TeamBadge team={team} name={setup.teams[team].name} size={40} />
              <span>{countOf(setup.teams[team].players, PLAYER_NOUN)}</span>
              <span>{countOf(setup.teams[team].missions.length, MISSION_NOUN)}</span>
            </div>
          ))}
        </section>
        <section className="card">
          <h2 className="card-title">
            {formatNumber(setup.size)}×{formatNumber(setup.size)}
          </h2>
          <p>{countOf(setup.questions.length, QUESTION_NOUN)}</p>
        </section>
      </main>
    </div>
  );
}
