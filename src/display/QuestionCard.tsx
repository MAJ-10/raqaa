import { useLayoutEffect, useRef } from 'react';
import { TEAMS, type GameState } from '../engine/types.ts';
import { Icon } from '../ui/Icon.tsx';
import { EASE_BOUNCE, EASE_OUT, motion, reducedMotion } from '../ui/motion.ts';
import { formatNumber, toArabicDigits } from '../ui/number.ts';
import { TeamTile } from '../ui/TeamTile.tsx';
import { Timer } from '../ui/Timer.tsx';
import type { DisplayWindow } from './windows.ts';

type Phase = Extract<DisplayWindow, { kind: 'numbers' | 'question' | 'answer' }>;

/** How long the card takes to change its size, and its parts to come in. */
const MORPH = 560;
/** How long the players' numbers take to fly to their teams' boards. */
const FLY = 700;

type Spot = { x: number; y: number; width: number; height: number };

/** Where an element sits on the stage, in the stage's own pixels (1280×720), whatever its scale on screen. */
function onStage(element: Element, stage: Element): Spot {
  const box = element.getBoundingClientRect();
  const frame = stage.getBoundingClientRect();
  const k = frame.width / 1280;
  return { x: (box.left - frame.left) / k, y: (box.top - frame.top) / k, width: box.width / k, height: box.height / k };
}

/** The card as it was drawn last: its phase, its height, where the question sat, and the number tiles. */
type Drawn = {
  kind: Phase['kind'];
  marked: boolean;
  height: number;
  words: { spot: Spot; font: number } | null;
  tiles: { node: HTMLElement; spot: Spot }[];
};

const fontOf = (element: Element) => parseFloat(getComputedStyle(element).fontSize);

/**
 * D02 to D05 as one card: the day's question from the players' numbers to the answer and the permits. The
 * card stays while its parts change, so the question and its answer belong together. The numbers fly to
 * their teams' boards as the question comes; the question moves up and makes room for its answer; the
 * teams come in under it in build order, then their marks. A display that reopens shows the card as it is.
 */
