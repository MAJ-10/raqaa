import { useLayoutEffect, useRef, type ReactNode } from 'react';
import tokens from '../../assets/tokens.json';
import { MEMORY_IMAGES, MEMORY_WORDS, ORDERING, SPELLING, sentenceWords } from '../content/index.ts';
import { TIMER_SECONDS, wins } from '../engine/select.ts';
import type { Auction, Challenge, ChallengeContent, GameState, Team } from '../engine/types.ts';
import { Icon } from '../ui/Icon.tsx';
import { EASE_BOUNCE, EASE_OUT, motion } from '../ui/motion.ts';
import { CHALLENGE_NAMES, MATH_OPS } from '../ui/names.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamSymbol } from '../ui/TeamBadge.tsx';
import { TeamTile } from '../ui/TeamTile.tsx';
import { TEAM_PATHS } from '../ui/team-paths.ts';
import { Timer } from '../ui/Timer.tsx';
import { tones } from './board-art.ts';
import { box, decal, MAP_VIEW, project } from './iso.ts';
import { Box } from './IsoMap.tsx';
import { Pin } from './Pin.tsx';
import { useTicking } from './use-clock.ts';
import type { Running } from './windows.ts';

/** The mental maths steps appear one every three seconds. */
const MATH_STEP_TIME = 3000;

/** Each player has three tries at the precision challenge. */
const PRECISION_TRIES = 3;

type Props = { state: GameState; auction: Auction; challenge: Challenge | null; timer: Running | null; live: boolean };

/**
 * Something that comes in when the moment brings it: fading up into place, or popping. Not when the display
 * reopens (`live` is false then), and never under reduced motion.
 */
function Appear({ live, pop = false, children }: { live: boolean; pop?: boolean; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const came = useRef(live);
  useLayoutEffect(() => {
    if (!came.current) return;
    const from = pop ? { opacity: 0, transform: 'scale(0.6)' } : { opacity: 0, transform: 'translateY(12px)' };
    motion(element.current, [from, { opacity: 1, transform: 'none' }], { duration: pop ? 520 : 380, easing: pop ? EASE_BOUNCE : EASE_OUT });
  }, [pop]);
  return (
    <div ref={element} className="appear">
      {children}
    </div>
  );
}

/**
 * D11 to D17: the auction over the dimmed game. On top, the two sides with their players' numbers, the
 * plot between them under the bidder's pin, and each side's two win boxes. Under them, the challenge:
 * its number and name, the timer, and what the challenge shows. When a challenge ends its answer shows,
 * and when the auction is won the winner fills and the plot takes its colour with a pulse.
 */
export function AuctionWindow({ state, auction, challenge, timer, live }: Props) {
  const names = state.setup.teams;
  const plot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (live && auction.status === 'done') {
      motion(plot.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.2)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 640 });
    }
  }, [live, auction.status]);
  const side = (team: Team, player: number) => (
    <TeamTile
      team={team}
      height={80}
      filled={auction.winner === team}
      className="duel-side"
      mark={<span className="team-tile-number">{formatNumber(player)}</span>}
    >
      <span className="team-tile-name">{names[team].name}</span>
    </TeamTile>
  );
  return (
    <section className="display-window window-auction" data-window="auction" aria-label="المزاد">
      <div className="duel-row">
        {side(auction.bidder, auction.players?.bidder ?? 0)}
        <WinBoxes team={auction.bidder} won={wins(auction, auction.bidder)} />
        <div ref={plot} className="duel-plot-box">
          <AuctionPlot auction={auction} />
        </div>
        <WinBoxes team={auction.defender} won={wins(auction, auction.defender)} />
        {side(auction.defender, auction.players?.defender ?? 0)}
      </div>
      {challenge ? (
        <ChallengeView
          key={`${auction.challenges.indexOf(challenge)}-${challenge.startedAt}`}
          number={auction.challenges.indexOf(challenge) + 1}
          challenge={challenge}
          timer={timer}
          auction={auction}
          live={live}
        />
      ) : null}
    </section>
  );
}

/** Two boxes per side, filled in the side's colour for each challenge it has won. */
function WinBoxes({ team, won }: { team: Team; won: number }) {
  return (
    <span className="duel-boxes" data-team={team} aria-label={`فاز بـ ${formatNumber(won)}`}>
      {[0, 1].map((i) => (
        <span key={i} className="duel-box" data-won={i < won || undefined} />
      ))}
    </span>
  );
}

const PLOT_UNIT = 58;
const BLOCK = 0.62;

