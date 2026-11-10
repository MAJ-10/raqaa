import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { canChooseKind } from '../../engine/select.ts';
import type { EventInput, GameEvent, GameState, PlotId, Step, Team } from '../../engine/types.ts';
import { Icon } from '../../ui/Icon.tsx';
import { animate } from '../../ui/motion.ts';
import { AUCTION_NOUN, BUILDING_NOUN, countOf, KIND_NAMES } from '../../ui/names.ts';
import { TeamSymbol } from '../../ui/TeamBadge.tsx';
import { AuctionsBody } from './AuctionPanel.tsx';
import { BuildBody } from './BuildPanel.tsx';
import { DayEndBody } from './EndPanels.tsx';
import { PermitsBody, RequestBody } from './QuestionPanels.tsx';

type Props = {
  state: GameState;
  act: (event: EventInput) => void;
  /** Today's events, for the one-line summaries of the steps already done. */
  today: GameEvent[];
  planPicked: PlotId[];
  /** At the end of the day, what each team gained today. */
  gains: Record<Team, number> | null;
};

/** The five steps of the day, each with its icon from the identity. */
const STEPS = [
  { title: 'طلب البناء', icon: 'question' },
  { title: 'التصاريح', icon: 'check' },
  { title: 'البناء', icon: 'build' },
  { title: 'المزادات', icon: 'gavel' },
  { title: 'ختام اليوم', icon: 'flag' },
];

/** Which of the five steps of the day the competition is in. */
const CURRENT: Record<Step, number> = {
  setup: 0,
  question: 0,
  asking: 0,
  answer: 1,
  build: 2,
  auctions: 3,
  dayEnd: 4,
  announce: 4,
};

type Status = 'done' | 'current' | 'next';

/**
 * The day on one track: the five steps one under the other. A step that is over shrinks to a line with
 * its result, the current step is the one card, with its controls, and the steps ahead wait as quiet
 * lines. The request and the permits open together, so the referee marks the right answers as they come.
 */
export function DayTrack({ state, act, today, planPicked, gains }: Props) {
  const current = CURRENT[state.step];
  const statusOf = (i: number): Status => (i < current ? 'done' : i === current ? 'current' : 'next');
  const opens = (i: number) => i === current || (current <= 1 && i <= 1);

  const bodies: ReactNode[] = [
    <RequestBody key="request" state={state} act={act} />,
    <PermitsBody key="permits" state={state} act={act} />,
    <BuildBody key="build" state={state} act={act} planPicked={planPicked} />,
    <AuctionsBody key="auctions" state={state} act={act} />,
    <DayEndBody key="dayEnd" state={state} act={act} gains={gains} />,
  ];

  return (
    <section className="track" aria-label="خطوات اليوم">
      <ol className="track-list">
        {STEPS.map(({ title, icon }, i) => (
          <TrackStep
            key={title}
            title={title}
            icon={icon}
            status={statusOf(i)}
            summary={
              (statusOf(i) === 'done' && !opens(i)) || (i === 0 && !canChooseKind(state)) ? summary(i, state, today) : null
            }
          >
            {opens(i) ? bodies[i] : null}
          </TrackStep>
        ))}
      </ol>
    </section>
  );
}

type StepProps = { title: string; icon: string; status: Status; summary: ReactNode; children: ReactNode };

/** One step: its icon, its title (with a summary once done), and its body while open. */
function TrackStep({ title, icon, status, summary, children }: StepProps) {
  const step = useRef<HTMLLIElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const open = children !== null && children !== undefined;
  const wasOpen = useRef(open);
  const wasStatus = useRef(status);

  // A body that opens rises in. The step that becomes current settles in as the one card and comes into
  // view; the step just finished pops its marker.
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      animate(
        body.current,
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'none' },
        ],
        320,
      );
    }
    if (status === 'current' && wasStatus.current !== 'current') {
      animate(
        step.current,
        [
          { transform: 'scale(0.97)', opacity: 0.4 },
          { transform: 'none', opacity: 1 },
        ],
        380,
      );
      step.current?.scrollIntoView({ block: 'nearest' });
    }
    if (status === 'done' && wasStatus.current === 'current') {
      animate(
        marker.current,
        [
          { transform: 'scale(0.5) rotate(-12deg)' },
          { transform: 'scale(1.2) rotate(4deg)', offset: 0.6 },
          { transform: 'none' },
        ],
        460,
      );
    }
    wasOpen.current = open;
    wasStatus.current = status;
  }, [open, status]);

  return (
    <li ref={step} className="track-step" data-status={status} aria-current={status === 'current' ? 'step' : undefined}>
      <div className="track-head">
        <span ref={marker} className="track-marker" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <h2>{title}</h2>
        {summary ? <span className="track-summary">{summary}</span> : null}
      </div>
      {open ? (
        <div ref={body} className="track-body">
          {children}
        </div>
      ) : null}
    </li>
  );
}

/** The one-line result of a step that is over. */
function summary(i: number, state: GameState, today: GameEvent[]): ReactNode {
  switch (i) {
    case 0:
      return state.question.kind ? KIND_NAMES[state.question.kind] : null;
    case 1:
      return state.permits.length > 0 ? (
        <span className="track-teams" aria-label={state.permits.map((t) => state.setup.teams[t].name).join('، ')}>
          {state.permits.map((team) => (
            <TeamSymbol key={team} team={team} size={20} />
          ))}
        </span>
      ) : (
        'بدون تصاريح'
      );
    case 2: {
      const builds = today.filter((e) => e.type === 'build').length;
      const declared = state.auctions.filter((a) => a.day === state.day).length;
      const parts = [builds > 0 ? countOf(builds, BUILDING_NOUN) : 'لا مبانٍ جديدة'];
      if (declared > 0) parts.push(countOf(declared, AUCTION_NOUN));
      return parts.join(' · ');
    }
    case 3: {
      const done = state.auctions.filter((a) => a.day === state.day && a.status === 'done').length;
      return done > 0 ? countOf(done, AUCTION_NOUN) : 'لا مزادات';
    }
    default:
      return null;
  }
}
