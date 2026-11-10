import { useLayoutEffect, useRef } from 'react';
import { getBoard } from '../../engine/board.ts';
import type { GameState, PlotId, Team } from '../../engine/types.ts';
import { Icon } from '../../ui/Icon.tsx';
import { iconSvg } from '../../ui/icons.ts';
import { EASE_OUT, animate, reducedMotion } from '../../ui/motion.ts';
import { formatNumber } from '../../ui/number.ts';
import { CARD_NAMES, plotName } from '../../ui/names.ts';
import { TeamGlyph } from '../../ui/TeamBadge.tsx';

type Props = {
  state: GameState;
  /** Plots the referee can press now, and whose colour marks them. */
  choices: Set<PlotId>;
  chooser: Team | null;
  /** Of the choices, the plots the team reaches with its bridge. */
  bridges?: Set<PlotId>;
  /** Plots already picked, in order (placing a plan): each wears the plan and its number. */
  picked?: PlotId[];
  /** The plot an auction is about, with its bidder: it stands out and the rest of the map steps back. */
  focus?: { plot: PlotId; bidder: Team } | null;
  /** The numbers the display shows on the plots the team in turn can build on, for the leader to call out. */
  numbers?: Map<PlotId, number>;
  onPick: (id: PlotId) => void;
};

/**
 * The flat map on the referee screen, on the ground plate of the identity. Empty plots show their value
 * by their shade; plots the team in turn can use have a dashed border in its colour (the ones it can build
 * on carry the number the display shows, which its leader calls out), and every other plot does nothing. Marks show bases, cards, plans (referee only), declared auctions, and plots built or taken
 * today or yesterday. A plot a team gains settles into place, with its population in a bubble above it.
 */
