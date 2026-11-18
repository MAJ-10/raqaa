import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import tokens from '../../assets/tokens.json';
import { MEMORY_IMAGES, MEMORY_WORDS, ORDERING, SPELLING, sentenceWords } from '../content/index.ts';
import { wins } from '../engine/select.ts';
import { challengeClock } from '../engine/timing.ts';
import type { Auction, Challenge, ChallengeContent, ChallengeType, GameState, Team } from '../engine/types.ts';
import { Icon } from '../ui/Icon.tsx';
import { EASE_BOUNCE, EASE_OUT, motion, reducedMotion } from '../ui/motion.ts';
import { CHALLENGE_NAMES, CHALLENGE_RULES, MATH_OPS } from '../ui/names.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamGlyph } from '../ui/TeamBadge.tsx';
import { TeamTile } from '../ui/TeamTile.tsx';
import { TEAM_PATHS } from '../ui/team-paths.ts';
import { Timer } from '../ui/Timer.tsx';
import { tones } from './board-art.ts';
import { box, decal, MAP_VIEW, project } from './iso.ts';
import { Countdown } from './Countdown.tsx';
import { Box } from './IsoMap.tsx';
import { Pin } from './Pin.tsx';
import { useCountdown, useTicking } from './use-clock.ts';
import { WON_AT } from './windows.ts';

type Props = { state: GameState; auction: Auction; challenge: Challenge | null; live: boolean };

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
 * D11 to D16: the auction over the dimmed game. On top, the two sides with their players' numbers, the
 * plot between them under the bidder's pin, and each side's two win boxes. Under them, the challenge the
 * referee picked and what it is; once started, the countdown, then its number and name, its clock and
 * what it shows. When a challenge ends its answer shows. When the auction is won, the winner fills and
 * the plot takes its colour with a pulse; the last challenge stays a moment, then gives way to the
 * winner's celebration.
 */
export function AuctionWindow({ state, auction, challenge, live }: Props) {
  const names = state.setup.teams;
  const plot = useRef<HTMLDivElement>(null);
  const won = auction.status === 'done' && auction.winner !== null;
  // A display that reopens on a won auction shows the celebration at once.
  const [celebrating, setCelebrating] = useState(won);
  useEffect(() => {
    if (!won || celebrating) return;
    const id = setTimeout(() => setCelebrating(true), reducedMotion() ? 0 : WON_AT);
    return () => clearTimeout(id);
  }, [won, celebrating]);
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
      {won && celebrating ? (
        <AuctionWon winner={auction.winner!} name={names[auction.winner!].name} bought={auction.winner === auction.bidder} live={live} />
      ) : challenge ? (
        <ChallengeView
          key={`${auction.challenges.indexOf(challenge)}-${challenge.startedAt}`}
          number={auction.challenges.indexOf(challenge) + 1}
          challenge={challenge}
          live={live}
        />
      ) : auction.picked ? (
        <ChallengeIntro key={auction.picked} type={auction.picked} number={auction.challenges.length + 1} live={live} />
      ) : null}
    </section>
  );
}

/** The pieces that burst from the winner's medal: their angle (degrees), how far they fly, and their colour. */
const BURST: [angle: number, reach: number, colour: 'team' | 'crown' | 'side'][] = Array.from({ length: 18 }, (_, i) => [
  i * 20 + (i % 2) * 7,
  150 + (i % 3) * 38,
  (['team', 'crown', 'side'] as const)[i % 3]!,
]);

/**
 * The winner of the auction, celebrated: its medal (its colour and symbol, the crown over it) with a
 * burst around it, «فاز» and its name, and what it won: the plot bought, or its land kept.
 */
