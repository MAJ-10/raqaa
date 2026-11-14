import { useRef, useState } from 'react';
import { TEAMS, type Setup, type Team, type TeamSetup } from '../engine/types.ts';
import type { RefereeStore } from '../state/referee-store.ts';
import { isReady, LIMITS } from '../state/setup.ts';
import { Button } from '../ui/Button.tsx';
import { Cloud, Skyline } from '../ui/City.tsx';
import { Segmented, Stepper } from '../ui/fields.tsx';
import { Icon } from '../ui/Icon.tsx';
import { MedadFoot } from '../ui/MedadFoot.tsx';
import { countOf, MISSION_NAMES, MISSION_NOUN, TEAM_COLOUR } from '../ui/names.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamTile } from '../ui/TeamTile.tsx';
import { Toolbar, TopBar } from '../ui/TopBar.tsx';
import { MissionPicker } from './MissionPicker.tsx';
import { DisplayButton } from './DisplayButton.tsx';
import { QuestionsCard } from './QuestionsCard.tsx';
import './setup.css';

/**
 * R02: the competition setup. The teams across the page; under them the map and the days in one row, and
 * beside them the questions. Behind it all, the identity's city; at the foot, the maker's signature.
 * Every change is saved at once, so «الرئيسية» (or the browser's back) leaves the setup as it is, for
 * «إنشاء غرفة» to open again.
 */
export function SetupScreen({ store, setup, onHome }: { store: RefereeStore; setup: Setup; onHome: () => void }) {
  const [picking, setPicking] = useState<Team | null>(null);
  const [shown, setShown] = useState<Set<Team>>(new Set());
  const nameFields = useRef<Partial<Record<Team, HTMLInputElement | null>>>({});

  /** Enter moves on to the next team's name, with the caret at its end; on the last name it closes the field. */
  const nextName = (team: Team, field: HTMLInputElement) => {
    const after = TEAMS[TEAMS.indexOf(team) + 1];
    const next = after ? nameFields.current[after] : null;
    if (!next) return field.blur();
    next.focus();
    next.setSelectionRange(next.value.length, next.value.length);
  };

  // Changes build on the store's setup, not this render's copy: reading the questions file takes a moment,
  // and anything typed meanwhile must not be lost.
  const current = () => store.getView().state?.setup ?? setup;
  const update = (change: Partial<Setup>) => store.updateSetup({ ...current(), ...change });
  const updateTeam = (team: Team, change: Partial<TeamSetup>) => {
    const { teams } = current();
    update({ teams: { ...teams, [team]: { ...teams[team], ...change } } });
  };
  const toggleShown = (team: Team) =>
    setShown((now) => {
      const next = new Set(now);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });

  return (
    <div className="setup">
      <Skyline className="setup-skyline" />
      <TopBar title={setup.demo ? 'مسابقة تجريبية' : 'إعداد المسابقة'}>
        <Toolbar>
          <Button variant="quiet" icon="back" onClick={onHome}>
            الرئيسية
          </Button>
          <DisplayButton />
        </Toolbar>
        <Button
          variant="primary"
          icon="play"
          disabled={!isReady(setup)}
          onClick={() => store.dispatch({ type: 'game/start', at: Date.now() })}
        >
          ابدأ
        </Button>
      </TopBar>

      <main className="setup-body">
        <section className="card setup-teams">
          <h2 className="card-title">الأحياء</h2>
          <div className="setup-teams-grid">
            <div className="setup-team-row setup-team-head" aria-hidden="true">
              <span />
              <span>الاسم</span>
              <span>اللاعبون</span>
              <span>المشاريع السرية</span>
            </div>
            {TEAMS.map((team) => {
              const t = setup.teams[team];
              const colour = TEAM_COLOUR[team];
              return (
                <TeamTile key={team} team={team} height={64} className="setup-team">
                  <input
                    ref={(field) => {
                      nameFields.current[team] = field;
                    }}
                    className="text-input"
                    value={t.name}
                    maxLength={LIMITS.name}
                    enterKeyHint={team === TEAMS[TEAMS.length - 1] ? 'done' : 'next'}
                    aria-label={`اسم الحي ${colour}`}
                    onChange={(e) => updateTeam(team, { name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      nextName(team, e.currentTarget);
                    }}
                  />
                  <Stepper
                    label={`لاعبو الحي ${colour}`}
                    value={t.players}
                    min={LIMITS.players.min}
                    max={LIMITS.players.max}
                    onChange={(players) => updateTeam(team, { players })}
                  />
                  <div className="setup-missions">
                    {t.missions.length > 0 && shown.has(team)
                      ? t.missions.map((m) => (
                          <span key={m} className="chip">
                            {MISSION_NAMES[m]}
                          </span>
                        ))
                      : null}
                    {t.missions.length > 0 ? (
                      <button
                        type="button"
                        className="chip chip-button"
                        aria-pressed={shown.has(team)}
                        aria-label={`إظهار مشاريع الحي ${colour}`}
                        onClick={() => toggleShown(team)}
                      >
                        <Icon name="eye" size={18} />
                        {shown.has(team) ? null : countOf(t.missions.length, MISSION_NOUN)}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`مشاريع الحي ${colour}`}
                      onClick={() => setPicking(team)}
                    >
                      <Icon name="plus" size={20} />
                      المشاريع
                    </button>
                  </div>
                </TeamTile>
              );
            })}
          </div>
        </section>

        <section className="card setup-map">
          <div>
            <h2 className="card-title">الخريطة</h2>
            <Segmented
              label="حجم الخريطة"
              value={setup.size}
              options={[
                { value: 9, label: `${formatNumber(9)}×${formatNumber(9)}` },
                { value: 7, label: `${formatNumber(7)}×${formatNumber(7)}` },
              ]}
              onChange={(size) => update({ size })}
            />
          </div>
          <div>
            <h2 className="card-title">الأيام</h2>
            <Stepper
              label="عدد الأيام"
              value={setup.days}
              min={LIMITS.days.min}
              max={LIMITS.days.max}
              onChange={(days) => update({ days })}
            />
          </div>
        </section>

        <QuestionsCard
          questions={setup.questions}
          source={setup.questionSource}
          onLoad={(questions, questionSource) => update({ questions, questionSource })}
        />
      </main>
      <div className="setup-sky" aria-hidden="true">
        <Cloud className="setup-cloud" />
        <Cloud className="setup-cloud" />
        <Cloud className="setup-cloud" />
      </div>
      <MedadFoot />

      {picking ? (
        <MissionPicker
          team={picking}
          name={setup.teams[picking].name}
          chosen={setup.teams[picking].missions}
          onChange={(missions) => updateTeam(picking, { missions })}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </div>
  );
}