export function QuestionCard({ state, shown, live }: { state: GameState; shown: Phase; live: boolean }) {
  const card = useRef<HTMLElement>(null);
  const before = useRef<Drawn | null>(null);
  const marked = shown.kind === 'answer' && shown.permits !== null;

  useLayoutEffect(() => {
    const node = card.current;
    const stage = node?.closest('.stage');
    if (!node || !stage) return;
    const was = before.current;
    const words = node.querySelector<HTMLElement>('.question-words');
    // Measured now, while the parts are on the card: a part that leaves can't be measured once it has gone.
    before.current = {
      kind: shown.kind,
      marked,
      height: node.offsetHeight,
      words: words ? { spot: onStage(words, stage), font: fontOf(words) } : null,
      tiles: [...node.querySelectorAll<HTMLElement>('.numbers-grid .team-tile')].map((tile) => ({ node: tile, spot: onStage(tile, stage) })),
    };
    if (!live || !was || reducedMotion()) return;

    if (was.kind !== shown.kind) {
      // The card eases to its new size, staying where it stands.
      motion(node, [{ height: `${was.height}px`, overflow: 'hidden' }, { height: `${node.offsetHeight}px`, overflow: 'hidden' }], { duration: MORPH });
    }
    if (was.kind === 'numbers' && shown.kind !== 'numbers') {
      // Each player's number flies to its team's board, where it stays while the question is on.
      for (const { node: tile, spot } of was.tiles) {
        const board = stage.querySelector(`.sign[data-team="${tile.dataset.team}"] .sign-board`);
        if (board) flyTo(tile, spot, onStage(board, stage), stage);
      }
      motion(words, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: MORPH, delay: 180, fill: 'backwards' });
    }
    if (was.kind === 'question' && shown.kind === 'answer' && words && was.words) {
      // The question moves up and grows smaller to make room for its answer. The card changes its height at
      // the same pace, staying centred, which moves what it holds by half the change: that is taken off.
      const now = onStage(words, stage);
      const drift = (node.offsetHeight - was.height) / 2;
      const dx = was.words.spot.x + was.words.spot.width - (now.x + now.width);
      const dy = was.words.spot.y - now.y - drift;
      motion(words, [{ transform: `translate(${dx}px, ${dy}px) scale(${was.words.font / fontOf(words)})` }, { transform: 'none' }], { duration: MORPH });
    }
    if (was.kind !== 'answer' && shown.kind === 'answer') {
      motion(node.querySelector('.answer-box'), [{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 260, easing: EASE_BOUNCE, fill: 'backwards' });
      node.querySelectorAll('.answer-teams .team-tile').forEach((tile, i) => {
        motion(tile, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 520 + i * 90, fill: 'backwards' });
      });
    }
    if (!was.marked && marked) {
      node.querySelectorAll('.answer-mark').forEach((mark, i) => {
        motion(mark, [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 110, easing: EASE_BOUNCE, fill: 'backwards' });
      });
    }
  }, [shown.kind, marked, live]);

  const text = shown.kind === 'numbers' ? null : shown.text;
  const words = text ? toArabicDigits(text) : 'سؤال من الحكم';
  return (
    <section ref={card} className="display-window window-question" data-window={shown.kind} aria-label="طلب البناء">
      <header className="window-head">
        <h2 className="window-label">
          <Icon name="question" size={30} />
          طلب بناء
        </h2>
        {shown.kind === 'question' && shown.timer ? <Timer startedAt={shown.timer.startedAt} seconds={shown.timer.seconds} size={84} /> : null}
      </header>

      {shown.kind === 'numbers' ? (
        // The teams sit as their boards do in the corners: coral and green on the right, blue and gold on the left.
        <div className="window-teams numbers-grid">
          {TEAMS.map((team) => (
            <TeamTile key={team} team={team} height={92} mark={<span className="team-tile-number">{formatNumber(shown.numbers[team])}</span>}>
              <span className="team-tile-name">{state.setup.teams[team].name}</span>
            </TeamTile>
          ))}
        </div>
      ) : (
        <p className="question-words" data-long={words.length > 90 || undefined} data-small={shown.kind === 'answer' || undefined}>
          {words}
        </p>
      )}

      {shown.kind === 'answer' ? (
        <>
          {shown.answer !== null ? (
            <p className="answer-box">
              <span className="answer-label">
                <Icon name="check" size={24} />
                الإجابة
              </span>
              <span className="answer-value">{toArabicDigits(shown.answer)}</span>
            </p>
          ) : null}
          {/* The teams in build order. Once the permits are confirmed, a permit gets a green frame and a tick;
              in a group question a wrong answer gets a red frame and a cross. In an individual question only
              the fastest right answer takes the permit, so the others are left plain. */}
          <div className="answer-teams">
            {shown.teams.map((team) => {
              const result = shown.permits === null ? null : shown.permits.includes(team) ? 'right' : shown.individual ? null : 'wrong';
              return (
                <TeamTile key={team} team={team} height={58} className={result ? `answer-${result}` : undefined}>
                  <span className="team-tile-name">{state.setup.teams[team].name}</span>
                  {result ? <Icon name={result === 'right' ? 'check' : 'x'} size={26} className="answer-mark" /> : null}
                </TeamTile>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}

/** A copy of a number tile flying from where it stood in the card to its team's board, shrinking as it goes. */
function flyTo(tile: HTMLElement, from: Spot, to: Spot, stage: Element) {
  // The tile has left the card already; where it stood was kept for this.
  const ghost = tile.cloneNode(true) as HTMLElement;
  ghost.classList.add('number-ghost');
  Object.assign(ghost.style, { position: 'absolute', left: `${from.x}px`, top: `${from.y}px`, width: `${from.width}px`, margin: '0', zIndex: '5', pointerEvents: 'none' });
  ghost.setAttribute('aria-hidden', 'true');
  stage.appendChild(ghost);
  const scale = to.height / from.height;
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const flight = ghost.animate(
    [
      { transform: 'none', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1, offset: 0.85 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
    ],
    { duration: FLY, easing: EASE_OUT },
  );
  flight.onfinish = () => ghost.remove();
}
