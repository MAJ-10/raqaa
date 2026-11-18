import { useState, type ReactNode } from 'react';
import { MEMORY_IMAGES, MEMORY_WORDS, ORDERING, SPELLING, sentenceWords, BANKS } from '../../content/index.ts';
import { makeContent, type MadeContent } from '../../engine/content.ts';
import { currentChallenge, nextAuction, openAuction, timerSeconds, todaysAuctions, wins } from '../../engine/select.ts';
import { challengeSeconds } from '../../engine/timing.ts';
import { CHALLENGES, type Auction, type Challenge, type ChallengeContent, type ChallengeType, type EventInput, type GameState, type Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { Segmented } from '../../ui/fields.tsx';
import { CHALLENGE_NAMES, CHALLENGE_RULES, countOf, MATH_OPS, plotName, SECOND_NOUN } from '../../ui/names.ts';
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

/** The challenges the referee chooses from. */
const TYPES = CHALLENGES.map((type) => ({ value: type, label: CHALLENGE_NAMES[type] }));

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
 * The open auction: the two sides, then its challenge. The referee picks each challenge and the display
 * shows what it is; «ابدأ التحدي» counts down to it on the display, and its content shows. When a side
 * answers right the referee names it; when no side does, the answer shows («عرض الإجابة», or the time is
 * up), and «تعادل» plays the next question at once.
 */
function OpenAuction({ state, act, auction }: AuctionProps) {
  const challenge = currentChallenge(auction);
  // The challenge's place in the auction; a tie played again keeps its place.
  const number = auction.challenges.length + (challenge ? 0 : 1);
  return (
    <>
      <Duel state={state} auction={auction} />
      {challenge ? (
        <PlayedChallenge key={number} state={state} act={act} auction={auction} challenge={challenge} number={number} />
      ) : (
        <NextChallenge state={state} act={act} auction={auction} number={number} />
      )}
    </>
  );
}

/**
 * The two sides as team tiles: each player's number on the team's colour, like a shirt, the team and its
 * part in the auction, and the challenges it has won.
 */
function Duel({ state, auction }: { state: GameState; auction: Auction }) {
  const names = state.setup.teams;
  const sides: [Team, number, string][] = [
    [auction.bidder, auction.players?.bidder ?? 0, 'يزايد'],
    [auction.defender, auction.players?.defender ?? 0, 'يدافع'],
  ];
  return (
    <section className="duel" aria-label="المتنافسان">
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

/** Which challenge of the auction this is: the first, the second... */
type ChallengeProps = AuctionProps & { number: number };

/**
 * The challenge's card: its name and number, or «اختر التحدي» over the four challenges while the referee
 * picks; then what it is, which stays while it is played.
 */
function ChallengeHead({ number, type, choose }: { number: number; type: ChallengeType | null; choose?: (type: ChallengeType) => void }) {
  return (
    <section className="auction-section" aria-label="التحدي">
      <header className="section-head">
        <h3 className="challenge-name">{choose || !type ? 'اختر التحدي' : CHALLENGE_NAMES[type]}</h3>
        <span className="section-label">التحدي {formatNumber(number)}</span>
      </header>
      {choose ? <Segmented label="التحدي" options={TYPES} value={type} onChange={choose} cards /> : null}
      {type ? <p className="challenge-hint">{CHALLENGE_RULES[type]}</p> : null}
    </section>
  );
}

/** Before a challenge: the referee picks it, and the display shows it with what it is. */
function NextChallenge({ state, act, auction, number }: ChallengeProps) {
  const picked = auction.picked;
  return (
    <>
      <ChallengeHead number={number} type={picked} choose={(type) => act({ type: 'challenge/pick', auction: auction.id, challenge: type })} />
      {picked ? <PickedChallenge key={picked} state={state} act={act} auction={auction} type={picked} /> : null}
    </>
  );
}

/**
 * The challenge picked, drawn for the referee to see before it starts: «تبديل» draws other content of the
 * same type, and «ابدأ التحدي» starts it.
 */
function PickedChallenge({ state, act, auction, type }: AuctionProps & { type: ChallengeType }) {
  const [made, setMade] = useState<MadeContent>(() => makeContent(state, type, BANKS));
  return (
    <>
      <ChallengeSections content={made.content} recycled={made.recycled} clock={<span className="timer-length">{countOf(challengeSeconds(type), SECOND_NOUN)}</span>} />
      <div className="win-actions auction-actions">
        <Button icon="swap" onClick={() => setMade(otherContent(state, made.content))}>
          تبديل
        </Button>
        <Button variant="primary" icon="play" onClick={() => act({ type: 'challenge/start', auction: auction.id, content: made.content })}>
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

/**
 * The challenge being played. While it runs, the referee names the side that answers right, or shows the
 * answer when none does. Once the answer shows, a side can still be named (memory is counted then); or it
 * is a tie, and «تعادل» plays the next question: of the type beside it, the same one unless the referee
 * chooses another. Both stay in the buttons' row, in sight on any screen.
 */
function PlayedChallenge({ state, act, auction, challenge, number }: ChallengeProps & { challenge: Challenge }) {
  const names = state.setup.teams;
  const seconds = timerSeconds(state);
  const [next, setNext] = useState<ChallengeType>(challenge.content.type);
  // The bank ran out and shown items came back (the oldest first): the referee is told.
  const [recycled, setRecycled] = useState(false);
  const tie = () => {
    const made = makeContent(state, next, BANKS);
    setRecycled(made.recycled);
    act({ type: 'challenge/replay', auction: auction.id, content: made.content });
  };

  return (
    <>
      <ChallengeHead number={number} type={challenge.content.type} />
      <ChallengeSections
        key={challenge.startedAt}
        content={challenge.content}
        recycled={recycled}
        clock={
          state.timer && seconds ? <Timer startedAt={state.timer.startedAt} seconds={seconds} size={44} /> : <span className="timer-length">انتهى</span>
        }
      />
      <div className="win-actions auction-actions">
        {challenge.stopped ? (
          <div className="tie-row">
            <Button icon="swap" onClick={tie}>
              تعادل
            </Button>
            <select className="tie-type" aria-label="التحدي عند التعادل" value={next} onChange={(e) => setNext(e.target.value as ChallengeType)}>
              {TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Button icon="eye" onClick={() => act({ type: 'timer/end' })}>
            عرض الإجابة
          </Button>
        )}
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
  recycled: boolean;
  /** The timer while it runs, or how long it will run. */
  clock: ReactNode;
};

/**
 * The challenge's content as the referee runs it: what the display shows, with the clock, and the answer
 * to check against. Each type keeps only the sections it needs.
 */
function ChallengeSections({ content, recycled, clock }: SectionsProps) {
  let screen: ReactNode = null;
  let answer: ReactNode = null;
  switch (content.type) {
    case 'math':
      screen = (
        <ol className="math-steps">
          <li>{formatNumber(content.start)}</li>
          {content.steps.map((s, i) => (
            <li key={i}>
              {MATH_OPS[s.op]} {formatNumber(s.n)}
            </li>
          ))}
        </ol>
      );
      answer = <p className="section-answer">{formatNumber(content.answer)}</p>;
      break;
    case 'spelling':
      screen = <p className="section-answer">{SPELLING.find((w) => w.id === content.id)?.word}</p>;
      break;
    case 'ordering': {
      const sentence = ORDERING.find((s) => s.id === content.id)?.sentence ?? '';
      const words = sentenceWords(sentence);
      screen = (
        <ul className="word-chips">
          {content.order.map((i) => (
            <li key={i}>{words[i]}</li>
          ))}
        </ul>
      );
      answer = <p className="section-answer">{sentence}</p>;
      break;
    }
    case 'memory':
      // The display hides the items while the teams write them on the board, then shows them again.
      screen = (
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
        </ul>
      );
      break;
  }

  return (
    <>
      <Section label={content.type === 'spelling' ? 'اقرأ الكلمة بصوتك' : content.type === 'memory' ? 'على الشاشة ثم تختفي' : 'على الشاشة'} clock={clock}>
        {screen}
      </Section>
      {answer ? <Section label="الإجابة">{answer}</Section> : null}
      {recycled ? <p className="note">انتهى محتوى هذا البنك، وبدأت عناصره تتكرر من الأقدم.</p> : null}
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