/** The plot at stake, a building in its owner's colours with the bidder's pin over it, as on the map. */
function AuctionPlot({ auction }: { auction: Auction }) {
  const owner = auction.winner ?? auction.defender;
  const team = tokens.team[owner];
  const s = PLOT_UNIT;
  const plate = box([-0.2, -0.2, 1.2, 1.2], -0.16, 0, 0.3, s, 1, MAP_VIEW);
  const block = box([0.1, 0.1, 0.9, 0.9], 0, BLOCK, 0.14, s, 1, MAP_VIEW);
  const [x, y] = project(0.5, 0.5, BLOCK, s, 1, MAP_VIEW);
  return (
    <svg className="duel-plot" viewBox="-58 -96 116 144" aria-hidden="true" focusable="false">
      <Box shape={plate} palette={tones(tokens.map.day.plate)} />
      <Box shape={block} palette={[team.main, team.side, team.side2]} />
      <path d={TEAM_PATHS[owner]} transform={decal(0.5, 0.5, BLOCK, 0.46, s, 1, MAP_VIEW)} fill={tokens.color.ink} />
      {auction.status === 'open' ? <Pin x={x} y={y} team={auction.bidder} radius={21} stick={24} /> : null}
    </svg>
  );
}

type ViewProps = { number: number; challenge: Challenge; timer: Running | null; auction: Auction; live: boolean };

/**
 * One challenge: its number and name, the timer while it runs, and its content. When the time is up, or
 * once the referee names the winner, its answer shows. A new challenge (or a tie played again) comes in.
 */
function ChallengeView({ number, challenge, timer, auction, live }: ViewProps) {
  const { content } = challenge;
  const running = !challenge.stopped && !challenge.winner;
  const element = useRef<HTMLDivElement>(null);
  const came = useRef(live);
  useLayoutEffect(() => {
    if (came.current) motion(element.current, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420 });
  }, []);
  return (
    <div ref={element} className="challenge" data-type={content.type} data-running={running || undefined}>
      <header className="challenge-head">
        <div className="challenge-title">
          <span className="challenge-number">التحدي {formatNumber(number)}</span>
          <h2 className="challenge-type">{CHALLENGE_NAMES[content.type]}</h2>
        </div>
        {running && timer ? <Timer startedAt={timer.startedAt} seconds={timer.seconds} size={84} /> : null}
      </header>
      <ChallengeBody content={content} challenge={challenge} running={running} auction={auction} live={live} />
    </div>
  );
}

type BodyProps = { content: ChallengeContent; challenge: Challenge; running: boolean; auction: Auction; live: boolean };

function ChallengeBody({ content, challenge, running, auction, live }: BodyProps) {
  switch (content.type) {
    case 'math':
      return <MathChain content={content} startedAt={challenge.startedAt} running={running} live={live} />;
    case 'spelling': {
      const word = SPELLING.find((w) => w.id === content.id)?.word ?? '';
      return running ? (
        <WriteNow text="اكتبوا الكلمة" />
      ) : (
        <Appear live={live} pop>
          <p className="challenge-answer">{word}</p>
        </Appear>
      );
    }
    case 'ordering': {
      const words = sentenceWords(ORDERING.find((s) => s.id === content.id)?.sentence ?? '');
      // While it runs, the words in their scrambled order; then the sentence in its right order.
      const order = running ? content.order : words.map((_, i) => i);
      return <OrderWords words={words} order={order} solved={!running} live={live} />;
    }
    case 'memory':
      return <MemoryItems content={content} startedAt={challenge.startedAt} running={running} done={challenge.winner !== null} live={live} />;
    case 'precision':
      return <p className="challenge-text">{formatNumber(PRECISION_TRIES)} محاولات لكل لاعب</p>;
    case 'building':
      return (
        <div className="cup-towers">
          <CupTower team={auction.bidder} />
          <CupTower team={auction.defender} />
        </div>
      );
  }
}

/** The teams write their answer now: the pencil and what to write. */
function WriteNow({ text, live = false }: { text: string; live?: boolean }) {
  return (
    <Appear live={live}>
      <div className="write-now">
        <Icon name="pencil" size={40} />
        <p>{text}</p>
      </div>
    </Appear>
  );
}

/**
 * D11: the words to put in order, scattered while the challenge runs; then they move to their places in the
 * sentence, each from where it stood.
 */
