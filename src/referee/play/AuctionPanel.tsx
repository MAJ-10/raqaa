import { useState } from 'react';
import { MEMORY_IMAGES, MEMORY_WORDS, ORDERING, SPELLING, sentenceWords, BANKS } from '../../content/index.ts';
import { makeContent, newChallenge } from '../../engine/content.ts';
import { currentChallenge, nextAuction, openAuction, todaysAuctions, wins } from '../../engine/select.ts';
import type { Auction, ChallengeContent, EventInput, GameState, MathOp, Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Icon } from '../../ui/Icon.tsx';
import { Stepper } from '../../ui/fields.tsx';
import { CHALLENGE_NAMES, plotName } from '../../ui/names.ts';
import { formatNumber } from '../../ui/number.ts';
import { TeamBadge, TeamSymbol } from '../../ui/TeamBadge.tsx';
import { Timer } from '../../ui/Timer.tsx';

type Props = { state: GameState; act: (event: EventInput) => void };

const STATUS: Record<Auction['status'], string> = {
  declared: 'معلن',
  open: 'مفتوح',
  done: 'انتهى',
  fenced: 'ألغاه السياج',
  cancelled: 'ألغي',
};

/** R08: today's auctions, played one at a time, challenge by challenge. */
export function AuctionPanel({ state, act }: Props) {
  const names = state.setup.teams;
  const open = openAuction(state);
  const next = nextAuction(state);

  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>المزادات</h2>
      </header>
      <ul className="auction-list">
        {todaysAuctions(state).map((a) => (
          <li key={a.id} className="auction-row" data-status={a.status}>
            <TeamSymbol team={a.bidder} size={24} />
            <Icon name="gavel" size={16} />
            <TeamSymbol team={a.defender} size={24} />
            <span>{plotName(a.plot)}</span>
            <span className="chip">{a.status === 'done' && a.winner ? `فاز ${names[a.winner].name}` : STATUS[a.status]}</span>
          </li>
        ))}
      </ul>
      {state.pending?.kind === 'planTake' ? (
        <p className="panel-text">
          اشتغل مخطط {names[state.pending.team].name}: اختر قطعة من أرض {names[state.pending.from].name} على الخريطة.
        </p>
      ) : open ? (
        <OpenAuction state={state} act={act} auction={open} />
      ) : next ? (
        <footer className="panel-actions">
          <Button variant="primary" onClick={() => act({ type: 'auction/open', auction: next.id })}>
            افتح المزاد
          </Button>
        </footer>
      ) : null}
    </section>
  );
}

function OpenAuction({ state, act, auction }: Props & { auction: Auction }) {
  const names = state.setup.teams;
  // The bank ran out and shown items came back (the oldest first): the referee is told.
  const [recycled, setRecycled] = useState(false);
  const start = () => {
    const made = newChallenge(state, BANKS);
    setRecycled(made.recycled);
    act({ type: 'challenge/start', auction: auction.id, content: made.content });
  };
  const replay = (type: ChallengeContent['type']) => {
    const made = makeContent(state, type, BANKS);
    setRecycled(made.recycled);
    act({ type: 'challenge/replay', auction: auction.id, content: made.content });
  };
  const challenge = currentChallenge(auction);
  const number = auction.challenges.length + (challenge ? 0 : 1);
  const side = (team: Team, player: number) => (
    <div className="auction-side" data-team={team}>
      <TeamBadge team={team} name={names[team].name} size={36} />
      <span>رقم {formatNumber(player)}</span>
      <span className="win-boxes" aria-label={`فاز بـ ${formatNumber(wins(auction, team))}`}>
        {[0, 1].map((i) => (
          <span key={i} className="win-box" data-won={i < wins(auction, team) || undefined} />
        ))}
      </span>
    </div>
  );

  return (
    <>
      <div className="auction-sides">
        {side(auction.bidder, auction.players?.bidder ?? 0)}
        <span className="auction-vs">التحدي {formatNumber(number)}</span>
        {side(auction.defender, auction.players?.defender ?? 0)}
      </div>
      {challenge ? (
        <div className="challenge" key={challenge.startedAt}>
          <header className="panel-head">
            <h3>{CHALLENGE_NAMES[challenge.content.type]}</h3>
            {state.timer ? <Timer startedAt={state.timer.startedAt} /> : null}
          </header>
          <ChallengeDetails content={challenge.content} />
          {recycled ? <p className="panel-warning">خلص هذا البنك، وبدأت عناصره ترجع من الأقدم.</p> : null}
        </div>
      ) : null}
      <footer className="panel-actions">
        {challenge ? (
          <>
            {[auction.bidder, auction.defender].map((team) => (
              <button
                key={team}
                type="button"
                className="button win-button"
                data-team={team}
                onClick={() => act({ type: 'challenge/result', auction: auction.id, winner: team })}
              >
                <TeamSymbol team={team} size={22} />
                فاز {names[team].name}
              </button>
            ))}
            <Button icon="swap" onClick={() => replay(challenge.content.type)}>
              تبديل
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={start}>
            ابدأ التحدي
          </Button>
        )}
      </footer>
    </>
  );
}

const OPS: Record<MathOp, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** What the referee needs to run the challenge: the answer to check against. */
function ChallengeDetails({ content }: { content: ChallengeContent }) {
  const [hits, setHits] = useState<[number, number]>([0, 0]);
  switch (content.type) {
    case 'math':
      return (
        <p className="challenge-main">
          {formatNumber(content.start)} {content.steps.map((s) => `${OPS[s.op]} ${formatNumber(s.n)}`).join(' ')} ={' '}
          <strong>{formatNumber(content.answer)}</strong>
        </p>
      );
    case 'spelling':
      return <p className="challenge-main">{SPELLING.find((w) => w.id === content.id)?.word}</p>;
    case 'ordering': {
      const sentence = ORDERING.find((s) => s.id === content.id)?.sentence ?? '';
      const words = sentenceWords(sentence);
      return (
        <>
          <p className="challenge-main">{sentence}</p>
          <p className="challenge-note">على الشاشة: {content.order.map((i) => words[i]).join(' / ')}</p>
        </>
      );
    }
    case 'memory': {
      const names =
        content.kind === 'images'
          ? content.items.map((id) => MEMORY_IMAGES.find((m) => m.id === id)?.name)
          : content.items.map((id) => MEMORY_WORDS.find((m) => m.id === id)?.word);
      return (
        <>
          <p className="challenge-note">{content.kind === 'images' ? 'صور' : 'كلمات'}</p>
          <p className="challenge-main">{names.join('، ')}</p>
        </>
      );
    }
    case 'precision':
      // Hit counters help the referee keep count; the referee still presses the winner.
      return (
        <div className="hit-counters">
          {[0, 1].map((i) => (
            <Stepper
              key={i}
              label={i === 0 ? 'إصابات المزايد' : 'إصابات صاحب الأرض'}
              value={hits[i]!}
              min={0}
              max={3}
              onChange={(v) => setHits((h) => (i === 0 ? [v, h[1]] : [h[0], v]))}
            />
          ))}
        </div>
      );
    case 'building':
      return null;
  }
}
