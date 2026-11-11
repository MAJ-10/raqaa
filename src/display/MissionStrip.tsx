import { useLayoutEffect, useRef } from 'react';
import type { MissionResult } from '../engine/missions.ts';
import type { GameState, Team } from '../engine/types.ts';
import { Icon } from '../ui/Icon.tsx';
import { MissionArt } from '../ui/MissionArt.tsx';
import { EASE_BOUNCE, motion, reducedMotion } from '../ui/motion.ts';
import { MISSION_NAMES, MISSION_TEXT } from '../ui/names.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamName } from '../ui/TeamBadge.tsx';
import { RESULT_AT, WINDOW_IN } from './windows.ts';

type Props = { state: GameState; team: Team; result: MissionResult; live: boolean };

/**
 * D20, beside the map: one secret mission in the announcement, in a strip at the top of the stage, so the
 * whole map stays in view under it and everyone can check the mission on the map with their own eyes.
 * The strip stays from one mission to the next; only what it holds changes. Its result comes a moment
 * after the mission, when the team's board counts to its new population.
 */
export function MissionStrip({ state, team, result, live }: Props) {
  const strip = useRef<HTMLElement>(null);
  const came = useRef(false);

  useLayoutEffect(() => {
    const node = strip.current;
    const first = !came.current;
    came.current = true;
    if (!node || !live || reducedMotion()) return;
    if (first) {
      // The first mission: the strip comes down into place, where the map's title was.
      motion(node, [{ opacity: 0, transform: 'translate(-50%, -24px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: WINDOW_IN });
    } else {
      // The next ones: the strip stays, and its picture and words come in from its start.
      node.querySelectorAll('.mission-picture, .mission-words > *').forEach((part, i) => {
        motion(part, [{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: i * 70, fill: 'backwards' });
      });
    }
    motion(node.querySelector('.mission-result'), [{ opacity: 0, transform: 'scale(0.5)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: RESULT_AT, easing: EASE_BOUNCE, fill: 'backwards' });
  }, [team, result.mission, live]);

  return (
    <section ref={strip} className="mission-strip" data-window="mission" aria-label="مشروع سري">
      <span className="mission-picture">
        <MissionArt mission={result.mission} team={team} />
      </span>
      <div className="mission-words">
        <p className="mission-kicker">
          <Icon name="envelope" size={22} />
          مشروع سري
          <TeamName team={team} name={state.setup.teams[team].name} />
        </p>
        <p className="mission-title">{MISSION_NAMES[result.mission]}</p>
        <p className="mission-text">{MISSION_TEXT[result.mission]}</p>
      </div>
      <p className="mission-result" data-done={result.done || undefined}>
        <Icon name={result.done ? 'check' : 'x'} size={28} />
        <b>{formatNumber(result.points * 100, { sign: true })}</b>
      </p>
    </section>
  );
}
