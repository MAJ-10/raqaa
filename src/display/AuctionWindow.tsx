import tokens from '../../assets/tokens.json';
import { MEMORY_IMAGES, MEMORY_WORDS, ORDERING, SPELLING, sentenceWords } from '../content/index.ts';
import { TIMER_SECONDS, wins } from '../engine/select.ts';
import type { Auction, Challenge, ChallengeContent, GameState, Team } from '../engine/types.ts';
import { Icon } from '../ui/Icon.tsx';
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

type Props = { state: GameState; auction: Auction; challenge: Challenge | null; timer: Running | null };

/**
 * D11 to D17: the auction over the dimmed game. On top, the two sides with their players' numbers, the
 * plot between them under the bidder's pin, and each side's two win boxes. Under them, the challenge:
 * its number and name, the timer, and what the challenge shows. When a challenge ends its answer shows,
 * and when the auction is won the winner fills and the plot takes its colour.
 */
export function AuctionWindow({ state, auction, challenge, timer }: Props) {
  const names = state.setup.teams;
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
        <AuctionPlot auction={auction} />
        <WinBoxes team={auction.defender} won={wins(auction, auction.defender)} />
        {side(auction.defender, auction.players?.defender ?? 0)}
      </div>
      {challenge ? (
        <ChallengeView number={auction.challenges.indexOf(challenge) + 1} challenge={challenge} timer={timer} auction={auction} />
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

type ViewProps = { number: number; challenge: Challenge; timer: Running | null; auction: Auction };

/**
 * One challenge: its number and name, the timer while it runs, and its content. When the time is up, or
 * once the referee names the winner, its answer shows.
 */
function ChallengeView({ number, challenge, timer, auction }: ViewProps) {
  const { content } = challenge;
  const running = !challenge.stopped && !challenge.winner;
  return (
    <div className="challenge" data-type={content.type} data-running={running || undefined}>
      <header className="challenge-head">
        <div className="challenge-title">
          <span className="challenge-number">التحدي {formatNumber(number)}</span>
          <h2 className="challenge-type">{CHALLENGE_NAMES[content.type]}</h2>
        </div>
        {running && timer ? <Timer startedAt={timer.startedAt} seconds={timer.seconds} size={84} /> : null}
      </header>
      <ChallengeBody content={content} challenge={challenge} running={running} auction={auction} />
    </div>
  );
}

type BodyProps = { content: ChallengeContent; challenge: Challenge; running: boolean; auction: Auction };

function ChallengeBody({ content, challenge, running, auction }: BodyProps) {
  switch (content.type) {
    case 'math':
      return <MathChain content={content} startedAt={challenge.startedAt} running={running} />;
    case 'spelling': {
      const word = SPELLING.find((w) => w.id === content.id)?.word ?? '';
      return running ? <WriteNow text="اكتبوا الكلمة" /> : <p className="challenge-answer">{word}</p>;
    }
    case 'ordering': {
      const words = sentenceWords(ORDERING.find((s) => s.id === content.id)?.sentence ?? '');
      // While it runs, the words in their scrambled order; then the sentence in its right order.
      const order = running ? content.order : words.map((_, i) => i);
      return (
        <ul className="order-words" data-solved={!running || undefined}>
          {order.map((i) => (
            <li key={i}>{words[i]}</li>
          ))}
        </ul>
      );
    }
    case 'memory':
      return <MemoryItems content={content} startedAt={challenge.startedAt} running={running} done={challenge.winner !== null} />;
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
function WriteNow({ text }: { text: string }) {
  return (
    <div className="write-now">
      <Icon name="pencil" size={40} />
      <p>{text}</p>
    </div>
  );
}

type MathContent = Extract<ChallengeContent, { type: 'math' }>;

/**
 * D12: the start number, then one step every three seconds, the newest in ink; the question mark once the
 * last step is out. When the time is up, the answer takes its place.
 */
function MathChain({ content, startedAt, running }: { content: MathContent; startedAt: number; running: boolean }) {
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
        <span key={i} className="math-step">
          {arrow}
          <span className="math-box" data-new={(running && i === shown - 1) || undefined}>
            {MATH_OPS[step.op]} {formatNumber(step.n)}
          </span>
        </span>
      ))}
      {shown === content.steps.length ? (
        <span className="math-step">
          {arrow}
          <span className="math-box math-result" data-answer={!running || undefined}>
            {running ? '؟' : formatNumber(content.answer)}
          </span>
        </span>
      ) : null}
    </div>
  );
}

type MemoryContent = Extract<ChallengeContent, { type: 'memory' }>;

/**
 * D14 and D15: eight pictures or words, for twenty seconds at most; then they hide and the teams write
 * them on the board. Once the referee names the winner they show again, to check.
 */
function MemoryItems({ content, startedAt, running, done }: { content: MemoryContent; startedAt: number; running: boolean; done: boolean }) {
  const now = useTicking(running);
  const visible = done || (running && now - startedAt < TIMER_SECONDS.memory * 1000);
  if (!visible) return <WriteNow text="اكتبوا ما تتذكرونه" />;
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