function AuctionWon({ winner, name, bought, live }: { winner: Team; name: string; bought: boolean; live: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const came = useRef(live);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node || !came.current) return;
    motion(node, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 420 });
    motion(node.querySelector('.won-medal'), [{ transform: 'scale(0.3)' }, { transform: 'none' }], { duration: 620, easing: EASE_BOUNCE, fill: 'backwards' });
    motion(node.querySelector('.won-crown'), [{ opacity: 0, transform: 'translateY(-50px) rotate(-14deg)' }, { opacity: 1, transform: 'none' }], {
      duration: 640,
      delay: 260,
      easing: EASE_BOUNCE,
      fill: 'backwards',
    });
    node.querySelectorAll<HTMLElement>('.won-piece').forEach((piece, i) => {
      const [angle, reach] = BURST[i]!;
      const x = Math.cos((angle * Math.PI) / 180) * reach;
      const y = Math.sin((angle * Math.PI) / 180) * reach * 0.62;
      motion(
        piece,
        [
          { opacity: 1, transform: `translate(-50%, -50%) rotate(${angle}deg) scale(0.4)` },
          { opacity: 1, transform: `translate(calc(-50% + ${x * 0.7}px), calc(-50% + ${y * 0.7}px)) rotate(${angle + 120}deg)`, offset: 0.55 },
          { opacity: 0, transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y + 40}px)) rotate(${angle + 200}deg)` },
        ],
        { duration: 1300, delay: 120 + (i % 4) * 30, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' },
      );
    });
    node.querySelectorAll('.won-words > *').forEach((line, i) => {
      motion(line, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 380 + i * 140, fill: 'backwards' });
    });
  }, []);
  return (
    <div ref={box} className="auction-won" data-team={winner} role="status">
      <div className="won-medal-box" aria-hidden="true">
        {live ? (
          <span className="won-burst">
            {BURST.map(([, , colour], i) => (
              <i key={i} className="won-piece" data-colour={colour} />
            ))}
          </span>
        ) : null}
        <span className="won-crown">
          <Icon name="crown" size={56} />
        </span>
        <span className="won-medal">
          <TeamGlyph team={winner} />
        </span>
      </div>
      <div className="won-words">
        <h2>فاز {name}</h2>
        <p>{bought ? 'واشترى القطعة' : 'ودافع عن أرضه'}</p>
      </div>
    </div>
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

/**
 * D11 before a challenge starts: the challenge the referee picked, and what it is, so the teams know what
 * comes before the countdown starts.
 */
function ChallengeIntro({ type, number, live }: { type: ChallengeType; number: number; live: boolean }) {
  const element = useComeIn(live);
  return (
    <div ref={element} className="challenge challenge-intro">
      <header className="challenge-title">
        <span className="challenge-number">التحدي {formatNumber(number)}</span>
        <h2 className="challenge-type">{CHALLENGE_NAMES[type]}</h2>
      </header>
      <p className="challenge-rules">{CHALLENGE_RULES[type]}</p>
    </div>
  );
}

/** A challenge's part of the window comes up into place when the moment brings it; not when the display reopens. */
function useComeIn(live: boolean) {
  const element = useRef<HTMLDivElement>(null);
  const came = useRef(live);
  useLayoutEffect(() => {
    if (came.current) motion(element.current, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420 });
  }, []);
  return element;
}

type ViewProps = { number: number; challenge: Challenge; live: boolean };

/**
 * One challenge: its number and name; the countdown, with what the challenge is; then its clock and its
 * content. When a side answers right or the time is up, its answer shows. A tie played again comes in anew.
 */
function ChallengeView({ number, challenge, live }: ViewProps) {
  const { content } = challenge;
  const running = !challenge.stopped && !challenge.winner;
  const left = useCountdown(running ? challenge.startedAt : null);
  // Memory changes its clock halfway, from showing to writing.
  const now = useTicking(running && content.type === 'memory');
  const clock = challengeClock(content.type, challenge.startedAt, now);
  const element = useComeIn(live);
  return (
    <div ref={element} className="challenge" data-type={content.type} data-running={running || undefined}>
      <header className="challenge-head">
        <div className="challenge-title">
          <span className="challenge-number">التحدي {formatNumber(number)}</span>
          <h2 className="challenge-type">{CHALLENGE_NAMES[content.type]}</h2>
        </div>
        {running && left === 0 ? <Timer key={clock.startedAt} startedAt={clock.startedAt} seconds={clock.seconds} size={84} /> : null}
      </header>
      {left > 0 ? (
        <div className="challenge-ready">
          <Countdown left={left} live={live} />
          <p className="challenge-rules">{CHALLENGE_RULES[content.type]}</p>
        </div>
      ) : (
        <ChallengeBody content={content} running={running} writing={clock.writing} live={live} />
      )}
    </div>
  );
}

type BodyProps = { content: ChallengeContent; running: boolean; writing: boolean; live: boolean };

/** What a challenge shows: its question while it runs, then its answer. */
function ChallengeBody({ content, running, writing, live }: BodyProps) {
  switch (content.type) {
    case 'math':
      return <MathChain content={content} running={running} live={live} />;
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
      // The items while the teams learn them; hidden while they write; then shown again, to check.
      return running && writing ? <WriteNow text="اكتبوا ما تتذكرونه" live={live} /> : <MemoryItems content={content} />;
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

/** How far apart the maths steps come in, so the chain builds before the eyes without making anyone wait. */
const MATH_STEP_IN = 140;

/**
 * D12: the start number and every step at once, as the question shows, each coming in just after the one
 * before; then the question mark. When the challenge ends, the answer takes its place.
 */
function MathChain({ content, running, live }: { content: MathContent; running: boolean; live: boolean }) {
  const arrow = (
    <span className="math-arrow" aria-hidden="true">
      ←
    </span>
  );
  return (
    <div className="math-chain">
      <span className="math-box">{formatNumber(content.start)}</span>
      {content.steps.map((step, i) => (
        <MathStep key={i} live={live} order={i}>
          {arrow}
          <span className="math-box">
            {MATH_OPS[step.op]} {formatNumber(step.n)}
          </span>
        </MathStep>
      ))}
      <MathStep live={live} order={content.steps.length}>
        {arrow}
        <span className="math-box math-result" data-answer={!running || undefined}>
          {running ? '؟' : formatNumber(content.answer)}
        </span>
      </MathStep>
    </div>
  );
}

/** One step of the maths chain, sliding in from the side the chain grows from, its `order` in line. */
function MathStep({ live, order, children }: { live: boolean; order: number; children: ReactNode }) {
  const element = useRef<HTMLSpanElement>(null);
  const came = useRef(live);
  useLayoutEffect(() => {
    if (!came.current) return;
    motion(element.current, [{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], {
      duration: 380,
      delay: (order + 1) * MATH_STEP_IN,
      fill: 'backwards',
    });
  }, [order]);
  return (
    <span ref={element} className="math-step">
      {children}
    </span>
  );
}

type MemoryContent = Extract<ChallengeContent, { type: 'memory' }>;

/** D14 and D15: the eight pictures or words, while the teams learn them, and again once the challenge ends, to check. */
function MemoryItems({ content }: { content: MemoryContent }) {
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