function OrderWords({ words, order, solved, live }: { words: string[]; order: number[]; solved: boolean; live: boolean }) {
  const list = useRef<HTMLUListElement>(null);
  const places = useRef(new Map<number, DOMRect>());
  useLayoutEffect(() => {
    const items = [...(list.current?.children ?? [])] as HTMLElement[];
    const before = places.current;
    const now = new Map(items.map((item) => [Number(item.dataset.word), item.getBoundingClientRect()]));
    places.current = now;
    if (!live || before.size === 0) return;
    // The stage is scaled to the screen: a move is counted in the stage's own pixels.
    const stage = list.current?.closest('.stage');
    const k = stage ? stage.getBoundingClientRect().width / 1280 : 1;
    for (const item of items) {
      const was = before.get(Number(item.dataset.word));
      const is = now.get(Number(item.dataset.word));
      if (!was || !is || (was.left === is.left && was.top === is.top)) continue;
      const shift = `translate(${(was.left - is.left) / k}px, ${(was.top - is.top) / k}px)`;
      motion(item, [{ transform: shift }, { transform: 'none' }], { duration: 700 });
    }
  }, [solved, live]);
  return (
    <ul ref={list} className="order-words" data-solved={solved || undefined}>
      {order.map((i) => (
        <li key={i} data-word={i}>
          {words[i]}
        </li>
      ))}
    </ul>
  );
}

type MathContent = Extract<ChallengeContent, { type: 'math' }>;

/**
 * D12: the start number, then one step every three seconds, the newest in ink; the question mark once the
 * last step is out. When the time is up, the answer takes its place.
 */
function MathChain({ content, startedAt, running, live }: { content: MathContent; startedAt: number; running: boolean; live: boolean }) {
  const now = useTicking(running);
  const shown = running ? Math.min(content.steps.length, Math.max(0, Math.floor((now - startedAt) / MATH_STEP_TIME))) : content.steps.length;
  const arrow = (
    <span className="math-arrow" aria-hidden="true">
      ←
    </span>
  );
  return (
    <div className="math-chain">
      <span className="math-box">{formatNumber(content.start)}</span>
      {content.steps.slice(0, shown).map((step, i) => (
        <MathStep key={i} live={live}>
          {arrow}
          <span className="math-box" data-new={(running && i === shown - 1) || undefined}>
            {MATH_OPS[step.op]} {formatNumber(step.n)}
          </span>
        </MathStep>
      ))}
      {shown === content.steps.length ? (
        <MathStep live={live}>
          {arrow}
          <span className="math-box math-result" data-answer={!running || undefined}>
            {running ? '؟' : formatNumber(content.answer)}
          </span>
        </MathStep>
      ) : null}
    </div>
  );
}

/** One step of the maths chain, sliding in from the side the chain grows from. */
function MathStep({ live, children }: { live: boolean; children: ReactNode }) {
  const element = useRef<HTMLSpanElement>(null);
  const came = useRef(live);
  useLayoutEffect(() => {
    if (came.current) motion(element.current, [{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 380 });
  }, []);
  return (
    <span ref={element} className="math-step">
      {children}
    </span>
  );
}

type MemoryContent = Extract<ChallengeContent, { type: 'memory' }>;

type MemoryProps = { content: MemoryContent; startedAt: number; running: boolean; done: boolean; live: boolean };

/**
 * D14 and D15: eight pictures or words, for twenty seconds at most; then they hide and the teams write
 * them on the board. Once the referee names the winner they show again, to check.
 */
function MemoryItems({ content, startedAt, running, done, live }: MemoryProps) {
  const now = useTicking(running);
  const visible = done || (running && now - startedAt < TIMER_SECONDS.memory * 1000);
  if (!visible) return <WriteNow text="اكتبوا ما تتذكرونه" live={live} />;
  return (
    <ul className="memory-grid" data-kind={content.kind}>
      {content.items.map((id) => {
        const image = content.kind === 'images' ? MEMORY_IMAGES.find((m) => m.id === id) : undefined;
        return (
          <li key={id}>
            {image ? (
              <span className="memory-picture" role="img" aria-label={image.name} dangerouslySetInnerHTML={{ __html: image.svg }} />
            ) : (
              MEMORY_WORDS.find((m) => m.id === id)?.word
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** D17: each side builds a tower of cups; the picture under its symbol shows what to build. */
function CupTower({ team }: { team: Team }) {
  const rows = [4, 3, 2, 1];
  const w = 40;
  const h = 34;
  const gap = 5;
  const cups = rows.flatMap((count, row) =>
    Array.from({ length: count }, (_, k) => {
      const x = (row * (w + gap)) / 2 + k * (w + gap);
      const y = (rows.length - 1 - row) * (h + gap);
      return `M${x} ${y}h${w}l-5 ${h}h${-(w - 10)}Z`;
    }),
  );
  const width = rows[0]! * (w + gap) - gap;
  const height = rows.length * (h + gap) - gap;
  return (
    <div className="cup-tower">
      <TeamSymbol team={team} size={40} />
      <svg viewBox={`-3 -3 ${width + 6} ${height + 6}`} width={width + 6} height={height + 6} aria-hidden="true" focusable="false">
        <path d={cups.join('')} fill={tokens.color.white} stroke={tokens.team[team].main} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
