import { useState } from 'react';
import mark from '../../assets/brand/mark.svg';
import { TEAMS, type Setup, type Team, type TeamSetup } from '../engine/types.ts';
import type { RefereeStore } from '../state/referee-store.ts';
import { isReady, LIMITS } from '../state/setup.ts';
import { Button } from '../ui/Button.tsx';
import { Segmented, Stepper } from '../ui/fields.tsx';
import { Icon } from '../ui/Icon.tsx';
import { countOf, MISSION_NAMES, MISSION_NOUN, TEAM_COLOUR } from '../ui/names.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamSymbol } from '../ui/TeamBadge.tsx';
import { MissionPicker } from './MissionPicker.tsx';
import { openDisplayWindow } from './open-display.ts';
import { QuestionsCard } from './QuestionsCard.tsx';
import './setup.css';

/** R02: the competition setup. Every change is saved at once. */
export function SetupScreen({ store, setup }: { store: RefereeStore; setup: Setup }) {
  const [picking, setPicking] = useState<Team | null>(null);
  const [shown, setShown] = useState<Set<Team>>(new Set());

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
      <header className="top-bar">
        <h1 className="top-bar-title">
          <img src={mark} alt="" />
          إعداد المسابقة
        </h1>
        <div className="top-bar-actions">
          <Button icon="tv" onClick={openDisplayWindow}>
            فتح شاشة العرض
          </Button>
          <Button
            variant="primary"
            disabled={!isReady(setup)}
            onClick={() => store.dispatch({ type: 'game/start', at: Date.now() })}
          >
            ابدأ
          </Button>
        </div>
      </header>

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
                <div className="setup-team-row" key={team}>
                  <TeamSymbol team={team} size={44} />
                  <input
                    className="text-input"
                    value={t.name}
                    maxLength={LIMITS.name}
                    aria-label={`اسم الحي ${colour}`}
                    onChange={(e) => updateTeam(team, { name: e.target.value })}
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
                </div>
              );
            })}
          </div>
        </section>

        <div className="setup-side">
          <section className="card">
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
            <h2 className="card-title setup-days-title">الأيام</h2>
            <Stepper
              label="عدد الأيام"
              value={setup.days}
              min={LIMITS.days.min}
              max={LIMITS.days.max}
              onChange={(days) => update({ days })}
            />
          </section>

          <QuestionsCard
            questions={setup.questions}
            source={setup.questionSource}
            onLoad={(questions, questionSource) => update({ questions, questionSource })}
          />
        </div>
      </main>

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