export function FlatMap({ state, choices, chooser, bridges, picked, focus, numbers, onPick }: Props) {
  const board = getBoard(state.setup.size);
  const names = state.setup.teams;
  const declared = new Set(state.auctions.filter((a) => a.day === state.day).map((a) => a.plot));
  const map = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const owners = useRef<Map<PlotId, Team | null> | null>(null);

  useLayoutEffect(() => {
    const before = owners.current;
    const now = new Map(board.ids.map((id) => [id, state.plots[id]?.owner ?? null]));
    owners.current = now;
    if (!before) return;
    for (const [id, owner] of now) {
      if (!owner || before.get(id) === owner) continue;
      const plot = map.current?.querySelector<HTMLElement>(`[data-plot="${id}"]`) ?? null;
      // The plot lands with a little bounce, a ring of its colour spreads from it, and its population rises.
      animate(
        plot,
        [
          { transform: 'scale(0.6)', opacity: 0.4 },
          { transform: 'scale(1.1)', opacity: 1, offset: 0.6 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        460,
      );
      showRing(layer.current, plot, owner);
      showGain(layer.current, plot, owner, (board.plots[id]?.value ?? 0) * 100);
    }
  });

  return (
    <div className="board-plate">
      <div
        ref={map}
        className="flat-map"
        data-focus={focus ? '' : undefined}
        style={{
          gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))`,
          ['--chooser' as string]: chooser ? `var(--${chooser})` : undefined,
          ['--bidder' as string]: focus ? `var(--${focus.bidder})` : undefined,
        }}
      >
        {board.ids.map((id) => {
          const info = board.plots[id]!;
          const plot = state.plots[id]!;
          const centre = id === board.centre;
          const fresh = plot.since !== null && plot.since >= state.day - 1;
          const focused = focus?.plot === id;
          const pickedAt = picked ? picked.indexOf(id) : -1;
          const number = choices.has(id) ? numbers?.get(id) : undefined;
          // The tip: whose plot it is (or the card on it), then the population it is worth.
          const tip = centre
            ? 'برج الرقعة'
            : info.base
              ? `بلدية ${names[info.base].name}`
              : plot.owner
                ? names[plot.owner].name
                : plot.card
                  ? CARD_NAMES[plot.card]
                  : null;
          const content = (
            <>
              {plot.owner ? <TeamGlyph team={plot.owner} /> : null}
              {!plot.owner && plot.card ? <Icon name={plot.card} size={null} className="plot-card" /> : null}
              {!plot.owner && centre ? <Icon name="tower" size={null} className="plot-card" /> : null}
              {info.base ? <Icon name="hall" size={null} className="plot-mark plot-mark-top" /> : null}
              {plot.plan ? (
                <span className="plot-mark plot-mark-top plot-plan" data-team={plot.plan}>
                  <Icon name="plan" size={null} />
                </span>
              ) : null}
              {declared.has(id) && !focused ? (
                <Icon name="gavel" size={null} className="plot-mark plot-mark-bottom" />
              ) : null}
              {bridges?.has(id) ? <Icon name="bridge" size={null} className="plot-mark plot-mark-bottom" /> : null}
              {fresh ? <span className="plot-fresh" /> : null}
              {focused ? (
                <span className="plot-pin">
                  <Icon name="gavel" size={null} />
                </span>
              ) : null}
              {number ? <span className="plot-number">{formatNumber(number)}</span> : null}
              {pickedAt >= 0 ? (
                <span className="plot-picked">
                  <Icon name="plan" size={null} />
                  {formatNumber(pickedAt + 1)}
                </span>
              ) : null}
              <span className="plot-tip" aria-hidden="true">
                {tip ? <span>{tip}</span> : null}
                <span className="plot-tip-value">
                  <Icon name="house" size={null} />
                  {formatNumber(info.value * 100)}
                </span>
              </span>
            </>
          );
          const props = {
            className: 'plot',
            'data-value': info.value,
            'data-centre': centre || undefined,
            'data-team': plot.owner ?? undefined,
            'data-plot': id,
            'data-focus': focused || undefined,
          };
          if (choices.has(id)) {
            return (
              <button
                key={id}
                type="button"
                {...props}
                data-choice
                data-bridge={bridges?.has(id) || undefined}
                aria-pressed={picked ? pickedAt >= 0 : undefined}
                aria-label={`القطعة ${plotName(id)}${bridges?.has(id) ? '، بالجسر' : ''}`}
                onClick={() => onPick(id)}
              >
                {content}
              </button>
            );
          }
          return (
            <div key={id} {...props}>
              {content}
            </div>
          );
        })}
      </div>
      <div ref={layer} className="bubble-layer" aria-hidden="true" />
    </div>
  );
}

const BUBBLE_TIME = 1800;

/** A ring in the team's colour that spreads from a plot the moment the team gains it. */
function showRing(layer: HTMLElement | null, plot: HTMLElement | null, team: Team): void {
  if (!layer || !plot || reducedMotion()) return;
  const box = layer.getBoundingClientRect();
  const at = plot.getBoundingClientRect();
  const ring = document.createElement('span');
  ring.className = 'plot-ring';
  ring.dataset.team = team;
  Object.assign(ring.style, {
    left: `${at.left - box.left}px`,
    top: `${at.top - box.top}px`,
    width: `${at.width}px`,
    height: `${at.height}px`,
  });
  layer.append(ring);
  ring
    .animate(
      [
        { opacity: 0.9, transform: 'scale(0.9)' },
        { opacity: 0, transform: 'scale(1.9)' },
      ],
      { duration: 700, easing: EASE_OUT, fill: 'forwards' },
    )
    .finished.then(() => ring.remove(), () => ring.remove());
}

/**
 * The identity's population bubble over a plot a team just gained: "+٣٠٠" in a pill with the team's ring.
 * It rises and fades; with reduced motion it simply shows, then goes.
 */
function showGain(layer: HTMLElement | null, plot: HTMLElement | null, team: Team, gain: number): void {
  if (!layer || !plot || gain <= 0) return;
  const box = layer.getBoundingClientRect();
  const at = plot.getBoundingClientRect();
  const bubble = document.createElement('span');
  bubble.className = 'pop-bubble';
  bubble.dataset.team = team;
  bubble.style.left = `${at.left - box.left + at.width / 2}px`;
  bubble.style.top = `${at.top - box.top}px`;
  bubble.innerHTML = `<span class="icon">${iconSvg('house') ?? ''}</span><span dir="ltr"></span>`;
  bubble.lastElementChild!.textContent = formatNumber(gain, { sign: true });
  layer.append(bubble);

  if (reducedMotion()) {
    setTimeout(() => bubble.remove(), BUBBLE_TIME);
    return;
  }
  const rise = (y: number) => `translate(-50%, ${y}%)`;
  bubble
    .animate(
      [
        { opacity: 0, transform: rise(-60) },
        { opacity: 1, transform: rise(-125), offset: 0.18 },
        { opacity: 1, transform: rise(-140), offset: 0.8 },
        { opacity: 0, transform: rise(-165) },
      ],
      { duration: BUBBLE_TIME, easing: EASE_OUT, fill: 'forwards' },
    )
    .finished.then(() => bubble.remove(), () => bubble.remove());
}
