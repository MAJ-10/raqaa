import { useState, type ReactNode } from 'react';
import { MEMORY_IMAGES, MEMORY_WORDS, ORDERING, SPELLING, sentenceWords, BANKS } from '../../content/index.ts';
import { makeContent, newChallenge, type MadeContent } from '../../engine/content.ts';
import { currentChallenge, nextAuction, openAuction, TIMER_SECONDS, timerSeconds, todaysAuctions, wins } from '../../engine/select.ts';
import type { Auction, Challenge, ChallengeContent, EventInput, GameState, Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { Stepper } from '../../ui/fields.tsx';
import { CHALLENGE_HINTS, CHALLENGE_NAMES, MATH_OPS, plotName } from '../../ui/names.ts';
import { formatNumber } from '../../ui/number.ts';
import { TeamName, TeamSymbol } from '../../ui/TeamBadge.tsx';
import { TeamTile, TeamTileButton } from '../../ui/TeamTile.tsx';
import { Timer } from '../../ui/Timer.tsx';
import { Decision } from './Decision.tsx';

type Props = { state: GameState; act: (event: EventInput) => void };

const STATUS: Record<Auction['status'], string> = {
  declared: 'معلن',
  open: 'مفتوح',
  done: 'انتهى',
  fenced: 'ألغاه السياج',
  cancelled: 'أُلغي',
};

/** R08: today's auctions, played one at a time, challenge by challenge. */
export function AuctionsBody({ state, act }: Props) {
  const names = state.setup.teams;
  const open = openAuction(state);
  const next = nextAuction(state);

  return (
    <>
      <ul className="auction-list">
        {todaysAuctions(state).map((a) => (
          <li key={a.id} className="auction-row" data-status={a.status}>
            <TeamSymbol team={a.bidder} size={22} />
            <Icon name="gavel" size={16} />
            <TeamSymbol team={a.defender} size={22} />
            <span className="auction-plot">{plotName(a.plot)}</span>
            <span className="auction-status">
              {a.status === 'done' && a.winner ? `فاز ${names[a.winner].name}` : STATUS[a.status]}
            </span>
          </li>
        ))}
      </ul>
      {state.pending?.kind === 'planTake' ? (
        <Decision card="plan" title="المخطط السري">
          تفعّل مخطط <TeamName team={state.pending.team} name={names[state.pending.team].name} />: اختر قطعة من أرض{' '}
          <TeamName team={state.pending.from} name={names[state.pending.from].name} /> على الخريطة.
        </Decision>
      ) : open ? (
        <OpenAuction state={state} act={act} auction={open} />
      ) : next ? (
        <div className="step-actions">
          <Button variant="primary" icon="gavel" onClick={() => act({ type: 'auction/open', auction: next.id })}>
            افتح المزاد
          </Button>
        </div>
      ) : null}
    </>
  );
}

type AuctionProps = Props & { auction: Auction };

/**
 * The open auction in sections: the two sides, the challenge and what it is, what the display shows (with
 * the timer), and the answer to check against. Sections come and go with the challenge's type.
 */
function OpenAuction({ state, act, auction }: AuctionProps) {
  const challenge = currentChallenge(auction);
  const number = auction.challenges.length + (challenge ? 0 : 1);
  // The sides stay in place from one challenge to the next; the next challenge is drawn as soon as its
  // turn comes, so the referee knows it before starting it.
  return (
    <>
      <Duel state={state} auction={auction} number={number} />
      {challenge ? (
        <RunningChallenge state={state} act={act} auction={auction} challenge={challenge} />
      ) : (
        <NextChallenge key={`${auction.id}-${number}`} state={state} act={act} auction={auction} />
      )}
    </>
  );
}

/**
 * The two sides as team tiles: each player's number on the team's colour, like a shirt, the team and its
 * part in the auction, and the challenges it has won.
 */
function Duel({ state, auction, number }: { state: GameState; auction: Auction; number: number }) {
  const names = state.setup.teams;
  const sides: [Team, number, string][] = [
    [auction.bidder, auction.players?.bidder ?? 0, 'يزايد'],
    [auction.defender, auction.players?.defender ?? 0, 'يدافع'],
  ];
  return (
    <section className="duel" aria-label="المتنافسان">
      <h4 className="section-label">التحدي {formatNumber(number)}</h4>
      {sides.map(([team, player, part]) => (
        <TeamTile key={team} team={team} height={56} mark={<span className="team-tile-number">{formatNumber(player)}</span>}>
          <span className="duel-text">
            <span className="team-tile-name">{names[team].name}</span>
            <span className="duel-part">{part}</span>
          </span>
          <span className="win-boxes" aria-label={`فاز بـ ${formatNumber(wins(auction, team))}`}>
            {[0, 1].map((i) => (
              <span key={i} className="win-box" data-won={i < wins(auction, team) || undefined} />
            ))}
          </span>
        </TeamTile>
      ))}
    </section>
  );
}

function NextChallenge({ state, act, auction }: AuctionProps) {
  const [made, setMade] = useState<MadeContent>(() => newChallenge(state, BANKS));
  const seconds = made.content.type === 'memory' ? TIMER_SECONDS.memory : TIMER_SECONDS.challenge;
  // Before it starts, the referee can swap the drawn content for other content of the same type.
  const swap = () => setMade(otherContent(state, made.content));
  return (
    <>
      <ChallengeSections
        key={JSON.stringify(made.content)}
        content={made.content}
        sides={[auction.bidder, auction.defender]}
        state={state}
        recycled={made.recycled}
        clock={<span className="timer-length">{formatNumber(seconds)} ثانية</span>}
      />
      <div className="win-actions auction-actions">
        <Button icon="swap" onClick={swap}>
          تبديل
        </Button>
        <Button
          variant="primary"
          icon="play"
          onClick={() => act({ type: 'challenge/start', auction: auction.id, content: made.content })}
        >
          ابدأ التحدي
        </Button>
      </div>
    </>
  );
}

/** New content of the same type, other than this one when the bank allows it. */
function otherContent(state: GameState, content: ChallengeContent): MadeContent {
  let made = makeContent(state, content.type, BANKS);
  for (let tries = 0; tries < 6 && JSON.stringify(made.content) === JSON.stringify(content); tries++) {
    made = makeContent(state, content.type, BANKS);
  }
  return made;
}

function RunningChallenge({ state, act, auction, challenge }: AuctionProps & { challenge: Challenge }) {
  const names = state.setup.teams;
  const seconds = timerSeconds(state);
  // The bank ran out and shown items came back (the oldest first): the referee is told.
  const [recycled, setRecycled] = useState(false);
  const replay = () => {
    const made = makeContent(state, challenge.content.type, BANKS);
    setRecycled(made.recycled);
    act({ type: 'challenge/replay', auction: auction.id, content: made.content });
  };

  return (
    <>
      <ChallengeSections
        key={challenge.startedAt}
        content={challenge.content}
        sides={[auction.bidder, auction.defender]}
        state={state}
        recycled={recycled}
        clock={
          state.timer && seconds ? (
            <Timer startedAt={state.timer.startedAt} seconds={seconds} size={44} />
          ) : (
            <span className="timer-length">انتهى الوقت</span>
          )
        }
      />
      <div className="win-actions auction-actions">
        {/* For a tie: the same type again, with new content. */}
        <Button icon="swap" onClick={replay}>
          تبديل
        </Button>
        <div className="win-buttons">
          {[auction.bidder, auction.defender].map((team) => (
            <TeamTileButton
              key={team}
              team={team}
              height={52}
              className="win-button"
              aria-label={`فاز ${names[team].name}`}
              onClick={() => act({ type: 'challenge/result', auction: auction.id, winner: team })}
            >
              <span className="team-tile-name">{names[team].name}</span>
            </TeamTileButton>
          ))}
        </div>
      </div>
    </>
  );
}

type SectionsProps = {
  content: ChallengeContent;
  sides: [Team, Team];
  state: GameState;
  recycled: boolean;
  /** The timer while it runs, or how long it will run. */
  clock: ReactNode;
};

/**
 * The challenge as the referee runs it, in sections: its name and what it is; what the display shows,
 * with the clock; and the answer. Each type keeps only the sections it needs.
 */
function ChallengeSections({ content, sides, state, recycled, clock }: SectionsProps) {
  const [hits, setHits] = useState<[number, number]>([0, 0]);
  const shown = (label: string, body: ReactNode) => (
    <Section label={label} clock={clock}>
      {body}
    </Section>
  );

  let screen: ReactNode = null;
  let answer: ReactNode = null;
  switch (content.type) {
    case 'math':
      screen = shown(
        'على الشاشة',
        <ol className="math-steps">
          <li>{formatNumber(content.start)}</li>
          {content.steps.map((s, i) => (
            <li key={i}>
              {MATH_OPS[s.op]} {formatNumber(s.n)}
            </li>
          ))}
        </ol>,
      );
      answer = <p className="section-answer">{formatNumber(content.answer)}</p>;
      break;
    case 'spelling':
      screen = shown('اقرأ الكلمة بصوتك', <p className="section-answer">{SPELLING.find((w) => w.id === content.id)?.word}</p>);
      break;
    case 'ordering': {
      const sentence = ORDERING.find((s) => s.id === content.id)?.sentence ?? '';
      const words = sentenceWords(sentence);
      screen = shown(
        'على الشاشة',
        <ul className="word-chips">
          {content.order.map((i) => (
            <li key={i}>{words[i]}</li>
          ))}
        </ul>,
      );
      answer = <p className="section-answer">{sentence}</p>;
      break;
    }
    case 'memory':
      // The display hides the items when the time is up; the teams write them on the board.
      screen = shown(
        'على الشاشة ثم تختفي',
        <ul className="memory-items" data-kind={content.kind}>
          {content.items.map((id) => {
            const image = content.kind === 'images' ? MEMORY_IMAGES.find((m) => m.id === id) : undefined;
            const word = content.kind === 'words' ? MEMORY_WORDS.find((m) => m.id === id)?.word : undefined;
            return (
              <li key={id}>
                {image ? <span className="memory-image" aria-hidden="true" dangerouslySetInnerHTML={{ __html: image.svg }} /> : null}
                <span>{image?.name ?? word}</span>
              </li>
            );
          })}
        </ul>,
      );
      break;
    case 'precision':
      // Hit counters help the referee keep count, out of three each; the referee still presses the winner.
      screen = shown(
        'الإصابات',
        <div className="hit-counters">
          {sides.map((team, i) => (
            <TeamTile key={team} team={team} height={52}>
              <span className="team-tile-name">{state.setup.teams[team].name}</span>
              <Stepper
                label={`إصابات ${state.setup.teams[team].name}`}
                value={hits[i]!}
                min={0}
                max={3}
                onChange={(v) => setHits((h) => (i === 0 ? [v, h[1]] : [h[0], v]))}
              />
            </TeamTile>
          ))}
        </div>,
      );
      break;
    case 'building':
      screen = shown('على الشاشة', <p className="section-text">المؤقت فقط</p>);
      break;
  }

  return (
    <>
      <section className="auction-section challenge" aria-label="التحدي">
        <h3 className="challenge-name">{CHALLENGE_NAMES[content.type]}</h3>
        <p className="challenge-hint">{CHALLENGE_HINTS[content.type]}</p>
      </section>
      {screen}
      {answer ? <Section label="الإجابة">{answer}</Section> : null}
      {recycled ? <p className="step-note">انتهى محتوى هذا البنك، وبدأت عناصره تتكرر من الأقدم.</p> : null}
    </>
  );
}

/** One section of the auction: a small label (with the clock where the display shows something), then its body. */
function Section({ label, clock, children }: { label: string; clock?: ReactNode; children: ReactNode }) {
  return (
    <section className="auction-section" aria-label={label}>
      <header className="section-head">
        <h4 className="section-label">{label}</h4>
        {clock}
      </header>
      {children}
    </section>
  );
}
